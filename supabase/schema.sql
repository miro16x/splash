-- Splash and Dash staff page: run once in the Supabase SQL editor.
-- The Worker writes with the service-role key (which bypasses RLS); staff read through RLS.

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  added_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  service text not null check (service in ('vinyl', 'ceramic', 'correction', 'other')),
  -- open: needs a staff reply · waiting: staff replied, waiting on the customer · closed: done
  status text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  customer_name text not null,
  email text not null,
  phone text,
  vehicle text,
  fields jsonb not null default '[]',   -- [[label, value], ...] exactly as emailed
  files jsonb not null default '[]',    -- [{path, name, type}] in the quote-files bucket
  last_message_at timestamptz not null default now()
);
create index if not exists quotes_service_created on public.quotes (service, created_at desc);

create table if not exists public.quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  created_at timestamptz not null default now(),
  direction text not null check (direction in ('outbound', 'inbound')),
  author text not null,                 -- staff email for outbound, sender address for inbound
  subject text,
  body text not null
);
create index if not exists quote_messages_quote on public.quote_messages (quote_id, created_at);
-- Added with the quote templates; safe to re-run on an existing project.
alter table public.quote_messages add column if not exists attachment jsonb;  -- {path, name, type} of a sent quote PDF
alter table public.quote_messages add column if not exists document jsonb;    -- {number, total, deposit, validThrough}

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

alter table public.staff enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_messages enable row level security;

drop policy if exists "staff read staff" on public.staff;
create policy "staff read staff" on public.staff for select to authenticated using (public.is_staff());
drop policy if exists "staff read quotes" on public.quotes;
create policy "staff read quotes" on public.quotes for select to authenticated using (public.is_staff());
drop policy if exists "staff update quotes" on public.quotes;
create policy "staff update quotes" on public.quotes for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff read messages" on public.quote_messages;
create policy "staff read messages" on public.quote_messages for select to authenticated using (public.is_staff());

-- Staff may only change a quote's status from the browser; everything else goes through the Worker.
revoke all on public.quotes, public.quote_messages, public.staff from anon, authenticated;
grant select on public.quotes, public.quote_messages, public.staff to authenticated;
grant update (status) on public.quotes to authenticated;

-- Private bucket for customer photos and artwork.
insert into storage.buckets (id, name, public) values ('quote-files', 'quote-files', false)
on conflict (id) do nothing;
drop policy if exists "staff read quote files" on storage.objects;
create policy "staff read quote files" on storage.objects for select to authenticated
  using (bucket_id = 'quote-files' and public.is_staff());

-- ---------- Customer list (added after the first release; safe to re-run) ----------
-- One row per person: everyone who sends a quote request (added by the Worker) plus people staff add by hand.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) > 0),
  email text unique check (email = lower(email)),   -- stored lowercase so quotes match by email
  phone text,
  stage text not null default 'potential' check (stage in ('potential', 'contacted', 'booked', 'client')),
  interest text not null default 'unknown' check (interest in ('interested', 'not_interested', 'unknown')),
  notes text,
  source text not null default 'staff' check (source in ('quote', 'staff')),
  added_by text default (auth.jwt() ->> 'email'),
  last_contacted_at timestamptz
);

-- Every call, text, email or visit staff log for a person.
create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_at timestamptz not null default now(),
  method text not null check (method in ('call', 'text', 'email', 'in_person')),
  outcome text not null check (outcome in ('reached', 'no_answer', 'left_message')),
  note text,
  author text not null default coalesce(auth.jwt() ->> 'email', 'staff')
);
create index if not exists customer_contacts_customer on public.customer_contacts (customer_id, created_at desc);

-- Logging a contact stamps the person's last-contacted time and moves a potential client to "contacted".
create or replace function public.customer_contact_logged() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.customers
     set last_contacted_at = new.created_at,
         stage = case when stage = 'potential' then 'contacted' else stage end
   where id = new.customer_id;
  return new;
end $$;
drop trigger if exists customer_contact_logged on public.customer_contacts;
create trigger customer_contact_logged after insert on public.customer_contacts
  for each row execute function public.customer_contact_logged();

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
drop policy if exists "staff manage customers" on public.customers;
create policy "staff manage customers" on public.customers for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff read contacts" on public.customer_contacts;
create policy "staff read contacts" on public.customer_contacts for select to authenticated using (public.is_staff());
drop policy if exists "staff log contacts" on public.customer_contacts;
create policy "staff log contacts" on public.customer_contacts for insert to authenticated with check (public.is_staff());

-- Staff can't set source, added_by or the contact author themselves; those come from defaults.
revoke all on public.customers, public.customer_contacts from anon, authenticated;
grant select, delete on public.customers to authenticated;
grant insert (name, email, phone, stage, interest, notes), update (name, email, phone, stage, interest, notes) on public.customers to authenticated;
grant select on public.customer_contacts to authenticated;
grant insert (customer_id, method, outcome, note) on public.customer_contacts to authenticated;

-- One-time: add everyone who already sent a quote request.
insert into public.customers (name, email, phone, source, added_by, created_at)
select distinct on (lower(email)) customer_name, lower(email), phone, 'quote', null, created_at
from public.quotes
order by lower(email), created_at desc
on conflict (email) do nothing;

-- ---------- Won/lost, revenue, jobs calendar and new-quote alerts (added later; safe to re-run) ----------
-- Run this whole section once in a new, empty SQL Editor tab.

-- Won/lost: the result of a quote, separate from the conversation status (a won quote can still get a reply).
alter table public.quotes add column if not exists outcome text check (outcome in ('won', 'lost'));
alter table public.quotes add column if not exists won_amount numeric(10,2) check (won_amount >= 0);   -- agreed price, counted as revenue
alter table public.quotes add column if not exists lost_reason text
  check (lost_reason in ('price', 'timing', 'went_elsewhere', 'no_response', 'not_a_lead', 'other'));
alter table public.quotes add column if not exists outcome_note text check (length(outcome_note) <= 2000);
alter table public.quotes add column if not exists decided_at timestamptz;
alter table public.quotes add column if not exists decided_by text;
create index if not exists quotes_decided on public.quotes (decided_at desc) where outcome is not null;

-- Stamps when and by whom a quote was won or lost, and drops fields that don't fit the result.
create or replace function public.quote_outcome_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.outcome is distinct from old.outcome then
    new.decided_at := case when new.outcome is null then null else now() end;
    new.decided_by := case when new.outcome is null then null else coalesce(auth.jwt() ->> 'email', 'staff') end;
  end if;
  if new.outcome is distinct from 'won' then new.won_amount := null; end if;
  if new.outcome is distinct from 'lost' then new.lost_reason := null; end if;
  if new.outcome is null then new.outcome_note := null; end if;
  return new;
end $$;
drop trigger if exists quote_outcome_stamp on public.quotes;
create trigger quote_outcome_stamp before update on public.quotes
  for each row execute function public.quote_outcome_stamp();

-- Winning a quote moves that person to "Booked" on the customer list.
create or replace function public.quote_won_books_customer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outcome = 'won' and old.outcome is distinct from 'won' then
    update public.customers set stage = 'booked'
     where email = lower(new.email) and stage in ('potential', 'contacted');
  end if;
  return new;
end $$;
drop trigger if exists quote_won_books_customer on public.quotes;
create trigger quote_won_books_customer after update on public.quotes
  for each row execute function public.quote_won_books_customer();

grant update (status, outcome, won_amount, lost_reason, outcome_note) on public.quotes to authenticated;

-- Jobs: booked work on the calendar. A job can come from a won quote or be added by hand.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text default coalesce(auth.jwt() ->> 'email', 'staff'),
  quote_id uuid references public.quotes (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null check (length(trim(customer_name)) > 0),
  phone text,
  vehicle text,
  service text not null default 'other' check (service in ('vinyl', 'ceramic', 'correction', 'wash', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  assigned_to uuid references public.staff (user_id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'done', 'cancelled')),
  price numeric(10,2) check (price >= 0),
  notes text check (length(notes) <= 10000),
  check (ends_at > starts_at)
);
create index if not exists jobs_starts on public.jobs (starts_at);
create index if not exists jobs_quote on public.jobs (quote_id);

-- Booking a job moves the person to "Booked"; finishing one makes them a "Client".
create or replace function public.job_updates_customer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is null then return new; end if;
  if new.status = 'done' then
    update public.customers set stage = 'client' where id = new.customer_id and stage <> 'client';
  elsif new.status <> 'cancelled' then
    update public.customers set stage = 'booked' where id = new.customer_id and stage in ('potential', 'contacted');
  end if;
  return new;
end $$;
drop trigger if exists job_updates_customer on public.jobs;
create trigger job_updates_customer after insert or update on public.jobs
  for each row execute function public.job_updates_customer();

alter table public.jobs enable row level security;
drop policy if exists "staff manage jobs" on public.jobs;
create policy "staff manage jobs" on public.jobs for all to authenticated using (public.is_staff()) with check (public.is_staff());
revoke all on public.jobs from anon, authenticated;
grant select, delete on public.jobs to authenticated;
grant insert (quote_id, customer_id, customer_name, phone, vehicle, service, starts_at, ends_at, assigned_to, status, price, notes),
      update (quote_id, customer_id, customer_name, phone, vehicle, service, starts_at, ends_at, assigned_to, status, price, notes)
  on public.jobs to authenticated;

-- New-quote alerts: each staff member chooses whether to get an email for every new quote request.
alter table public.staff add column if not exists alert_new_quotes boolean not null default true;
drop policy if exists "staff update own alerts" on public.staff;
create policy "staff update own alerts" on public.staff for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant update (alert_new_quotes) on public.staff to authenticated;

-- The Worker (service role only) asks who wants alerts; staff emails live in auth.users.
create or replace function public.staff_alert_emails() returns setof text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email) from public.staff s join auth.users u on u.id = s.user_id
   where s.alert_new_quotes and u.email is not null;
$$;
revoke all on function public.staff_alert_emails() from public, anon, authenticated;
grant execute on function public.staff_alert_emails() to service_role;

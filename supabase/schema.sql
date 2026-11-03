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

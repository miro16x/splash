# Deploy the quote email Worker

The site now requires the Worker in worker.mjs. Static-only hosting cannot process /api/quote.

1. In wrangler.jsonc, replace the name "splash" with the EXACT name of the existing Cloudflare Worker serving the website. Keep its existing custom domain connected.
2. Verify the sending domain in Resend and create a Sending access API key.
3. From the project directory run `npx wrangler login`, then `npx wrangler secret put RESEND_API_KEY`. Paste the API key only at the secret prompt.
4. Run `npx wrangler secret put QUOTE_FROM`. Enter `Splash and Dash <quotes@splashanddash.uluxe.site>` only if that domain is verified in Resend; otherwise use an address on your verified domain.
5. Run `npx wrangler deploy`. Wrangler builds dist with only public website files and deploys the script plus assets. If the secret command cannot create the initial Worker version, deploy once first, then add the secrets; submissions return an error until both secrets are configured.
6. For GitHub-based Cloudflare builds, use `npx wrangler deploy` as the deployment command, replacing any static-assets-only command. The build command is already included in wrangler.jsonc.
7. Submit a small JPG test on the live site; check the inbox, attachment contents, email logo and Reply-To address. Also submit without a photo. Test each service. Check Resend's delivery log if an accepted email does not arrive.

Recipient: QUOTE_TO in wrangler.jsonc. Allowed website origin: SITE_ORIGIN. Preview domains are intentionally not accepted for quote submissions. Uploads are optional, with a combined 10 MB cap. The Worker rate-limits submissions to five per minute per IP, validates required common fields and consent, and escapes text in the HTML email. API keys and local secret files must not be committed.

Local verification: `node scripts/test-worker.mjs` and `node scripts/build.mjs`.

Email success indicates Resend accepted the message, not guaranteed inbox delivery. Logo display depends on the recipient's email image settings. No live email was sent during automated testing.

## Quote attachments

Photos and artwork are sent directly as email attachments through Resend. No R2 bucket or storage binding is required. The combined upload limit remains 10 MB. Email apps may display attached images as previews at the bottom of the message.

## Staff page (staff.html)

Staff sign in at `/staff.html` to see quotes by service (Vinyl Wraps, Ceramic Coatings, Paint Correction), view photos, and email customers. Customer replies come back into the same quote's conversation, and the shop inbox (QUOTE_TO) gets an alert for each one. Until the steps below are done, the site keeps working exactly as before and `/staff.html` shows a "not set up yet" message.

Only quotes submitted after setup appear on the staff page. Earlier quotes stay in the inbox.

### 1. Supabase project

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it. It creates the `quotes`, `quote_messages` and `staff` tables, the private `quote-files` bucket, and rules so only listed staff can read anything.
3. **Authentication → Sign In / Providers**: turn off **Allow new users to sign up**. Staff are added by invitation only.
4. **Authentication → URL Configuration**: set **Site URL** to `https://splashanddash.uluxe.site/staff.html` and add the same address under **Redirect URLs**.
5. Optional but recommended: **Authentication → SMTP Settings**, use Resend's SMTP so sign-in emails come from your domain instead of Supabase's rate-limited default sender.

### 2. Connect the Worker

1. In Supabase **Project Settings → API**, copy the **Project URL** and the **anon public** key into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `wrangler.jsonc`. Both are safe to commit; the database rules protect the data.
2. Run `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` and paste the **service_role** key. Never commit this key or put it in a page; it bypasses the database rules.
3. Run `npm install`, then `npx wrangler deploy`.

### 3. Add staff

1. Supabase **Authentication → Users → Invite user**, enter the staff member's email.
2. Copy their user ID (UID) from the users list, then in the SQL Editor run:
   `insert into public.staff (user_id, name) values ('<UID>', '<Their name>');`
3. They go to `/staff.html`, enter their email, and click the link they receive.

To remove someone, delete their row from `public.staff` (they lose access immediately) and delete the user under Authentication.

### 4. Customer replies (Cloudflare Email Routing)

Staff emails go out with a reply address unique to each quote (`reply+<quote id>@splashanddash.uluxe.site`). For replies to reach the staff page:

1. Cloudflare dashboard → the domain → **Email → Email Routing**: enable it for `splashanddash.uluxe.site` and let Cloudflare add its MX and SPF records. Leave Resend's sending records in place.
2. Under **Destination addresses**, add and verify `angelkhatib4@gmail.com` (QUOTE_TO). Mail that isn't a quote reply is forwarded there.
3. Under **Routing rules → Catch-all address**, choose **Send to a Worker** and pick this Worker.
4. Set `REPLY_DOMAIN` in `wrangler.jsonc` to `splashanddash.uluxe.site` and deploy again. Until this is set, customer replies go straight to QUOTE_TO and don't appear on the staff page.

Replies are saved as text. Attachments a customer adds to a reply are not saved; staff can ask them to resend through the quote form if needed.

### Test after setup

Submit a quote with a photo, open it on the staff page, send a reply to an email you control, answer that email, and confirm the answer appears in the conversation and an alert arrives at QUOTE_TO. Local checks: `npm test` and `npm run build`.

### Quote templates (Send a quote)

On a Vinyl Wrap, Ceramic Coating or Paint Correction quote, staff can choose **Send a quote** instead of **Write a message**. The form follows that service's printed quote template and is pre-filled from the customer's request. Starting prices come from the price tables. Ranges (for example Stage 1 $500–$700) are shown as hints for staff to fill in. **Preview PDF** opens the finished quote, and **Send quote** emails it as a PDF attachment and keeps a copy in the conversation. Customers approve by replying to the email.

If your Supabase project was set up before this feature, run these two lines once in the SQL Editor (they're also in `supabase/schema.sql`):

```sql
alter table public.quote_messages add column if not exists attachment jsonb;
alter table public.quote_messages add column if not exists document jsonb;
```

Prices for the templates live in `assets/staff-quote.js`. They mirror the tables in `assets/site.js`, so when a price changes, update both.

### Customer list (Customers)

The **Customers** button on the staff page opens a list of everyone who sent a quote request (added automatically, one entry per email) plus anyone staff add with **+ Add person**. Each person has a **stage** (Potential client, Contacted, Booked, Client) and an **interest** (Interested, Not interested, Not sure yet), with filters for both and a search box. Staff call, text or email from the person's page, then **Log contact** with how it went. Logging the first contact moves a potential client to Contacted automatically. The history shows who reached out and when.

To turn it on, run the "Customer list" section at the end of `supabase/schema.sql` once in the SQL Editor, in a new, empty tab. It creates the tables and access rules and adds everyone who has already sent a quote. It's safe to run again.

### Staff dashboard

Staff land on **Dashboard** after signing in. The sidebar (a bottom tab bar on phones) switches between Dashboard, Quotes and Customers. The dashboard shows tiles for quotes that need a reply, quotes waiting on the customer, new requests this week, and interested customers, plus lists of quotes to reply to, people to follow up with, quotes by service, the customer pipeline, and recent activity. Every tile and row opens the matching filtered list. It reads the same Supabase data as the rest of the staff page, so it needs no extra setup (`assets/staff-dashboard.js`).

### Won/lost, revenue, calendar and new-quote alerts

To turn these on, run the "Won/lost, revenue, jobs calendar and new-quote alerts" section at the end of `supabase/schema.sql` once in the SQL Editor, in a new, empty tab. It's safe to run again. Until it's run, the staff page keeps working as before: the Won/Lost buttons, revenue and calendar say they aren't set up yet.

- **Won / Lost.** On a quote, **Won** asks for the agreed price, pre-filled from the last quote PDF sent. **Lost** asks why: price, timing, went with someone else, stopped replying, not a real lead, or other. Saving closes the quote and records who decided and when. Winning moves the person to Booked on the customer list. **Change result** edits it, and **Reopen** clears it. Quotes has **Won** and **Lost** filters. A customer replying to a won quote moves it back to Needs reply but keeps it won.
- **Revenue.** The dashboard's **Revenue from won quotes** shows money won this month and over the last 6 months, the close rate over 90 days (spam and duplicates are left out), why quotes were lost, and **Quotes out**: the total of sent quotes still waiting on a yes or no. Below that is a month-by-month chart, with a table view split by service. Revenue is the agreed price entered when a quote is marked won.
- **Calendar.** **Calendar** shows the week's jobs, filtered by who's doing them. Add a job with **+ New job** or a day's **+**, or with **Schedule the job** on a won quote, which fills in the customer, vehicle, service and price. The end time is suggested from the service (wash 2 h, correction 8 h, ceramic 1 day, wrap 2 days), and jobs can span several days. Staff get a warning before double-booking someone. Booking a job for someone on the customer list moves them to Booked, and marking it Done makes them a Client. The dashboard shows **Today's jobs**, with Start/Done buttons, and quotes won in the last 60 days that have no job yet. Times are shown in each staff member's device time zone.
- **New-quote alerts.** Each staff member gets an email for every new quote request, in addition to the full request that still goes to QUOTE_TO. They can turn it off with **Email me new quotes** in the account menu. While the staff page is open, new requests also show a pop-up with an Open button, add a count to the tab title when the tab is in the background, and, after **Desktop alerts** is turned on in that browser, show a system notification. The page checks for new quotes every minute.

### Quotes from the customer list

On a person's page under **Customers**, **Create a quote** lets staff pick Vinyl wrap, Ceramic coating, Paint correction (the same templates as quote replies) or **Custom**, where they list any work as line items with prices. **Send quote** emails the PDF (`/api/staff/quote`), creates a matching quote under **Quotes** (Custom quotes appear under "Other") so the customer's reply has a conversation to land in, and logs the email on the person's contact history, which moves a potential client to Contacted. People without an email address can still preview and print the PDF; sending needs an email. No extra database setup is needed.

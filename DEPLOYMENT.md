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

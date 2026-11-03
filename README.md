# AirLandlords calculator lead capture

Modified in place from ceptrade/Calculator commit 83bb8e0. Public URL after deployment: https://ceptrade.github.io/Calculator/ .

## Behaviour

Public index.html opens without a PIN. Property inputs → required first name, email, mobile and enquiry-contact consent → confirmed Google Sheet write → result. The full property postcode is required. Bedrooms are blank because the original calculator has no bedroom input. No marketing subscriptions, notifications or emails are sent. Contact information is not stored in browser localStorage.

Original rent × uplift × condition, seasonality, per-month rounding, annual totals and monthly-average rounding are preserved. Custom uplift 0% now means 0% (the original applied 40%). Result/PDF wording describes an indicative projection rather than claiming verified net income; the formula does not deduct specific bills or fees. PDF export is retained.

admin.html retains the original internal workflow and browser-local history behind code 1234. This is a convenience PIN in static JavaScript, not secure authentication. Never store the shared Google leads in this page or expose the Sheet publicly. Existing browser history remains only on its original device.

## Google setup and deployment

The deployed receiver and private leads Sheet are managed in the AirLandlords Google account. Keep the Sheet private.

1. Ensure the project contains the latest Code.gs. The appsscript.json manifest uses only the Google Sheets OAuth scope; no Gmail access is requested.
2. Run setup once and approve Google Sheets access in info@airlandlords.co.uk. It creates a private Sheet and saves its ID in script properties; later runs reuse it. Google authorization and the initial setup have already completed for the prepared project.
3. Deploy → New deployment → select Web app. Execute as **Me**, access **Anyone**. Only the write endpoint is public; keep the Sheet private. No endpoint reads lead data.
4. Paste the Web app URL ending /exec into config.js leadEndpoint. Do not use the /dev URL.
5. Publish index.html, config.js, lead-capture.js, privacy.html and admin.html to the existing main branch. GitHub Pages should continue publishing the repository root.
6. Test from the public URL with Test / calculator-test@example.com / 07700 900123 / SW1A 1AA / market rent 1800 / uplift 40% / same condition. Submit consent. The estimate must be £2,478/month, £29,736/year, standard £21,600/year, extra £8,136/year. Confirm one matching row exists in the Sheet, with source Property Earnings Calculator, status New Lead and server timestamp. Label the test row as a test after verification; never follow it up.
7. Verify the same journey at 375px and 390px, validation, back navigation, failed network retry and PDF export. The result must stay hidden after a storage error.

The endpoint accepts only the configured website origin, validates payloads and consent, recalculates the estimate, escapes spreadsheet formula prefixes, uses a lock and a request ID to avoid duplicate retries, and acknowledges success only after flushing the write. Origin fields and the honeypot are lightweight abuse deterrents, not authentication; bots can submit directly. Monitor Sheet growth and Apps Script quotas.

The static form uses a simple URL-encoded POST and follows Google's ContentService redirect to a JSON receipt. Google account cookies are omitted so signed-in and anonymous visitors behave alike. The browser checks the request ID, saved status and estimate totals; only a readable confirmed receipt unlocks the result. No opaque no-cors response is treated as proof of storage. An unconfigured endpoint or failed request keeps the result hidden and offers retry. The receiver retains its original iframe receipt as a compatibility path; the public client uses JSON. The loopback preview origin is allowed for development testing.

## Verification

Run `node verify.mjs` from this folder. It compares 75 cases to the original committed calculator and checks the zero-uplift fix, backend storage acknowledgement, retries, conflicting IDs, invalid input, enquiry consent and spreadsheet formula escaping. Backend tests use a store double and do not establish production storage.

Browser verification so far: public page opens without PIN; full postcode is normalized; property inputs continue to contact capture; Results navigation remains locked before submission. Mobile visual QA passed at 375px with a real Google Sheet write and confirmed result reveal. Complete the final public-URL smoke test after publication.

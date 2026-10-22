# Warpvio — V1 Website Check & App Customization

**Status:** Website analysis, customization, unpaid project saving and checkout review source committed. **Windows NSIS, Android debug APK, and macOS Intel/Apple Silicon DMG QA builds have all passed GitHub Actions artifact verification (22 Oct 2026).** Physical device installation, release signing, payment fulfillment and customer downloads remain unverified/unavailable. **Live payments are disabled.**


## Verified developer build runs (22 October 2026)

- [Windows x64 installer](https://github.com/helloskyorigin/Warpvio/actions/runs/39734304510) — successful Electron/NSIS QA build and artifact upload
- [Android debug APK](https://github.com/helloskyorigin/Warpvio/actions/runs/39741956591) — successful Gradle build, apksigner verification and artifact upload
- [macOS Intel + Apple Silicon DMGs](https://github.com/helloskyorigin/Warpvio/actions/runs/39742174151) — successful build, DMG integrity verification and separate x64/arm64 artifacts
- [Root CI tests](https://github.com/helloskyorigin/Warpvio/actions/runs/39742174061) — success after fixes
- [Full QA verification report](docs/qa-build-verification-2026-10-22.md) — known limitations and launch blockers

**Deployment:** Vercel reports project `warpvio` as READY at https://warpvio.vercel.app, but the connected Vercel scope returned 403 when inspecting browser/API output, so real HTTP availability is not confirmed. The deployed commit is `dc2587e`, before some workflow/doc fixes. Secure paid exports and production signing are not ready.

## Current flow

1. Open `index.html`; paste a public website URL and select Windows, Android and/or macOS.
2. Continue to `analyzing.html`. The page calls `POST /api/analyze` and shows the real request state and actionable errors.
3. The response is stored in browser session storage; `compatibility.html` renders confirmed findings and clearly labels native behaviors as unverified.
4. Click **Customize my app** for `customize.html`. Edit app name, upload a PNG/JPG/WebP icon (cropped locally to 256×256), choose accent/theme and configure selected platform preferences.
5. Click **Continue to preview** to open `preview.html`, which displays the saved design and proposed one-time export price. **No charges, generated files or paid entitlement exist in this phase.**
6. From `preview.html`, continue to `checkout.html` for the one-time export order summary and a server-side checkout-readiness check. The production payment action is deliberately disabled.

### Checks that actually run

- Public URL validation; redirects limited and revalidated
- DNS checks rejecting private, local, reserved, multicast and link-local network targets
- HTTP status and HTML content-type; request timeout and HTML size limits
- HTTPS, page title, favicon link reference, viewport meta tag
- Explicit limitations for login, payments, popups, native WebViews, device permissions and app signing

**Not tested:** Native compilation, installability, actual Android responsiveness, real login/checkout journeys, app-store acceptance, app code signing or JavaScript rendering. A successful check is preliminary, not proof of compatibility.

## Run locally

Requirements: Node.js 20+.

```bash
npm test
npx vercel dev
```

Open the URL printed by `vercel dev`. The local HTML pages and `/api/analyze` must be served by the same host. A simple static file server or GitHub Pages will show the UI but **cannot run the analysis API**.

## Deploy

1. Import `helloskyorigin/Warpvio` into Vercel as a new project.
2. Choose the "Other" framework preset (the project consists of static HTML and a Node serverless function).
3. Leave the build command empty. The repository root is the output directory for static pages.
4. Deploy. Verify that `GET /api/analyze` returns HTTP 405 (POST only), then submit an owned public website through the landing page.
5. For production traffic, enable platform WAF/bot protection or persistent rate limiting. The included in-memory limiter is only a first defense per warm serverless instance.

There are no third-party runtime dependencies for the analysis function.

## Repository files

- `index.html` — original no-bubbles landing page, responsive URL/platform selector
- `analyzing.html` — real request state, retry/error UI
- `compatibility.html` — confirmed findings + unverified native requirements
- `customize.html` / `customize.js` / `customize.css` — interactive editor, icon processing and live launch mockup
- `preview.html` / `preview.js` — configuration summary and pricing estimate, **not** an app build
- `app-config.js` — same-tab session state validation and persistence
- `tests/app-config.test.cjs` — customization state and pricing unit tests
- `checkout.html` / `checkout.js` / `checkout.css` — non-charging export order review
- `lib/commerce.js` — canonical USD pricing, allowed products and Dodo test checkout integration
- `api/checkout.js` — checkout readiness + protected sandbox-only Dodo Checkout Sessions
- `api/dodo-webhook.js` / `lib/dodo-webhook.js` — signed Dodo webhook **test receiver** (no entitlement)
- `payment-return.html` — non-entitlement sandbox return page
- `tests/commerce.test.cjs` — quote, Dodo sandbox and signature-verification tests
- `tests/checkout.test.cjs` — payment-disabled API and webhook parser safeguards
- `.env.example` — sandbox configuration template (never store real secrets in Git)
- `flow.css` — shared analysis/results design
- `api/analyze.js` — Node serverless URL scanner
- `tests/analyze.test.cjs` — scanner unit/security tests
- `vercel.json` — deployment configuration

## Security and privacy notes

- URL scanner only supports public HTTP/HTTPS websites and limits payload size, redirects and request time.
- The scanner does **not** submit forms or execute a webpage's JavaScript.
- Analysis results, app name, preferences and processed PNG icon previews stay in the browser tab's `sessionStorage` for the current flow. The original uploaded icon is not sent to a server.
- No account, payments or downloadable EXE/APK/DMG are active yet.
- A public service should enforce durable rate limits/WAF rules, observability and build quotas before selling app exports.

## App customization scope

- The launch mockups intentionally illustrate a **shell**, not your actual website rendered inside a native app.
- The inferred website title/fallback icon is editable. A user-uploaded icon is converted into a square PNG locally and kept in same-tab storage only; later export workers need a separate safe, durable upload path.
- Selected platforms come from the analyzed URL; preferences for Windows/macOS window size and Android orientation are only **planned build settings**, not verified artifacts.
- Pricing shown in preview is an **estimate** from the original launch plan ($15 Windows, $19 Android, $19 macOS, $39 all three), not a live checkout.
- Back/reload navigation preserves data within the same browser tab. Closing the tab or clearing site data loses the unsaved project draft. There is no account or cross-device recovery yet.

## Checkout foundation — intentionally not charging customers

- **Server-owned prices:** Windows $15, Android $19, macOS $19, all-three bundle $39 (USD, one-time, preliminary price schedule). Two-platform selections add individual item prices. App UI is not an authority for amounts.
- `GET /api/checkout` returns a structured price schedule and `readyToBuy:false`. The public order screen never exposes a payment button that charges a card.
- `POST /api/checkout` **always returns 503 unless all three conditions are met**: Dodo environment is exactly `test_mode`, `WARPVIO_TEST_CHECKOUT_ENABLED=true`, and the request includes the private header `x-warpvio-qa-token` matching `WARPVIO_TEST_CHECKOUT_TOKEN` (minimum 20 characters).
- For authorized QA only, that POST endpoint uses the Dodo **test** Checkout Sessions API at `https://test.dodopayments.com/checkouts`. Product IDs are mapped from the allowlisted `DODO_PRODUCT_*` environment variables; arbitrary client prices or product IDs are rejected. No live charge path exists.
- `POST /api/dodo-webhook` validates the Dodo Standard Webhooks HMAC signature against **raw request bytes** and a ±5-minute timestamp window, accepting events only in `test_mode`. No payment success is used to unlock exports.
- Dodo webhook endpoint for QA (once Vercel is deployed): `https://YOUR_DOMAIN/api/dodo-webhook`. Save the Dodo **test mode** webhook signing key as `DODO_PAYMENTS_WEBHOOK_KEY`; keep all secrets server-side.
- The sandbox return page is `/payment-return.html`, which explicitly warns that a redirect is **not proof of payment**.
- Run `npm test` (Node 20+) for automated scanner, customization and commerce tests.

### Developer-only test checkout request

This is not a public customer flow. First configure the Dodo **test** products with matching USD prices and environment settings in `.env.example` inside Vercel (do not upload the secrets to Git).

```sh
curl -X POST https://YOUR_DOMAIN/api/checkout \
  -H "Content-Type: application/json" \
  -H "x-warpvio-qa-token: YOUR_PRIVATE_TEST_TOKEN" \
  -d '{"platforms":["Windows"],"email":"your-test-email@example.com"}'
```

### Before enabling any real one-time payments

Do **not** switch to live mode yet. Complete and end-to-end test all the following:

1. Working Windows, Android and macOS build workers with signable, installable artifacts, compatibility policies and delivery failure handling.
2. Website/domain ownership verification and secure app configuration uploads.
3. **Durable** order records bound to exact signed quotes, a real purchaser and app configuration, not simply browser `sessionStorage`.
4. Durable webhook idempotency, payment/order reconciliation, refund and chargeback handling, proper product/amount/currency checks, and a safe fulfillment queue.
5. Secure artifact storage, expiration, verified purchaser recovery, installation guides and customer support.
6. Test-mode payment + refunds + failed builds + webhook redelivery end to end; only then implement a separately audited production live checkout path.

**Do not charge customers for files Warpvio cannot actually generate and deliver.**

## Windows installer builder — developer QA

The repository now includes a Windows x64 Electron/NSIS build pipeline. It can generate an app shell that loads the chosen public HTTPS website, with a branded app name, Windows icon, sandboxed renderer and restricted permissions.

- [Run Windows QA workflow manually](https://github.com/helloskyorigin/Warpvio/actions/workflows/windows-qa.yml) (GitHub Actions → Run workflow)
- [Windows builder documentation](builder/windows/README.md)
- Source files are in builder/windows, with pinned Electron 44.9.3 and electron-builder 26.17.0 versions.
- The workflow takes a developer-owned HTTPS URL, app name, accent and window size; it will package an **unsigned** Windows x64 NSIS installer and upload an Actions artifact IF the job succeeds.
- This code was committed but the actual Windows build/run result has not been verified as successful in this session. **Do not advertise an available .exe until the GitHub job produces one and a Windows installation test passes.**
- The workflow is **not connected to the web customization form**, does not fetch an uploaded browser icon, and does not authorize a paid export. No customer-triggered builds, entitlements or downloads exist.
- GitHub repository / Actions artifacts should be treated as potentially public. Only use test websites you own or are permitted to wrap.
- Windows code signing and Windows SmartScreen trust are not set up. Do not distribute unsigned QA binaries commercially.

**Other platforms:** Android debug APK source/QA pipeline is available below; macOS DMG remains unimplemented. Do not switch on live Dodo charging before secure, tested build and delivery exists.


## Android APK builder — developer QA

Warpvio now includes a separate Android WebView application, brand/icon/orientation configuration generator and GitHub Actions pipeline designed to compile a **debug-key signed installable APK**. It is not a production release build or an automatic paid export.

- [Android QA build workflow](https://github.com/helloskyorigin/Warpvio/actions/workflows/android-qa.yml) — Run workflow on main with a public HTTPS URL you own or are permitted to test.
- [Android builder documentation](builder/android/README.md) — local build, security restrictions and limitations.
- Stack: Android Gradle Plugin 8.13.2, Gradle 8.13, JDK 17, Android SDK 35, Node 22 for the config/icon generator.
- Safe demo smoke builds can run on push changes to builder/android/** using example.com, with APK validation and GitHub artifact upload.
- WebView enables website JavaScript and DOM storage but denies local file/content access, mixed HTTP, popups, sensitive permissions, file chooser and downloads. Main-frame navigation is limited to the chosen HTTPS origin.
- A generated native icon, package ID and app name are baked into the APK. Device orientation preference and branded loading/failure/retry states are implemented.
- The debug APK is signed by Android's development key, **not a production/customer signing key**. Do not sell it, upload it to Google Play or represent it as a released app.
- The Actions build and actual Android device installation still require independent verification. Code being committed does not mean a tested APK is available.
- The Warpvio web editor is **not yet connected** to either Android or Windows builders; browser-uploaded icons remain in session storage. There is no authenticated build queue, artifact delivery or payment entitlement.

**macOS DMG builder and production paid exports remain pending.** Secure signing, domain ownership checks, real end-to-end install testing and build orchestration are required before enabling live payments.


## macOS QA, saved projects and secure storage foundation

**macOS DMG QA source:** See the [macOS GitHub Actions workflow](https://github.com/helloskyorigin/Warpvio/actions/workflows/macos-qa.yml) and [macOS builder guide](builder/macos/README.md). CI is configured to build Intel x64 and Apple Silicon arm64 DMGs and check disk image integrity. Actual success and installation remain unverified. Apple Developer ID signing and notarization are required for commercial distribution.

**No-login, unpaid project:** From checkout.html choose Save project & verify domain. The project.html interface saves a server-validated 24-hour Upstash draft, supplies a private recovery link and supports TXT verification at the hostname prefixed by _warpvio. Status access requires a 32-byte random bearer token. No email verification or payment entitlement exists. Android currently requires ASCII-compatible app names.

**Custom icon transfer:** Once domain control is verified, users may explicitly upload their selected 256×256 PNG to a PRIVATE Cloudflare R2 bucket using a short-lived signed PUT URL. A HEAD metadata check verifies type and size, not full decoding. Future release workers MUST fully decode and validate the icon again. The deployed Warpvio origin must be allowed by bucket CORS for PUT Content-Type. Without storage settings, uploads fail safely.

**Secure download contract:** The download API can sign a 120-second private R2 GET URL only for a durable order that is domain verified, genuinely payment verified, fulfilled, non-refunded, and has a validated artifact key, checksum and size. No current endpoint grants paid/fulfilled status; all real downloads stay locked.

**Private release worker contract:** Production customer builds are refused unless a verified paid order, domain verification and a confirmed PRIVATE worker repository exist. Existing public QA workflows are intentionally not connected to customer data or orders. Signed release worker jobs, private artifact transfer and verified payment fulfillment must still be built and tested.

## Required deployment and launch configuration

- Vercel: import this repository using the Other framework preset. API functions must run on the same HTTPS origin as the static frontend; GitHub Pages cannot serve them.
- Upstash: configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN server-side for unpaid draft storage and rate limiting.
- Cloudflare R2: configure a private bucket with R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET; allow PUT via CORS only from the Warpvio deployment origin; configure lifecycle expiration.
- Dodo: test-mode only with .env.example settings until durable payment idempotency, refunds and production fulfillment exist. A checkout redirect is not payment proof.
- Private build workers: an entirely separate PRIVATE worker repository, release-signing certificates, secure artifact handoff, and authenticated expiring downloads are required before enabling customer export.
- Keep all credentials in Vercel/GitHub secret stores. Never put them in public GitHub or paste them into chat.
- Run npm test at repo root, npm test inside builder/windows and builder/macos, and node --test tests/*.test.cjs inside builder/android.
- See [Production launch checklist](docs/production-launch-checklist.md).

This is substantial code infrastructure, NOT a fully integrated paid-download service. The public checkout remains safely disabled.

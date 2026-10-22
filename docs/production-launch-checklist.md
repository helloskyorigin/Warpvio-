# Warpvio — production readiness and release gates

**Current position:** Source code for web analysis, customization, checkout review, Windows NSIS QA, Android debug QA and macOS unsigned DMG QA is committed. Domain verification, unpaid project storage and gated R2 artifact-download contracts exist. **Production customer builds, public live payments and paid downloads are NOT working.**

## 1. Verify each developer QA build (must be green)

- Windows: [Windows QA Actions](https://github.com/helloskyorigin/Warpvio/actions/workflows/windows-qa.yml). Build example.com on a clean Windows runner; obtain a real unsigned NSIS EXE; install, open, navigate, uninstall on a clean Windows VM. Review SmartScreen warning.
- Android: [Android QA Actions](https://github.com/helloskyorigin/Warpvio/actions/workflows/android-qa.yml). Obtain debug-signed APK; check apksigner; install/open/back/retry on recent physical Android and emulator. Confirm unsupported login and permission flows are documented.
- macOS: [macOS QA Actions](https://github.com/helloskyorigin/Warpvio/actions/workflows/macos-qa.yml). Verify x64 + arm64 DMGs, hdiutil integrity and app launch tests on actual Intel and Apple Silicon Macs. Gatekeeper will warn or block unsigned QA apps.

**Status:** Build workflows written, results not independently verified. Do not claim a downloadable binary until a successful Actions run and actual install.

## 2. Deploy the web API safely

- Import [Warpvio GitHub](https://github.com/helloskyorigin/Warpvio) into Vercel as an Other (static HTML + serverless Node) project. Warpvio was not found as an existing Vercel project at the last inspection.
- Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment secrets. Ensure Upstash endpoint is HTTPS.
- Test homepage URL submission to analyzing.html, then compatibility.html, customize.html, preview.html, checkout.html and project.html.
- Verify backend responds correctly to invalid URL/private IP, HTML timeout, a known public HTTPS URL, disabled checkout, and missing draft.
- Add production WAF/IP request quotas to protect public website-scanning and order creation APIs.
- Implement access logs that exclude secret bearer tokens, signed URLs, cookies and customer app credentials.

**Status:** APIs and frontend source committed; deployment and live HTTP tests not verified.

## 3. Website ownership + unpaid draft

- Create a draft from project.html with a website you own.
- Add the exact TXT record at the host displayed (prefix _warpvio.). Verify the value and check server status.
- Ensure unauthenticated requests cannot access the project; test invalid and expired recovery links.
- Configure Cloudflare R2 PRIVATE bucket, S3-compatible credentials and narrow CORS origin. Check upload in the project screen and confirm stored PNG HEAD metadata and strict byte limit.
- Perform actual PNG decoding, transcoding and malware checks inside trusted worker before using customer-uploaded images.

**Status:** Source ready; external credential and live tests pending. Drafts have 24-hour TTL and private link recovery, not verified-email recovery.

## 4. Release-sign Windows, Android and macOS

- Windows: sign EXE/NSIS with commercial code signing or approved Azure Trusted Signing, then check SmartScreen and install/uninstall.
- Android: generate per-app immutable release keystore with secure custody, produce release-signed APK/AAB as applicable, support consistent update signatures, review relevant store policies.
- macOS: join Apple Developer Program, obtain Developer ID Application cert, sign/harden/notarize and staple both Intel + Apple Silicon distributions, test Gatekeeper under default settings.
- Extend per-platform builders for common OAuth redirects, downloads, file uploads, permissions, native navigation where safely supported.
- Validate website ownership and rights; do not wrap unauthorized sites or third-party brands deceptively.

**Status:** NOT IMPLEMENTED. Debug/unsigned QA output cannot be charged as production exports.

## 5. Durable paid fulfillment and no-login recovery

- Set up separate PRIVATE GitHub build workers or isolated managed runners. Do not send paying-customer config to this public QA repo.
- Create a durable order state machine with immutable server-side quotes and verified purchaser, idempotent webhook processing, payment amount/currency/product reconciliation and refund/chargeback revocation.
- Link Dodo Checkout Sessions only after real signed builds and delivery work. Use test-mode keys/products first; keep API and webhook signing keys server-side.
- Implement a jobs queue with retries, failure/refund policy, running status and per-user quotas; sign uploads and audit artifact checksums.
- Upload compiled artifacts to a PRIVATE R2 bucket, attach exact object keys and verified checksums to durable paid orders, then deliver via short-lived customer-authorized signed links.
- Add verified-email magic-link recovery with email rate limits, expiry and abuse safeguards; never trust the checkout return URL as payment proof.
- Test payment success/failure/refund, webhook replays, duplicate dispatch, build failure, timeout, download expiry, recovery and customer support.

**Status:** Sandbox Dodo session and webhook verification source exist; signed GET contract exists; PUBLIC LIVE CHARGING REMAINS DISABLED. No code currently transitions an order into paid+fulfilled.

## 6. Launch decision

Do not activate live checkout, claim zero-click paid exports, distribute unsigned/QA binaries to paying customers or advertise production readiness until all 5 groups above pass.

Current plan: Windows $15 one-time, Android $19, macOS $19, all-platforms bundle $39. Two-platform combinations add individual prices. Validate margins against per-platform build runner, signing, storage, bandwidth, chargeback and support costs before offering these figures commercially.

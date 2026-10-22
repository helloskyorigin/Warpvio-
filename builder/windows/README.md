# Warpvio — Windows x64 QA installer builder

**Status: developer-only build pipeline, NOT customer fulfillment.**

This directory contains a real Electron app shell, NSIS installer configuration and tests. The generated .exe opens a public HTTPS website online; its website and backend must remain hosted.

## Build with GitHub Actions

[Run the Windows QA installer workflow](https://github.com/helloskyorigin/Warpvio/actions/workflows/windows-qa.yml).

1. Go to Actions → Windows QA installer (unsigned) → Run workflow on main.
2. Enter a PUBLIC HTTPS website you own or are allowed to package.
3. Choose an app name, accent and Windows starting window size.
4. After the run succeeds, open its Artifacts section and download the ZIP.
5. Extract the ZIP and inspect the unsigned Windows x64 .exe installer.

**An installer only exists after a successful green workflow run.** Artifacts are not payments, product fulfillment or public secure download links.

### Run locally on Windows

Node.js 22 and a Windows build environment are required.

~~~powershell
cd builder/windows
npm install
npm test
node scripts/prepare.cjs --url "https://example.com/" --name "My Example" --accent blue --size standard
npm run build:windows
~~~

Installer output: builder/windows/dist/*.exe

Optional CLI icon: --icon "C:\icons\my-icon.png" (a 256×256 PNG). Browser-uploaded icons are NOT automatically sent to this QA build pipeline.

### Implemented

- NSIS Windows x64 app installer configuration (Electron + electron-builder)
- Validated HTTPS website URL, app name, starting window size and stable app ID
- Generated PNG / Windows ICO icon using the chosen brand color and initial letter
- Secure Electron renderer: sandbox ON, context isolation ON, Node integration OFF, web security ON
- Denied popups, cross-origin redirects, downloads and sensitive permissions
- Local connection-error message; no offline functionality
- GitHub Actions manual build and artifact upload
- Automated unit tests for URL controls, icon bytes and build manifest

### Unsupported / production blockers

- Customer-triggered exports, authenticated download and payment fulfillment
- Android APK / macOS DMG
- Windows signing: unsigned installers can show SmartScreen warnings and must NOT be distributed commercially
- Guaranteed website compatibility, external identity-provider login redirects, popups and file downloads
- Automated app updates and website ownership verification
- Durable secure handling of uploaded user icons / paid order configuration

**The repository is public. Actions artifacts may be visible to users with repository access. Do not submit confidential sites or customer branding to this manual QA workflow.**

## Production gates

Do not enable live checkout or a public builder endpoint until domain ownership checks, isolated queue, secure icon uploads, artifact signing, build QA, durable payment entitlements, webhook idempotency, delivery and refunds all work. In particular, never enable Electron Node integration for remote sites.

## Project files

- app/main.cjs — Electron remote-site shell
- app/security.cjs — app name, URL, platform restrictions
- app/offline.html — static connection failure page
- scripts/icon.cjs — icon PNG and ICO generator
- scripts/prepare.cjs — app configuration and NSIS manifest generator
- tests/builder.test.cjs — security and packaging unit tests
- package.json — pinned Electron and electron-builder dependencies
- repo root .github/workflows/windows-qa.yml — manual CI installer pipeline


## Automated safe smoke build on code changes

Updates to files under builder/windows/ on main also trigger this same workflow with fixed public test defaults (https://example.com/, Warpvio QA Demo, blue, standard). This exercises the Windows NSIS packager without customer input or any payment. GitHub Actions must be enabled and the run must succeed before there is an actual downloadable artifact.

A demo installer artifact produced by CI should be treated as a temporary unsigned developer sample, not a production export. Build runs may fail because of dependency downloads, runner changes or packaging errors; inspect the Actions logs before advertising functionality.

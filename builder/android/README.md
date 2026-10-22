# Warpvio Android APK Builder — developer QA V1

**Status: Android app source and GitHub Actions build pipeline are committed. Actual APK build and installation have not yet been verified.**

This developer-only tool packages a public HTTPS website as an online Android WebView app. It uses Android Gradle Plugin 8.13.2, Gradle 8.13, JDK 17 and SDK 35 to produce a debug-key signed APK. The original website and backend must stay online.

## Build with GitHub Actions

[Android QA APK workflow](https://github.com/helloskyorigin/Warpvio/actions/workflows/android-qa.yml)

1. Open Actions → Android QA APK (debug signed).
2. Choose Run workflow on the main branch.
3. Enter a public HTTPS website URL that you own or are permitted to package.
4. Set an ASCII app name (2–36 characters), icon accent (blue, violet, mint or rose) and orientation preference (auto or portrait).
5. Run the workflow. **Only after the run succeeds**, open its Artifacts section and download the ZIP named warpvio-android-debug-qa-...
6. Extract the ZIP to get app-debug.apk. Test it on a dedicated Android 8.0+ device. Your device may require permission to install QA APKs from outside the Play Store.

Changes to files under builder/android on the main branch also trigger a safe default smoke build using https://example.com/, Warpvio QA Demo, blue and auto orientation.

**GitHub Actions artifacts from this public repo are not secure customer delivery. Never submit confidential branding or websites.**

## Build locally

Requirements: JDK 17, Gradle 8.13, Node 22+ and Android SDK with platform 35 and build tools 35.0.0.

From the builder/android directory run:

~~~bash
node --test tests/*.test.cjs
node scripts/prepare.cjs --url "https://example.com/" --name "My Website App" --accent violet --orientation auto
gradle :app:assembleDebug --no-daemon
~~~

Output file: app/build/outputs/apk/debug/app-debug.apk

For developer QA only, supply your own valid 256×256 PNG icon using --icon /path/to/icon.png. **The icon uploaded in the Warpvio web editor is not automatically passed to the builder.**

## Implemented

- App icon from selected accent + initial letter, or a manual 256×256 PNG
- Customized app name and unique Android application ID derived from website origin
- Same-origin HTTPS WebView navigation with Android back button support
- Optional portrait orientation, brand-colored native loading/error/retry states
- JavaScript and DOM storage for web apps; not an offline version of the website
- Local file/content access off; no native JavaScript interface
- Mixed HTTP content, third-party cookies, popups and external navigation blocked
- No camera, microphone, notifications, geolocation, file uploads or downloads in the QA shell
- Safe Browsing and TLS certificate validation
- Android Gradle Debug APK build, debug signing and signature/integrity checks

## Limitations and production blockers

- Debug-signing is NOT production signing; the APK is not suitable for Google Play or customer purchases.
- OAuth/social login redirects, third-party checkout links, browser deep links, permission-heavy apps and downloads may fail by design.
- Some iframe/third-party resources may load according to normal WebView browser policy; no privileged native bridge is exposed.
- No secure browser-icon upload bridge, domain ownership verification, stable release keystore or updates.
- No durable authenticated order, build job queue, safe artifact storage or private expiring downloads.
- Native device compatibility and Android 15 edge-to-edge/inset behavior require testing on actual devices.
- Build success has to be established by a green Actions run, verified APK output and real installation testing; code commits alone do not establish this.

## Required before paid Android exports

Verify website ownership; implement secure config and icon uploads; isolate build jobs with quotas; create per-customer release signing and safe key custody; test navigation and installs across Android/WebView versions; connect durable webhook-verified payments, refund handling and authenticated expiring downloads; review Google Play and privacy policies.

**Public checkout and customer APK exports stay disabled.**

## Key files

- scripts/prepare.cjs — validates URL, identity, icon and orientation
- app/build.gradle — Android build configuration
- app/src/main/AndroidManifest.xml — INTERNET-only permission and HTTPS-only manifest
- app/src/main/java/com/warpvio/shell/MainActivity.java — native online WebView
- app/src/main/res/values/styles.xml — native theme
- tests/builder.test.cjs — local generator and security checks
- .github/workflows/android-qa.yml at repo root — GitHub Actions debug APK workflow

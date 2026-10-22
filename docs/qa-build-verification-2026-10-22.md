# Warpvio QA build verification — 22 October 2026

## GitHub-hosted compilation verification

At the time of this report, the following GitHub Actions build runs finished with **conclusion: success**. This is a recorded CI result, **not** full device compatibility or a production distribution authorization.

| Target | GitHub Actions run | Verification available | Artifact |
| --- | --- | --- | --- |
| Windows x64 NSIS installer | [39734304510](https://github.com/helloskyorigin/Warpvio/actions/runs/39734304510) | Electron-builder completed; EXE file exists and basic nonzero/size check passed | `warpvio-windows-qa-1` (~120 MB artifact ZIP) |
| Android debug APK | [39741956591](https://github.com/helloskyorigin/Warpvio/actions/runs/39741956591) | Gradle assembleDebug, ZIP integrity, Android apksigner verification and artifact upload passed | `warpvio-android-debug-qa-3` (debug APK artifact) |
| macOS arm64 DMG | [39742174151](https://github.com/helloskyorigin/Warpvio/actions/runs/39742174151) | Electron-builder DMG compilation and hdiutil verify passed | `warpvio-macos-qa-arm64-2` (~130 MB artifact ZIP) |
| macOS x64 DMG | [39742174151](https://github.com/helloskyorigin/Warpvio/actions/runs/39742174151) | Electron-builder DMG compilation and hdiutil verify passed | `warpvio-macos-qa-x64-2` (~134 MB artifact ZIP) |
| Main Node.js automated tests | [39741963493](https://github.com/helloskyorigin/Warpvio/actions/runs/39741963493) | Passed after fixing a stale icon-upload test. Also [39742174061](https://github.com/helloskyorigin/Warpvio/actions/runs/39742174061) passed after macOS workflow correction | Automated check run |

### Fixes made to enable successful builds

- **Android:** reject line breaks in app names, matching strict validated CLI input.
- **macOS:** repair a Bash array count expression that caused the DMG integrity step to fail **after** both DMGs had compiled.
- **Main CI:** update a security test to include the required icon byte count; unauthenticated requests still remain denied.

### What has NOT yet passed

- Installing and launching the EXE/APK/DMG on real Windows/Android/macOS devices.
- Real-world OAuth/navigation, permission, file upload/download and payment compatibility tests.
- Windows code signing, Android release signing, Apple Developer ID signing and notarization.
- Private per-customer build queues, domain ownership through deployed API, durable paid entitlement, short-lived download recovery, refund/revocation, and end-to-end real payments.
- Browser/API smoke test against deployed Vercel origin. Vercel reported deployment **READY** (ID `dpl_8rfAAEbgxPk9qpCb6RyaCiRDg1kW`, production alias `warpvio.vercel.app`) but direct inspection returned a Vercel team-scope 403; frontend/function HTTP health was not independently checked.

### Vercel deployment record

- Project: `warpvio`
- Vercel project ID: `prj_1Hdf0m4S3bozfJmSIA8pBgFMdA2X`
- Deployed commit: `dc2587e187d05113ea680900bbcc86c5d69ab534` (subsequent GitHub workflow corrections are newer and require confirmation that Vercel auto-sync works)
- URL: https://warpvio.vercel.app
- Vercel state: READY; public access and live API behavior **not yet verified**.
- Vercel team-project access must be authorized in the connected account before fetching protected deployment logs/URLs. Do not disable security protections just to make the check pass.

### Customer protection

Do not enable Dodo live charging; the unsigned/debug QA binaries are not production deliverables. Complete [production launch checklist](./production-launch-checklist.md) before taking money.

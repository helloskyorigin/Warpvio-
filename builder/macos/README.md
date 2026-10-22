# Warpvio macOS DMG builder — developer QA

This source produces **unsigned / unnotarized** DMG test packages for **Apple Silicon (arm64)** and **Intel (x64)** via macOS GitHub Actions runners. It reuses Warpvio's sandboxed Electron website shell and a generated PNG converted to ICNS using sips + iconutil. The website stays online.

**This is not a public paid export**. Apple Gatekeeper is expected to block or warn about unsigned/unnotarized apps. A paid distributable app requires an Apple Developer ID certificate and notarization, along with proper release testing and signed updates.

## Trigger QA builds

[Open macOS QA workflow](https://github.com/helloskyorigin/Warpvio/actions/workflows/macos-qa.yml). Choose Run workflow on main, enter **a public HTTPS website you own or may package**, a safe app name, accent color, and standard/compact window.

A push changing builder/macos or shared desktop shell code triggers a smoke build using https://example.com/ automatically. Upon successful builds, two separate temporary artifacts are uploaded: arm64 DMG and x64 DMG. The actual workflow and installed DMGs must be inspected; a code commit alone is not proof of a successful installer.

## Local build on macOS

Requires macOS, Node 22+, sips and iconutil (Apple), plus pinned npm dependencies.

~~~sh
cd builder/macos
node --test
node scripts/prepare.cjs --url https://example.com/ --name "My Example App" --accent blue --size standard
node scripts/make-icns.cjs
npm install --no-audit --no-fund
npm run build:mac -- --arm64
~~~

Output is builder/macos/dist/*.dmg. Run for x64 separately. Local custom developer icon uses --icon /path/to/256x256.png; browser icon uploads are NOT connected to this CI.

## QA security / limitations

- HTTPS only, original website origin only, no Node integration, no Electron preload, no window popups, no sensitive permissions, no downloads or cross-site authentication redirects
- Original website is not cached; an internet connection is required
- No domain ownership verification, user account, customer-specific signing, authenticated build jobs, durable paid orders or private download links
- GitHub Actions artifacts in this **public repository** must not be used for private customer files or secrets
- Mac QA config explicitly disables production signing and notarization
- Device testing on Apple Silicon and Intel hardware is required
- **Never distribute unsigned macOS DMGs as paid production exports**

This is a developer-only milestone ahead of secure, signed customer delivery.

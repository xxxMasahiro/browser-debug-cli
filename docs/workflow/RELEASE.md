# RELEASE.md

## Current Status

Browser Debug CLI is not released. The repository has local MVP runtime coverage and local package dry-run verification only.

## Local Release Readiness Checks

Run these checks before any public release work is proposed:

```bash
npm test
npm run test:browser
npm run test:pack
./tools/product-gate
```

The package dry-run uses an ignored local npm cache and must not publish:

```bash
npm pack --dry-run --json --cache .tmp/npm-cache
```

## Release Blockers

- Confirm the public npm package name and optional scope.
- Choose a release license and replace `UNLICENSED` only after approval.
- Create the public GitHub repository only after approval.
- Add CI only after approval.
- Confirm npm account, token handling, and publication method only after approval.
- Do not upload traces, screenshots, session files, cookies, storage state, credentials, or `.browser-debug/` artifacts.

## Non-Goals Before Approval

- No `npm publish`.
- No `gh repo create`.
- No remote setup or push.
- No GitHub Actions workflow execution.
- No OAuth, login automation, webhook setup, external upload, or credential storage.

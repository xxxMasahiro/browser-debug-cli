# RELEASE.md

## Current Status

Browser Debug CLI is not released. The repository has local MVP runtime coverage, Phase 7 review-platform coverage, Phase 8 dogfood/plugin-readiness coverage, Phase 9 local review-quality coverage, Phase 10 route-readiness coverage, Phase 11 page-expectation and artifact-index coverage, Phase 12 rendered-state dogfood hardening coverage, a public GitHub repository, remote `main` synchronization, passing GitHub Actions `main` CI, CI manifest validation, and local package dry-run verification.

## Local Release Readiness Checks

Run these checks before any public release work is proposed:

```bash
npm test
npm run test:browser
npm run test:pack
npm run release:check
./tools/check_product_ci.sh
./tools/product-gate
```

The package dry-run uses an ignored local npm cache and must not publish:

```bash
npm pack --dry-run --json --cache .tmp/npm-cache
```

## Release Blockers

- Confirm the public npm package name and optional scope.
- Choose a release license and replace `UNLICENSED` only after approval.
- Confirm npm account, token handling, and publication method only after approval.
- Decide whether and where to register the local Codex plugin bundle.
- Treat `quality_signals.release_readiness` as a local review gate only; it does not authorize package publication or marketplace registration.
- Treat `artifact_index` as local artifact inventory and rerun guidance only; it does not authorize evidence transfer.
- Do not upload traces, screenshots, session files, cookies, storage state, credentials, or `.browser-debug/` artifacts.
- Keep model/API review, evidence leaving the local process, HTTP/socket MCP server mode, OAuth/login automation, and external upload approval-bound.

## Non-Goals Before Approval

- No `npm publish`.
- No OAuth, login automation, webhook setup, external upload, or credential storage.
- No model/API review or evidence upload.
- No HTTP/socket MCP server mode.
- No plugin marketplace registration or installation-state mutation.

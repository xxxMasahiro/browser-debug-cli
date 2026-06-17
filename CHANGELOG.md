# Changelog

All notable local development changes are tracked here before public release.

## Unreleased

- Added the local `browser-debug` CLI package scaffold.
- Added deterministic JSON envelopes and CLI parsing.
- Added `doctor` for local environment and safety checks.
- Added Playwright-backed `observe` with ephemeral Chromium contexts.
- Added local observation, screenshot, trace, session, report, and spec artifacts under ignored `.browser-debug/`.
- Added `session start`, `session close`, `act`, `report`, and `spec export`.
- Added browser smoke coverage for observation, screenshots/traces, actions, forms, keyboard input, deterministic scroll, reports, and spec export.
- Added headed/devtools launch-mode regression coverage without requiring a GUI display.
- Added local package dry-run verification with `npm run test:pack`.
- Added `supervise` for one process-scoped ephemeral browser context with ordered actions.
- Added `daemon start`, `daemon status`, and `daemon stop` for local background ephemeral browser supervision.
- Added architecture regressions for generic runtime boundaries, shared page evidence helpers, and local Node CLI packaging.
- Added local GitHub Actions CI configuration and `ops/CI_MANIFEST.tsv` with a product-local CI validation check.
- Added `npm run release:check` for local release-readiness verification without publishing.
- Added explicit JSON schema-versioning and manual artifact-retention policy metadata to `doctor`.

## Release Status

No public package has been released. Public GitHub repository creation, remote CI execution, package naming, license selection, npm authentication, and npm publication remain explicit release blockers.

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

## Release Status

No public package has been released. Public GitHub repository creation, CI setup, package naming, license selection, npm authentication, and npm publication remain explicit release blockers.

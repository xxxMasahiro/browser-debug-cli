# TASK_TRACKER.md

## Current Status

Phase 5 local MVP runtime implementation is complete after Phase 1 and Phase 2a. Phase 0 scaffold and document sync are complete, local Git is initialized, the initial scaffold commit exists, local CI configuration is present, and product-gate evidence has been recorded locally.

This file is paired with `docs/workflow/HANDOFF.md`. Keep the TASK_TRACKER and HANDOFF workflow-state pair synchronized whenever task state changes.

## Completed Work

- [x] Chosen product directory: `/home/masahiro/projects/agent-toolbox/browser-debug-cli`.
- [x] Chosen product direction: OSS browser debugging CLI built on Playwright without MCP runtime dependency.
- [x] Documented headless and headed browser roles.
- [x] Documented future Git, GitHub, CI, npm, MVP, and release phases.
- [x] Created initial requirements, specification, implementation plan, tracker, and handoff drafts.
- [x] Installed product-local skills, tools, ops manifests, evidence-detail manifest, `src/`, and `tests/`.
- [x] Ran product-local gate successfully.
- [x] Ran lesson-side scaffold, authority, and workflow-pair checks successfully.
- [x] Confirmed `AGENTS.MD` is the root agent entry and no legacy `AGENT.md` exists.
- [x] Confirmed `ops/PRODUCT_PROFILE.json` keeps `menu_id=free-development` and display name `Browser Debug CLI`.
- [x] Confirmed `ops/PRODUCT_OPERATION_MODE.tsv` keeps `parent_managed` and `managed_by_parent=true`.
- [x] Initialized local Git and renamed the initial branch to `main`.
- [x] Created the first scaffold commit.
- [x] Recorded product-gate evidence under `.git/product-gate-evidence/`.
- [x] Started Phase 2a package/runtime design without GitHub creation, dependency installation, browser launch, CI, or npm publication.
- [x] Selected `browser-debug` as the working CLI binary name.
- [x] Recorded the Node.js 20+, ESM, local-first, ephemeral-context design baseline.
- [x] Defined the first implementation slice as `doctor`, command parsing, deterministic JSON errors, and focused tests.
- [x] Defined the first Playwright slice as one-shot `observe --url <url> --json` with artifact-safe local output.
- [x] Ran `./tools/product-gate` for Phase 2a design verification.
- [x] Added private local `package.json` with the `browser-debug` executable.
- [x] Implemented no-browser CLI parsing, deterministic JSON envelopes, and `doctor`.
- [x] Added focused `node:test` coverage for `doctor`, missing commands, `observe` validation, planned stubs, and session parsing.
- [x] Updated product manifests and aggregate product-gate wiring to include `npm test`.
- [x] Verified `npm test`, `./tools/product-gate`, `git diff --check`, `doctor --json`, and the no-browser `observe` stub.
- [x] Installed the Playwright runtime dependency.
- [x] Implemented Playwright-backed `observe --url <url> --json` with ephemeral Chromium contexts.
- [x] Implemented local artifact handling for observations, screenshots, sessions, reports, and spec exports under ignored `.browser-debug/`.
- [x] Implemented `observe --trace` with local Playwright trace zip artifacts and trace-content warnings.
- [x] Implemented `session start`, `session close`, simple `act`, `report`, and `spec export`.
- [x] Implemented `supervise --url <url> --actions <json-array>` for process-scoped ephemeral browser supervision.
- [x] Added browser smoke tests for local file observation and click actions.
- [x] Strengthened browser smoke coverage for form controls, keyboard input, deterministic scroll, wait actions, screenshots, reports, and spec export.
- [x] Added deterministic headed/devtools launch-mode regression coverage without requiring a GUI display.
- [x] Added `npm run test:pack` local package dry-run verification and aggregate gate wiring.
- [x] Added local release readiness notes in `CHANGELOG.md` and `docs/workflow/RELEASE.md`.
- [x] Added browser smoke coverage for supervised ordered actions in one ephemeral context.
- [x] Added architecture regression coverage for generic runtime boundaries, shared evidence helpers, and local Node CLI packaging.
- [x] Added local GitHub Actions CI configuration and `ops/CI_MANIFEST.tsv`.
- [x] Added `tools/check_product_ci.sh` and wired it into product-local aggregate checks.
- [x] Added `npm run release:check` for local release-readiness verification without publishing.
- [x] Verified the running Dashboard Control Center at `http://127.0.0.1:5173/` with screenshot and trace capture.
- [x] Confirmed `http://127.0.0.1:5174/` was not listening during verification.
- [x] Re-ran product-local `./tools/product-gate`, `npm test`, `npm run test:browser`, and `git diff --check`.
- [x] Re-ran lesson-side product scaffold, product repository authority, and workflow-pair checks successfully.

## Remaining Work

No remaining local MVP implementation work is currently planned.

## Future Approval-Bound Work

- [ ] If approved later, implement background browser daemon supervision.
- [ ] If approved later, run real headed visual regression checks in an environment with a display.
- [ ] If approved later, create the public GitHub repository with `gh`.
- [ ] If approved later, choose the public package name and license.
- [ ] If approved later, create the remote repository, push, and observe remote GitHub Actions execution.
- [ ] If approved later, publish the npm package after release checklist, CI, package name, license, and credential handling are complete.

## Next Step

Ask for explicit approval before background browser daemon supervision, trace capture expansion, authentication automation, external upload, existing-browser-profile reuse, credential storage, GitHub repository creation, remote setup, push, remote CI execution, public package naming, license changes, or npm publication.

## Stop Conditions

- Runtime Playwright implementation is requested before Phase 0 checks pass.
- GitHub public repository creation is requested without explicit approval.
- npm publish is requested before CI and release planning exist.
- Any secret, cookie, storage state, or credential-like data appears in repository files.
- A design change would require existing browser profile reuse, credential storage, OAuth, webhooks, external upload, or arbitrary shell execution without a security plan and approval.

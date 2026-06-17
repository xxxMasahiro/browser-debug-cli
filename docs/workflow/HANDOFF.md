# HANDOFF.md

## Current State

Browser Debug CLI has completed Phase 1, Phase 2a package/runtime design verification, and the Phase 5 local MVP runtime slice. Phase 0 scaffold and document sync are complete, local Git is initialized, the initial scaffold commit exists, and product-gate evidence has been recorded locally.

This file is paired with `docs/workflow/TASK_TRACKER.md`. Keep the HANDOFF and TASK_TRACKER workflow-state pair synchronized whenever task state changes.

## What Has Been Decided

- Product name: Browser Debug CLI.
- Repository path: `/home/masahiro/projects/agent-toolbox/browser-debug-cli`.
- Main purpose: local Playwright-based browser debugging and UI/UX inspection for humans and AI agents.
- Main design choice: agent-independent CLI, not Playwright MCP.
- Debug strategy: fast headless observation by default, headed browser or DevTools for important visual and interaction checks.
- OSS path: local Git, GitHub through `gh`, CI, npm packaging, MVP implementation, release.
- Product-local gate passed.
- Lesson-side scaffold, authority, and workflow-pair checks passed.
- Root agent entry is `AGENTS.MD`; legacy `AGENT.md` is absent.
- `ops/PRODUCT_PROFILE.json` remains `menu_id=free-development` with display name `Browser Debug CLI`.
- `ops/PRODUCT_OPERATION_MODE.tsv` remains `parent_managed` with `managed_by_parent=true`.
- Local Git has been initialized and the initial branch is `main`.
- The first scaffold commit exists.
- Product-gate evidence is recorded under `.git/product-gate-evidence/`.
- Phase 2a uses `browser-debug` as the working CLI binary name.
- Phase 2a uses Node.js 20 or newer, ESM modules, local-first execution, and ephemeral browser contexts by default.
- The first implementation slice should be `doctor`, command parsing, deterministic JSON errors, and focused tests.
- The first Playwright slice should be one-shot `observe --url <url> --json` with artifacts under ignored `.browser-debug/`.
- Long-running browser supervision remains opt-in and later than one-shot observation.
- Phase 2a design verification passed with `./tools/product-gate`.
- The repository now has private local package metadata, `bin/browser-debug.js`, ESM source modules, and `tests/cli.test.js`.
- `doctor`, command parsing, deterministic JSON errors, and planned no-browser stubs are implemented.
- `observe --url <url> --json` validates input, launches an ephemeral Chromium context, captures structured page state, writes local artifacts, and closes the context.
- `npm test` is wired into `./tools/test_product_repository.sh` and `./tools/product-gate`.
- Local verification passed with `npm test`, `./tools/product-gate`, `git diff --check`, `doctor --json`, and the no-browser `observe` stub.
- Playwright is installed as a runtime dependency.
- `session start`, `session close`, simple `act`, `report`, and `spec export` are implemented with local file-backed session metadata.
- `npm run test:browser` passed for local file observation and click action smoke coverage.
- `observe --trace` is implemented and writes local Playwright trace zip artifacts with a page-content warning.
- Dashboard Control Center `http://127.0.0.1:5173/` was observed successfully with screenshot and trace artifacts.
- FrameCue Control Center `http://127.0.0.1:5174/` was not listening during verification.
- Final local verification passed with `npm test`, `npm run test:browser`, `./tools/product-gate`, `git diff --check`, lesson-side product scaffold check, lesson-side product repository authority status, and lesson-side workflow-pair sync check.

## Next Step

Ask for explicit approval before long-running browser supervision, authentication automation, external upload, existing-browser-profile reuse, credential storage, GitHub repository creation, remote setup, push, CI, or npm publication. If local runtime work continues, the next useful slice is headed/devtools regression coverage plus stronger action/spec coverage.

## Restart Notes

- Do not create a GitHub repository yet.
- Do not publish to npm yet.
- Keep `.browser-debug/`, screenshots, traces, storage state, cookies, credentials, and secret-like data out of committed files.
- Do not reuse existing browser profiles, persist storage state, automate OAuth/login flows, or upload artifacts without a security plan and approval.
- If product workflow commands need lesson context, use the product path explicitly to avoid mixing this repository with `task-tracker-repository`.

## Stop Conditions

- Missing canonical docs under `docs/product/` or `docs/workflow/`.
- Root-level duplicate product documents.
- Any committed secret-like data.
- External service, OAuth, webhook, browser profile reuse, or artifact upload requested without a security plan and approval.
- Any design path that requires arbitrary shell execution or persistent credential storage.

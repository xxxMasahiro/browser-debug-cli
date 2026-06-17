# Browser Debug CLI

Browser Debug CLI is a planned OSS command-line tool for AI-assisted browser debugging and UI/UX inspection.

The goal is to provide an agent-independent Playwright interface that can observe page state, suggest or execute browser actions, collect evidence, and generate reports without depending on Playwright MCP or any single AI agent runtime.

## Planned Use

- Debug web applications through structured page observations.
- Let an AI or human choose the next browser action from machine-readable candidates.
- Find UI/UX issues, functional defects, broken flows, missing states, and accessibility problems.
- Collect screenshots, traces, and notes for reproducible fixes.
- Use fast headless mode by default, with headed browser and DevTools support for visual quality checks.

## Current Status

This repository has completed the Free Development scaffold, local Git initialization, Phase 2a package/runtime design, and the local MVP runtime slice. The current CLI supports `doctor`, deterministic JSON errors, Playwright-backed one-shot `observe`, headed/devtools launch modes, local artifacts, session metadata, simple actions, process-scoped supervision, local background daemon start/status/stop, screenshots/traces, reports, and spec export.

## Local CLI

```bash
node ./bin/browser-debug.js doctor --json
node ./bin/browser-debug.js observe --url http://127.0.0.1:3000/ --screenshot --trace --json
node ./bin/browser-debug.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --json
node ./bin/browser-debug.js daemon start --url http://127.0.0.1:3000/ --json
node ./bin/browser-debug.js daemon status --daemon <id> --json
node ./bin/browser-debug.js daemon stop --daemon <id> --json
npm test
npm run test:browser
npm run test:pack
npm run release:check
```

Artifacts are written under ignored `.browser-debug/` directories and are retained until the developer manually removes that local artifact root. Trace artifacts can contain page content and must remain local. `supervise` keeps one ephemeral browser context alive only for that CLI process and closes it before exit. `daemon start` keeps a local ephemeral browser worker alive until `daemon stop` and controls it only through local process signals and metadata. `npm test` runs deterministic no-browser tests; `npm run test:browser` launches local Chromium for smoke coverage; `npm run test:pack` runs a local dry-run package check without publishing; `npm run release:check` combines no-browser and package checks without publishing.

## Canonical Documents

- `docs/product/REQUIREMENTS.md`
- `docs/product/SPECIFICATION.md`
- `docs/product/IMPLEMENTATION_PLAN.md`
- `docs/workflow/TASK_TRACKER.md`
- `docs/workflow/HANDOFF.md`

## Local Checks

```bash
./tools/product-gate
./tools/check_product_ci.sh
```

GitHub Actions CI is defined locally in `.github/workflows/ci.yml` and validated by `ops/CI_MANIFEST.tsv`; it has not been executed remotely because no public repository or remote has been created.
Release status and publication blockers are tracked in `CHANGELOG.md` and `docs/workflow/RELEASE.md`.

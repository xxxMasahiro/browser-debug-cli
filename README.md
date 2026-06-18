# Browser Debug CLI

Browser Debug CLI is an unreleased OSS command-line tool for AI-assisted browser debugging, UI/UX inspection, and local deterministic browser review.

The goal is to provide an agent-independent Playwright interface that can observe page state, suggest or execute browser actions, collect evidence, and generate reports without depending on Playwright MCP or any single AI agent runtime.

## Planned Use

- Debug web applications through structured page observations.
- Let an AI or human choose the next browser action from machine-readable candidates.
- Find UI/UX issues, functional defects, broken flows, missing states, and accessibility problems.
- Collect screenshots, traces, and notes for reproducible fixes.
- Use fast headless mode by default, with headed browser and DevTools support for visual quality checks.
- Run deterministic local review findings for browser health, layout integrity, interaction quality, accessibility basics, and conservative mock metrics.
- Generate target manifests for whole-app route and viewport review, including explicit `expectedRoutes` and optional page expectations.
- Return action plans, implementation-focused fix candidates, local heuristic review advisory data, and structured quality signals for developer handoff.
- Flag rendered-state issues such as broken images, explicit lingering loading indicators, and empty data containers without empty-state copy.
- Suggest manifest improvements when a target review needs pinned routes, named page expectations, or a larger route budget.
- Use the same CLI/core contract from a local stdio MCP adapter when an MCP client is useful.

## Current Status

This repository has completed the Free Development scaffold, local Git initialization, Phase 2a package/runtime design, the local MVP runtime slice, the Phase 7 local review-platform slice, the Phase 8 local dogfood/plugin-readiness slice, the Phase 9 local review-quality slice, the Phase 10 manifest route-readiness slice, the Phase 11 page-expectation review slice, the Phase 12 rendered-state dogfood hardening slice, and the Phase 13 dogfood signal refinement slice. The current CLI supports `doctor`, deterministic JSON errors, Playwright-backed one-shot `observe`, headed/devtools launch modes, local artifacts, session metadata, simple actions, process-scoped supervision, local background daemon start/status/stop, screenshots/traces, reports, spec export, deterministic `review`, target-manifest site review, target manifest initialization, action plans, local heuristic review advisory data, local quality signals, rendered-state findings, manifest suggestions, page expectation checks, local review artifact indexes, schema commands, shell-safe structured input, and a local stdio MCP adapter.

## Local CLI

```bash
node ./bin/browser-debug.js doctor --json
node ./bin/browser-debug.js observe --url http://127.0.0.1:3000/ --screenshot --trace --json
node ./bin/browser-debug.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --json
node ./bin/browser-debug.js daemon start --url http://127.0.0.1:3000/ --json
node ./bin/browser-debug.js daemon status --daemon <id> --json
node ./bin/browser-debug.js daemon stop --daemon <id> --json
node ./bin/browser-debug.js target init --url http://127.0.0.1:3000/ --json
node ./bin/browser-debug.js review --url http://127.0.0.1:3000/ --viewport mobile --screenshot --report --json
node ./bin/browser-debug.js review --target ./browser-debug-target.json --json
node ./bin/browser-debug.js schema list --json
node ./bin/browser-debug.js schema get --name review --json
node ./bin/browser-debug.js mcp serve --json
node ./bin/browser-debug-mcp.js
npm test
npm run test:browser
npm run test:pack
npm run release:check
```

Artifacts are written under ignored `.browser-debug/` directories and are retained until the developer manually removes that local artifact root. Trace artifacts can contain page content and must remain local. Review artifacts include local target manifests, review JSON, layout JSON, screenshots, mock metrics, coverage, review artifact indexes, action plans, local heuristic advisory data, local quality signals, and Markdown reports when requested. Quality signals summarize visual hierarchy, rendered state, responsive layout, interaction affordance, accessibility structure, evidence completeness, route budget coverage, page expectations, local release readiness, developer handoff, and the disabled model-review boundary. `review --url` can flag broken visible images, explicit lingering loading UI, and empty table/list/grid states as local evidence-backed first-pass findings while avoiding normal ready/progress business-state text. `review --target` visits manifest `expectedRoutes` within scope, can check optional `pages` expectations for visible text and selectors, can apply page-specific mock metrics, records route-budget-exceeded skips when `budgets.maxRoutes` prevents full coverage, and emits manifest suggestions for better dogfood reruns. `supervise` keeps one ephemeral browser context alive only for that CLI process and closes it before exit. `daemon start` keeps a local ephemeral browser worker alive until `daemon stop` and controls it only through local process signals and metadata. The MCP adapter is local stdio-only and does not expose HTTP/socket listeners, shell tools, cleanup tools, external upload, profile reuse, OAuth, or credential handling. The repository also contains plugin metadata under `.codex-plugin/`, `.mcp.json`, and `skills/browser-debug-review/`; marketplace installation, license changes, and npm publication remain separate approval-bound release work. `npm test` runs deterministic no-browser tests; `npm run test:browser` launches local Chromium for smoke coverage; `npm run test:pack` runs a local dry-run package check without publishing; `npm run release:check` combines no-browser and package checks without publishing.

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

GitHub Actions CI is defined in `.github/workflows/ci.yml`, validated by `ops/CI_MANIFEST.tsv`, and passing on `origin/main` at `https://github.com/xxxMasahiro/browser-debug-cli`.
Release status and publication blockers are tracked in `CHANGELOG.md` and `docs/workflow/RELEASE.md`.

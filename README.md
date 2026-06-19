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
- Validate edited target manifests before launching a browser, including route, page, content UX, and local boundary counts.
- Return action plans, implementation-focused fix candidates, local heuristic review advisory data, and structured quality signals for developer handoff.
- Flag rendered-state issues such as broken images, explicit lingering loading indicators, and empty data containers without empty-state copy.
- Suggest manifest improvements when a target review needs pinned routes, named page expectations, or a larger route budget.
- Opt into local content UX advisory from a target manifest to compare bounded inline source facts, selector-scoped UI state, and required user-question evidence without changing review gates.
- Emit separate `content_ux_findings`, `content_ux_action_plan`, and `content_ux_readiness` handoff data while preserving existing review findings, action plans, metrics, and release readiness.
- Review content UX findings by page, status clarity, action clarity, navigation clarity, information architecture, and manifest-authoring gaps.
- Evaluate manifest-declared content UX review briefs and rubric criteria with separate `content_ux_review_brief` and `content_ux_rubric_evaluation` outputs.
- Run a no-browser local resource status preflight before browser-heavy work, including memory, swap, cgroup, pressure, and process memory signals.
- Guard browser-heavy reviews with local resource preflight/recheck output, optional fail-critical stopping, and screenshot/trace pressure warnings without changing review findings or release gates.
- Monitor `.browser-debug/` artifact size and run explicit local artifact cleanup with receipts when the developer chooses `--execute`.
- Bound local background daemons with optional idle-timeout and max-lifetime lifecycle metadata.
- Package local review evidence for subscription or local AI agent handoff, track local agent workflows for dashboards and automation, import untrusted agent advisory JSON, and render advisory reports without changing deterministic review gates.
- Run bounded agent execution through dry-run plans, explicit execution gating, deterministic fake providers, configured local runner callbacks, env-only API adapters, bounded disclosure, local receipts, and advisory-only result boundaries.
- Use the same CLI/core contract from a local stdio MCP adapter when an MCP client is useful.

## Current Status

This repository has completed the Free Development scaffold, local Git initialization, Phase 2a package/runtime design, the local MVP runtime slice, the Phase 7 local review-platform slice, the Phase 8 local dogfood/plugin-readiness slice, the Phase 9 local review-quality slice, the Phase 10 manifest route-readiness slice, the Phase 11 page-expectation review slice, the Phase 12 rendered-state dogfood hardening slice, the Phase 13 dogfood signal refinement slice, the Phase 14 content UX advisory slice, the Phase 15 content UX heuristic strengthening slice, the Phase 16 content UX handoff output slice, the Phase 17 content UX practical handoff slice, the Phase 18 content UX review brief/rubric slice, the Phase 19 local target manifest validation slice, the Phase 20 local resource status preflight slice, the Phase 21-24 local resource safety slice, the Phase 25 local agent advisory handoff slice, the Phase 26 local agent request status slice, the Phase 27 local agent request detail slice, the Phase 28 local agent workflow status slice, and the Phase 29 agent execution integration for dry-run planning, explicit `--execute` plus `--execution` run gating, isolated provider adapters, deterministic fake provider execution, configured local runner callbacks, env-only generic API execution, local status/list fields, schema/API parity, local receipts, advisory normalization, no raw provider response storage, and no credential value recording. The current CLI supports `doctor`, deterministic JSON errors, Playwright-backed one-shot `observe`, headed/devtools launch modes, local artifacts, session metadata, simple actions, process-scoped supervision, local background daemon start/status/stop with optional lifecycle guards, no-browser `resource status`, no-browser `resource artifacts plan`, explicit `.browser-debug/` cleanup receipts, screenshots/traces, reports, spec export, deterministic `review` with additive `resource_guard` output, target-manifest site review, target manifest initialization, target manifest validation, action plans, local heuristic review advisory data, local quality signals, rendered-state findings, manifest suggestions, opt-in content UX advisory, selector-scoped content/state/risk checks, required user-question checks, dedicated content UX findings/action/readiness handoff output, page-level content UX handoff, content UX manifest-authoring suggestions, content UX review brief/rubric evaluation, page expectation checks, local review artifact indexes, agent advisory package/request-status/request-detail/workflow/ingest/report commands, agent execution plan/run/status/list commands, schema commands, shell-safe structured input, reusable target manifest templates, and a local stdio MCP adapter.

## Local CLI

```bash
node ./bin/browser-debug.js doctor --json
node ./bin/browser-debug.js observe --url http://127.0.0.1:3000/ --screenshot --trace --json
node ./bin/browser-debug.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --json
node ./bin/browser-debug.js daemon start --url http://127.0.0.1:3000/ --idle-timeout 15m --max-lifetime 2h --json
node ./bin/browser-debug.js daemon status --daemon <id> --json
node ./bin/browser-debug.js daemon stop --daemon <id> --json
node ./bin/browser-debug.js resource status --json
node ./bin/browser-debug.js resource artifacts plan --json
node ./bin/browser-debug.js resource artifacts cleanup --dry-run --json
node ./bin/browser-debug.js resource artifacts cleanup --execute --json
node ./bin/browser-debug.js agent surfaces list --json
node ./bin/browser-debug.js agent package --review-index .browser-debug/review-artifacts/<id>.json --surface local-subscription-agent --json
node ./bin/browser-debug.js agent requests list --json
node ./bin/browser-debug.js agent requests show --package .browser-debug/agent-packages/<id>/packet.json --json
node ./bin/browser-debug.js agent workflow create --package .browser-debug/agent-packages/<id>/packet.json --json
node ./bin/browser-debug.js agent workflow status --workflow .browser-debug/agent-workflows/<id>/workflow.json --json
node ./bin/browser-debug.js agent workflow index --json
node ./bin/browser-debug.js agent workflow report --workflow .browser-debug/agent-workflows/<id>/workflow.json --json
node ./bin/browser-debug.js agent execution plan --package .browser-debug/agent-packages/<id>/packet.json --surface local-subscription-agent --provider fake-agent --model fake-model --json
node ./bin/browser-debug.js agent execution run --execution .browser-debug/agent-executions/<id>/execution.json --package .browser-debug/agent-packages/<id>/packet.json --surface local-subscription-agent --provider fake-agent --model fake-model --execute --json
node ./bin/browser-debug.js agent execution status --execution .browser-debug/agent-executions/<id>/execution.json --json
node ./bin/browser-debug.js agent execution list --json
node ./bin/browser-debug.js agent ingest --package .browser-debug/agent-packages/<id>/packet.json --input @agent-advisory-result.json --json
node ./bin/browser-debug.js agent report --review-index .browser-debug/review-artifacts/<id>.json --agent-result .browser-debug/agent-results/<id>.json --json
node ./bin/browser-debug.js target init --url http://127.0.0.1:3000/ --json
node ./bin/browser-debug.js target validate --target .browser-debug/targets/<id>.json --json
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

Artifacts are written under ignored `.browser-debug/` directories and are retained until the developer manually removes that local artifact root or explicitly runs `.browser-debug/`-scoped cleanup with `resource artifacts cleanup --execute`. Trace artifacts can contain page content and must remain local. Review artifacts include local target manifests, review JSON, layout JSON, screenshots, mock metrics, coverage, review artifact indexes, action plans, local heuristic advisory data, local quality signals, optional content UX advisory, optional content UX handoff output, optional content UX review brief/rubric output, additive `resource_guard` output, and Markdown reports when requested. Agent advisory artifacts include local task packages, prompts, workflow manifests, request status/detail derived from local package/result artifacts, normalized advisory results, import receipts, workflow receipts, and Markdown advisory reports. Advisory package/request/workflow/ingest/report operations are local-only, do not run provider APIs, do not upload artifacts, do not store credentials, and do not change deterministic review findings, metrics, existing action plans, or release readiness. Agent execution artifacts include dry-run execution plans, run receipts, dashboard status/list metadata, and normalized advisory results from provider adapters; execution requires a matching plan plus explicit `--execute`, keeps raw provider responses and credential values out of artifacts, and remains separate from review gates. `agent workflow create/status/index/report` lets dashboards track package-created, waiting-for-agent, imported-result, report-pending states, and local workflow summaries from local files only. `resource status` reads local memory, swap, cgroup, pressure, and process memory signals without launching a browser, writing artifacts, deleting caches, mutating swap, mutating system cache, uploading evidence, or reusing profiles. `resource artifacts plan` reports local artifact usage and cleanup candidates without deleting files; `resource artifacts cleanup --execute` deletes only selected regular files under the configured artifact root and writes a local receipt. `target validate` checks edited target manifests without launching a browser, mutating the manifest, uploading evidence, reusing profiles, or printing sourceData values. Quality signals summarize visual hierarchy, rendered state, responsive layout, interaction affordance, accessibility structure, evidence completeness, route budget coverage, page expectations, optional content UX advisory, local release readiness, developer handoff, and the disabled model-review boundary. `review --url` can flag broken visible images, explicit lingering loading UI, and empty table/list/grid states as local evidence-backed first-pass findings while avoiding normal ready/progress business-state text. `review --resource-guard fail-critical` can stop before browser launch when local resource status is critical; the default advisory mode reports resource pressure without changing review findings, `metrics.finding_count`, existing action plans, or release readiness. `review --target` visits manifest `expectedRoutes` within scope, can check optional `pages` expectations for visible text and selectors, can apply page-specific mock metrics, records route-budget-exceeded skips when `budgets.maxRoutes` prevents full coverage, emits manifest suggestions for better dogfood reruns, and can emit `local_content_ux_advisory`, `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, `content_ux_page_handoff`, `content_ux_manifest_authoring`, `content_ux_review_brief`, and `content_ux_rubric_evaluation` only when `localContentUxAdvisory.enabled=true` is declared in the target manifest. Content UX advisory uses bounded inline `sourceData`, page `expectations.dataBindings`, optional selectors, attribute/state/risk targets, `requiredUserQuestions`, optional `reviewBrief`, and optional `rubric`; it is advisory-only and does not change review findings, metrics, existing action plans, or release readiness. `supervise` keeps one ephemeral browser context alive only for that CLI process and closes it before exit. `daemon start` keeps a local ephemeral browser worker alive until `daemon stop`, optional idle timeout, or optional max lifetime, and controls it only through local process signals and metadata. The MCP adapter is local stdio-only and does not expose HTTP/socket listeners, shell tools, cleanup execution tools, external upload, profile reuse, OAuth, credential handling, or agent/API execution tools. The repository also contains plugin metadata under `.codex-plugin/`, `.mcp.json`, and `skills/browser-debug-review/`; marketplace installation, license changes, and npm publication remain separate approval-bound release work. `npm test` runs deterministic no-browser tests; `npm run test:browser` launches local Chromium for smoke coverage; `npm run test:pack` runs a local dry-run package check without publishing; `npm run release:check` combines no-browser and package checks without publishing.

Phase 29 agent execution stays separate from the current advisory workflow. It adds dry-run execution plans, explicit `--execute` plus `--execution` run gating, isolated provider adapters, deterministic fake provider execution, configured local runner callbacks, env-only generic API execution, execution status/list records, schema/API parity, dashboard handoff metadata, local receipts, and normalized advisory results without changing deterministic review findings, metrics, existing action plans, release readiness, resource guard output, artifact cleanup behavior, or existing workflow status meanings. API execution remains limited to bounded package/prompt disclosure through the generic adapter; provider SDK expansion, persistent credentials, raw provider response storage, MCP execution exposure, and broader external evidence transfer remain approval-bound.

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

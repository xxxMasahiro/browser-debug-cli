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
- Created the public GitHub repository, synchronized `main`, and confirmed remote `main` CI.
- Updated GitHub Actions checkout and Node setup actions to v5.
- Added Phase 7 deterministic `review` command for single-URL browser review with local observation, layout, screenshot, report, and mock-metric artifacts.
- Added target-manifest site review with generic route discovery, viewport execution, coverage artifacts, and bounded findings.
- Added machine-readable schema files plus `schema list` and `schema get`.
- Added shell-safe structured input for stdin and `@file` action/target inputs.
- Added local stdio MCP adapter entrypoint `browser-debug-mcp` with an allowlisted tool surface over the same CLI/core contracts.
- Added public local package API exports and excluded internal product documents from the package file set while keeping the package private.
- Strengthened structure, security, architecture, no-browser, and browser smoke checks for review and MCP boundaries.
- Added `target init` for reusable local target manifest generation.
- Added review `action_plan`, local heuristic `review_advisory`, and developer-facing finding enrichment fields.
- Added target review Markdown reports.
- Added MCP target tools for target manifest initialization and target review.
- Added local Codex plugin metadata, plugin MCP configuration, plugin-facing review skill, and a reusable target manifest template.
- Added review `quality_signals` for visual hierarchy, responsive layout, interaction affordance, accessibility structure, evidence completeness, developer handoff, local release readiness, route coverage, and disabled model-review boundaries.
- Expanded local review heuristics for headings, landmarks, image alt text, low contrast text, visible overlap, and mobile touch-target sizing.
- Added Quality Signals sections to Markdown review reports and browser smoke coverage for the new local review-quality signals.
- Added explicit target review execution for manifest `expectedRoutes`.
- Added target coverage output for expected routes and route-budget-exceeded skips.
- Added browser smoke coverage for unlinked expected routes and route budget skip accounting.
- Added optional target manifest `pages` for named page expectations, page-specific viewports, and page-specific mock metrics.
- Added review `evidence_summary`, local `review_artifact_index` artifacts, and `quality_signals.page_expectations`.
- Added browser smoke coverage for manifest page expectations, page-specific mock metrics, review artifact indexes, and page expectation report output.
- Added rendered-state review evidence and findings for broken visible images, lingering loading indicators, and empty data containers without visible empty-state messaging.
- Added rendered-state quality signals, Developer Triage Markdown report summaries, and target manifest suggestions for dogfood reruns.
- Added browser smoke coverage for rendered-state findings, evidence summaries, developer triage reports, and manifest suggestions.
- Refined loading indicator detection so normal ready/progress business-state text is not reported as lingering loading UI unless explicit loading semantics or loading-like attributes are present.
- Added manifest opt-in content UX advisory with bounded inline `sourceData`, page `expectations.dataBindings`, `local_content_ux_advisory`, and `quality_signals.content_ux`.
- Added schema registry/file parity coverage for review and target manifest contracts.
- Added no-browser and browser smoke coverage proving content UX advisory does not change findings, metrics, action plans, or release readiness.
- Added selector-scoped content UX advisory checks for text, explicit attributes, data-state, and data-risk evidence.
- Added required user-question advisory checks for information architecture and user journey review.
- Added a reusable disabled-by-default Control Center-style content UX target manifest template.

## Release Status

No public package has been released. Package naming, license selection, npm authentication, npm publication, plugin marketplace registration, model/API review, evidence leaving the local process, arbitrary source-data file or URL loaders, HTTP/socket MCP server mode, OAuth/login automation, and external upload remain explicit release blockers.

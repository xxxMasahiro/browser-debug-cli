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
- Added no-browser and browser smoke coverage proving content UX advisory does not change review findings, metrics, existing action plans, or release readiness.
- Added selector-scoped content UX advisory checks for text, explicit attributes, data-state, and data-risk evidence.
- Added required user-question advisory checks for information architecture and user journey review.
- Added a reusable disabled-by-default status-dashboard content UX target manifest template.
- Added separate `content_ux_findings`, `content_ux_action_plan`, and `content_ux_readiness` target-review outputs without changing review findings, metrics, existing action plans, or release readiness.
- Added bounded Content UX Developer Handoff Markdown report output.
- Added expanded content UX advisory categories for status clarity, action clarity, navigation clarity, information architecture, source alignment, content contracts, coverage contracts, and review scope.
- Added separate `content_ux_page_handoff` and `content_ux_manifest_authoring` target-review outputs.
- Added page-level content UX and manifest-authoring summaries to Markdown target reports.
- Added separate `content_ux_review_brief` and `content_ux_rubric_evaluation` target-review outputs for manifest-declared audience, page role, decision-need, and rubric checks.
- Added Content UX Review Brief summaries to Markdown target reports and reusable manifest templates without changing existing review findings, metrics, action plans, or release readiness.
- Replaced the packaged content UX example manifest with a domain-neutral status-dashboard template while preserving selector-scoped state/risk coverage.
- Switched generated/default content UX advisory categories to `status_clarity` and `action_clarity` while keeping legacy rubric category aliases accepted for existing manifests.
- Added `target validate` for no-browser target manifest validation with manifest counts, authoring suggestions, MCP tool coverage, API export, source-value non-disclosure, and local-first boundaries.
- Added `resource status` for no-browser local memory, swap, cgroup, pressure, and process memory preflight with MCP tool coverage, API export, warnings, recommendations, and read-only local-first boundaries.
- Added review `resource_guard` integration with preflight, target route/viewport rechecks, screenshot/trace pressure warnings, and opt-in `fail-critical` stopping before browser launch.
- Added daemon `--idle-timeout` and `--max-lifetime` lifecycle guards with local metadata and worker shutdown behavior.
- Added `resource artifacts plan` and `resource artifacts cleanup --dry-run` for local `.browser-debug/` artifact usage planning without deletion.
- Added explicit `resource artifacts cleanup --execute` scoped to selected regular files under the configured artifact root with local cleanup receipts.
- Added local `agent surfaces list`, `agent package`, `agent ingest`, and `agent report` commands for subscription/local agent handoff and advisory result import without API calls, automatic upload, credential storage, or changes to deterministic review gates.
- Added agent advisory schemas, local package/import receipts, no-browser tests, and architecture boundaries for advisory-only agent output.
- Added local `agent requests list` status output and schema so dashboards and local automation can track pending/imported advisory handoffs without API calls, uploads, credential storage, MCP agent execution, or review gate changes.
- Added local `agent requests show` detail output and schema so dashboards can inspect one advisory handoff package/result without browser launch, provider API calls, uploads, credential storage, MCP agent execution, or review gate changes.
- Added local `agent workflow create/status/index/report` output and schema so dashboards and local automation can track advisory handoff step state and write bounded workflow summaries without browser launch, provider API calls, uploads, credential storage, MCP agent execution, external evidence transfer, or review gate changes.
- Added the first Phase 29 agent execution foundation slice: `agent_execution` schema parity, `agent execution plan/status/list`, package API exports, local dry-run plan receipts, explicit run gating, no MCP execution exposure, and unchanged deterministic review gates.
- Completed the Phase 29 agent execution adapter slice with `agent execution run --execution ... --execute`, deterministic fake provider execution, configured local runner callbacks, env-only generic API execution, bounded package/prompt disclosure, normalized advisory results, local run receipts, dashboard status/list fields, no raw provider response storage, no credential value recording, and architecture checks that keep provider calls out of review, resource, daemon, cleanup, Playwright, and MCP execution paths.
- Added Phase 30 packed install smoke coverage with `npm run test:pack-install` for the packed tarball layout, packaged CLI entrypoints, package API imports, MCP stdio tool listing, schema/template/plugin file presence, selected workflow security docs, and no-publish release boundaries.
- Wired packed install smoke into `npm run release:check`, the product aggregate gate, CI validation, and the Node GitHub Actions job without changing package naming, license, marketplace, publication, or external evidence transfer boundaries.
- Added Phase 31 MCP profile gating with `safe`, `full`, and `admin` launch profiles, default/full compatibility, MCP-only workspace-confined `@file` handling, profile API exports, and packed-install smoke coverage without adding cleanup execution, agent/API execution, HTTP/socket transport, shell tools, external upload, profile reuse, or provider credential behavior.
- Added Phase 32 rename-readiness with centralized product identity metadata, package/plugin/MCP alignment checks, identity-derived package dry-run and packed-install smoke paths, package API identity exports, and MCP identity metadata without renaming the package, repository, plugin, MCP server, CLI commands, or display name.
- Added Phase 33 MCP read-only agent status tools for local agent surfaces, requests, workflows, and execution metadata without exposing package generation, ingest, report writing, workflow creation, execution planning, `agent execution run`, cleanup execution, provider/API execution, shell tools, or HTTP/socket transport.
- Added Phase 34 safe HTTP MCP foundation with explicit `--transport http --profile safe`, loopback bind enforcement, bearer-token gating, Host and Origin validation, request body limits, safe-profile-only tool exposure, package API transport exports, packed-install coverage, and security/architecture isolation without exposing HTTP `full` or `admin`, socket transport, cleanup execution, provider/API execution, `agent execution run`, shell tools, external upload, profile reuse, or credential storage.
- Added Phase 35 HTTP MCP integration hardening with token-free `browser-debug mcp config` output for stdio and safe HTTP client setup, package API configuration exports, and packed-install authenticated HTTP `initialize` smoke coverage without expanding MCP tools into HTTP `full` or `admin`, socket transport, cleanup execution, provider/API execution, `agent execution run`, shell tools, external upload, profile reuse, or credential handling.
- Added Phase 36 MCP capability policy output with `browser-debug mcp capabilities`, package API exports, MCP tool exposure through safe/full/admin, and packed-install smoke coverage without enabling cleanup execution, provider/API execution, `agent execution run`, shell tools, daemon/session control, credential handling, HTTP `full` or `admin`, socket transport, or remote listeners.
- Added Phase 37 external-repository usage quickstart documentation with packaged `docs/workflow/CONSUMER_USAGE.md`, README/plugin skill routing, package file-set inclusion, and packed-install smoke coverage without changing runtime permissions, MCP permissions, publication, marketplace, or identity names.
- Added Phase 38 local-checkout MCP config metadata so external repositories and agents can use generated `local_checkout.mcpServers` or `local_checkout.launch` when `browser-debug-mcp` is not installed on PATH, without changing MCP permissions, starting listeners, writing config files, exposing token values, publishing, or renaming identities.

## Release Status

No public package has been released. Package naming, license selection, npm authentication, npm publication, plugin marketplace registration, model/API execution outside the Phase 29 agent execution adapter boundary, evidence transfer beyond bounded package/prompt disclosure, arbitrary source-data file or URL loaders, socket MCP transport, remote HTTP MCP listeners, HTTP `full` or `admin`, OAuth/login automation, profile reuse, external upload, host memory-cache mutation, swap configuration, cleanup outside the configured artifact root, MCP cleanup execution, MCP agent/API execution, privileged helper execution, and arbitrary process control remain explicit release blockers.

# Changelog

## Unreleased

- Added optional `AGENTIC_HUMAN_REVIEW_API_TIMEOUT_MS` support for the Agentic Human Review generic API provider while preserving the 30000 ms default, provider capability-hash validation, env-only configuration, and no raw-response/credential/MCP expansion boundaries.
- Added Agentic Human Review quality-gate foundation for structured benchmark requirement coverage, stricter calibration readiness, risk/misleading-content dimension coverage, evidence-set validation and summary, batch comparison, evaluator policy warnings, xhigh round planning and simulation, longitudinal quality rollups, claim policy/audit diagnostics, schema/API/package coverage, and continued no-provider-call/no-artifact-write/no-MCP-exposure/no-gate-mutation boundaries for diagnostic surfaces.
- Added the Agentic Human Review Responses adapter with `npm run ahr:responses-adapter`, loopback-only bearer-token gating, separate upstream provider credential loading, no-store/no-tools provider request conversion, advisory JSON normalization, local path and raw-pixel safeguards, API exports, pack-install coverage, and no MCP exposure, raw provider response storage, credential persistence, deterministic review mutation, or release-gate changes.
- Added Agentic Human Review Slice 34-42 with `agentic review propose`, `agentic review plan --proposal`, `agentic review provider-readiness`, approved generic API provider execution through `agentic review run`, `agentic review report-quality`, proposal/provider-readiness/report-quality schemas, provider adapter isolation, role execution records, claims, critique/rebuttal/integration metadata, dogfood metadata, report-quality metadata, package-hash validation, exact transfer flags for externally transferable evidence classes, credential non-disclosure coverage, and no MCP exposure, raw provider response storage, deterministic review mutation, or release-gate changes.
- Added Agentic Human Review Slice 26-33 with `agentic review plan/run/status/list`, xhigh-capable role orchestration metadata, plan-hash approval gates, exact evidence-transfer flags, deterministic fake/injected provider adapters, advisory-only human-like visual/UX/content/subjective review output, generic agent-execution bypass prevention, schema/API/package coverage, and no MCP exposure, browser launch, credential storage, raw provider response storage, deterministic review mutation, or release-gate changes.
- Added Slice 21-25 / Phase 149-155 final hardening readiness with `final readiness`, cross-feature regression matrix metadata, local gate-plan metadata, safe MCP readiness inspection, schema/API/package coverage, and report-only boundaries for browser smoke, MCP smoke execution, remote CI, Git mutation, publication, provider calls, artifact migration, alias removal, shell execution, and product-doc promotion.
- Added Slice 19-20 / Phase 140-148 constrained shell readiness with `shell readiness`, `shell plan`, fail-closed `shell run --execute`, use-case/threat/schema/readiness metadata, safe MCP readiness inspection, schema/API/package coverage, and no child-process/shell/env/credential/file/network/MCP-execution expansion.
- Added Slice 18 / Phase 139 legacy alias removal readiness with `identity aliases removal-readiness`, fail-closed `identity aliases remove --execute`, safe MCP readiness inspection, schema/API/package coverage, and retained compatibility aliases.
- Added Slice 15-17 / Phase 126-138 artifact-root policy, migration readiness, and legacy alias audit coverage with configurable root metadata, dual-root compatibility, migration boundary reporting, alias compatibility reporting, schema/API/MCP coverage, and no real migration or alias removal.
- Added Slice 13-14 / Phase 120-125 release readiness and npm publication boundaries with local package decision/provenance/2FA reporting, no-publish release-candidate metadata, schema/API/MCP coverage, package smoke coverage, and fail-closed publication state.
- Added Slice 9-12 / Phase 96-119 provider-free localization and translation readiness with UI locale resources, report templates, fallback/RTL guards, raw-evidence non-translation, deterministic fake dry-run output, safe MCP readiness/resource inspection, and fail-closed translation execution.
- Added Slice 7-8 / Phase 85-95 capture readiness/status and no-capture hardening with static platform-only capability reporting, privacy policy, future artifact/receipt contracts, safe MCP readiness exposure, stricter MCP capture-plan argument validation, and fail-closed capture execution.
- Added Slice 6 / Phase 79-84 cleanup MCP planning and receipt hardening with artifact-root realpath confinement, candidate locks, deterministic plan hashes, pre-delete validation, receipt audit fields, MCP plan-only exposure, and no MCP cleanup execution.
- Added Slice 5 / Phase 74-78 provider MCP execution and status/list hardening. The stdio `admin` MCP profile now exposes `browser_debug_agent_execution_plan` and `browser_debug_agent_execution_run` for existing Phase 29 agent execution providers, with safe/full exclusion, HTTP safe-only preservation, idempotency-key validation, workspace realpath confinement, env-only credentials, bounded disclosure, local receipts, fake/local/API provider tests, MCP capability/readiness updates, and credential non-disclosure coverage.
- Added Phase 71-73 read-only operation provider readiness with `operation provider-readiness`, package API exports, safe MCP inspection, provider MCP plan readiness, bounded disclosure contract readiness, env credential guard readiness, schema/package coverage, credential sentinel non-disclosure coverage, unsupported execution-option rejection, and no-provider-call/no-credential-value-read/no-evidence-transfer/no-MCP-provider-execution boundaries.
- Added Phase 69-70 read-only operation admin readiness with `operation admin-readiness`, package API exports, safe MCP inspection, MCP admin execute-token flow readiness, MCP admin harness bridge readiness, schema/package coverage, unsupported execution-option rejection, and no-token/no-token-storage/no-harness/no-admin-execute/no-live-execution boundaries.
- Added Phase 65-68 read-only operation policy/readiness with repository-local admin policy config, `operation policy`, package API exports, safe MCP inspection, CLI plan readiness, disabled harness readiness, schema/package coverage, unsupported execution-option rejection, and no-policy-mutation/no-token/no-receipt/no-harness/no-admin-MCP-execution/no-live-execution boundaries.
- Added Phase 61-64 read-only operation contracts with `operation contracts`, package API exports, safe MCP inspection, risk taxonomy, gate schema, execute-token shape, receipt shape, schema/package coverage, unsupported execution-option rejection, and no-token/no-receipt/no-harness/no-live-execution boundaries.
- Added Phase 60.1 read-only operation roadmap boundary contracts with `operation roadmap`, package API exports, safe MCP inspection, phase A/B/C contract output, schema/package coverage, unsupported execution-option rejection, and no-live-execution/no-draft-plan-promotion boundaries for draft phases 61-155.
- Added Phase 60 read-only operation registry and roadmap risk taxonomy foundation with `operation registry`, package API exports, safe MCP inspection, registry-derived MCP capability exclusions, registry-derived MCP execution-gate operation metadata, schema/package coverage, and no-execution boundaries for provider MCP execution, cleanup execution, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, constrained shell, and final release hardening.
- Added Phase 59 TraceCue-local language settings with separate dashboard display locale and artifact output language, 14-locale policy metadata, read-only settings CLI/API/MCP inspection, review/dashboard metadata, schema parity, docs, and provider-free translation boundaries.
- Added Phase 58 remote repository rename completion by renaming the GitHub repository to `xxxMasahiro/trace-cue`, updating local `origin`, product identity metadata, plugin metadata, docs, tests, and preserving the legacy repository URL as compatibility history.
- Added Phase 57 physical checkout rename completion by moving the local checkout directory to `trace-cue`, updating identity audit readiness status for moved checkouts, and preserving remotes, package identity, artifact roots, legacy aliases, npm state, marketplace state, and release boundaries.
- Added Phase 56 rename-readiness audit with `identity audit --json`, `identity_audit` schema/API support, canonical/legacy repository URL separation, packaged MCP legacy server preservation, rename-readiness checks, CI/release wiring, and packed legacy bin smoke coverage.
- Added Phase 55 multi-agent visual review aggregation hardening, including malformed artifact warnings, bounded scans, source attribution, conflict reporting, MCP non-exposure checks, docs, and packed-install smoke coverage.
- Added Phase 54 MCP visual review exposure reporting for visual review aggregation without exposing a new MCP tool.
- Added Phase 53 read-only visual review aggregation with `visual review aggregate --preparation`, `visual_review_aggregation` schema/API support, source-attributed advisory grouping, conflict reporting, and no-provider/no-write boundaries.
- Added Phase 52 desktop review provider safety bridge by wiring `review --image --capture-handoff` into capture handoff verification and visual evidence provenance without provider execution.
- Added Phase 51 desktop image review body support for caller-declared screen/window/desktop-app screenshot provenance through image review and visual preparation metadata.
- Added Phase 50 desktop review provider-preparation planning, including `visual review plan --capture-handoff`, `desktop_review_provider_preparation_plan` schema/API support, MCP non-exposure policy entries, docs, and packed-install smoke coverage.
- Added Phase 49 existing workspace image capture metadata handoff, including `capture_handoff` schema/API support, `capture handoff`, workspace-confined existing-image metadata boundaries, docs, and packed-install smoke coverage.
- Added Phase 48 read-only screen/window capture planning, including `capture_plan` schema/API support, `capture plan`, safe MCP capture planning inspection, architecture boundaries, docs, and packed-install smoke coverage.
- Added Phase 47 read-only MCP execution gate policy reporting, including `mcp_execution_gates` schema/API support, `mcp execution gates`, safe MCP gate inspection, architecture boundaries, docs, and packed-install smoke coverage.
- Added Phase 46 read-only visual review dashboard integration, including `visual_review_dashboard` schema/API support, `visual review dashboard`, safe MCP dashboard inspection, architecture boundaries, docs, and packed-install smoke coverage.
- Added Phase 45 CLI-only visual review execution from preparation artifacts, including visual_review_execution schema/API support, status/list commands, fake/local/API provider adapter coverage, metadata-only disclosure safeguards, MCP exclusion reporting, docs, and packed-install smoke coverage.


All notable local development changes are tracked here before public release.

## Unreleased

- Renamed the canonical product identity to TraceCue with `trace-cue` and `trace-cue-mcp` entrypoints while preserving legacy `browser-debug` and `browser-debug-mcp` aliases.
- Added Phase 41 visual evidence metadata so browser screenshots, standalone images, screen captures, window captures, and desktop app captures can share a metadata-only local evidence record without embedding raw pixels, calling providers, exposing MCP execution, or mutating deterministic review output.
- Added Phase 42 visual review provider policy planning on `agent execution plan` so future human-like visual review provider work has an explicit metadata-only disclosure boundary before any execution path is expanded.
- Added Phase 43 standalone image review with `trace-cue review --image <workspace-file>` for workspace-confined, metadata-only image evidence without browser launch, provider calls, raw pixel JSON embedding, or MCP execution expansion.
- Added Phase 44 local visual review result preparation with `trace-cue visual review prepare --review-index <review-artifact-index>` for metadata-only future AI visual review contracts without provider execution, raw pixel transfer, external upload, MCP exposure, or deterministic review mutation.

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
- Added Phase 39 consumer runtime-readiness guidance so external repositories can distinguish TraceCue connection success from missing target API/backend runtime, frontend-only dev-server limitations, API base configuration gaps, and valid `needs_attention` findings without adding consumer-specific runtime branches.
- Added Agentic Human Review AHR-41-44 completion enforcement with manual live dogfood opt-in rejection before provider fetch, bounded visible-text provenance and screen-text understanding contracts, benchmark-completion readiness metadata, plan/package provider-payload transfer-flag masking, and mechanical `xhigh` completion assessment for missing roles, rounds, critique/verification, and synthesis.

## Release Status

No public package has been released. Package naming, license selection, npm authentication, npm publication, plugin marketplace registration, model/API execution outside the Phase 29 agent execution adapter boundary, evidence transfer beyond bounded package/prompt disclosure, arbitrary source-data file or URL loaders, socket MCP transport, remote HTTP MCP listeners, HTTP `full` or `admin`, OAuth/login automation, profile reuse, external upload, host memory-cache mutation, swap configuration, cleanup outside the configured artifact root, MCP cleanup execution, MCP agent/API execution, privileged helper execution, arbitrary process control, and consumer-specific runtime branches remain explicit release blockers.

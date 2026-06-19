# TASK_TRACKER.md

## Current Status

Phase 5 local MVP runtime implementation is complete after Phase 1 and Phase 2a. Phase 0 scaffold and document sync are complete, local Git is initialized, the initial scaffold commit exists, local CI configuration is present, and product-gate evidence has been recorded locally. Phase 7 local review-platform implementation is complete for deterministic review, target manifests, route/viewport coverage, risk classification, conservative mock metrics, local stdio MCP adapter, schema registry, and package API/file-set readiness. Phase 8 local dogfood/plugin-readiness work is complete for target manifest generation, developer action plans, local heuristic review advisory data, target Markdown reports, plugin metadata, MCP target tools, reusable manifest template, and package file-set readiness without publication. Phase 9 local review-quality work is complete for quality signals, expanded local heuristics, developer handoff, local release decision support, and explicit model-review boundaries. Phase 10 local dogfood route-readiness work is complete for expected-route execution, expected-route coverage artifacts, route-budget skip accounting, and fixture-backed validation without target-specific runtime branches. Phase 11 local page-expectation review work is complete for optional manifest pages, page-specific viewports, deterministic page-state checks, page-level mock metrics, local review artifact indexes, and fixture-backed validation. Phase 12 local rendered-state dogfood hardening is complete for broken-image, lingering-loading, empty-data-container, developer triage report, manifest suggestion, and fixture-backed validation support. Phase 13 local dogfood signal refinement is complete for loading-indicator precision around ready/progress business-state text and Control Center recheck validation without target-specific runtime branches. Phase 14 local content UX advisory work is complete for manifest opt-in source-to-screen advisory checks, schema parity, bounded report output, and fixture-backed invariance validation without changing review findings, metrics, action plans, release readiness, or target-specific runtime branches. Phase 15 local content UX heuristic strengthening is complete for selector-scoped text, attribute, state, risk, required user-question advisory checks, reusable status-dashboard manifest templates, and fixture-backed invariance validation without changing review findings, metrics, action plans, release readiness, or target-specific runtime branches. Phase 16 local content UX handoff output is complete for additive `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, Markdown handoff output, and fixture-backed invariance validation without changing review findings, metrics, existing action plans, release readiness, or target-specific runtime branches. Phase 17 local content UX practical handoff is complete for expanded advisory categories, additive `content_ux_page_handoff`, additive `content_ux_manifest_authoring`, report page/authoring summaries, and fixture-backed invariance validation without changing review findings, metrics, existing action plans, release readiness, or target-specific runtime branches. Phase 18 local content UX review brief/rubric work is complete for additive `content_ux_review_brief`, additive `content_ux_rubric_evaluation`, report brief/rubric summaries, and fixture-backed invariance validation without changing review findings, metrics, existing action plans, release readiness, or target-specific runtime branches. Phase 19 local target manifest validation work is complete for no-browser `target validate`, manifest count output, authoring suggestions, MCP tool coverage, API export, and source-value non-disclosure without launching browsers, mutating manifests, uploading evidence, reusing profiles, or changing existing review outputs. Phase 20 local resource status preflight work is complete for no-browser `resource status`, memory/swap/cgroup/pressure/process-memory output, warnings and recommendations, MCP tool coverage, API export, and read-only local boundaries. Phase 21-24 local resource safety work is complete for review resource guard preflight/rechecks, optional fail-critical stopping, screenshot/trace pressure warnings, daemon idle/max-lifetime lifecycle guards, artifact usage planning, explicit artifact-root-only cleanup receipts, MCP artifact-plan-only wiring, API exports, and boundaries without mutating system cache, changing swap, executing shell commands, using privileged helpers, uploading evidence, reusing profiles, controlling arbitrary processes, or exposing cleanup execution through MCP. Phase 25 local agent advisory handoff work is complete for agent surface listing, bounded evidence package generation, prompt and receipt artifacts, untrusted advisory ingest, advisory report output, schema/API exports, no-browser tests, and boundaries without direct provider API calls, automatic upload, credential storage, MCP agent execution, or deterministic gate changes. Phase 26 local agent request status work is complete for read-only package/result status listing, pending/imported handoff tracking, schema/API exports, no-browser tests, and boundaries without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, review artifact mutation, or deterministic gate changes. Phase 27 local agent request detail work is complete for read-only single-package detail output, selected imported result summaries, dashboard handoff hints, schema/API exports, no-browser tests, and boundaries without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, artifact writes, review artifact mutation, or deterministic gate changes. Phase 28 local agent workflow status work is complete for local workflow manifests, dashboard handoff step state, post-ingest status recomputation, workflow index aggregation, workflow report output, schema/API exports, no-browser tests, and provider-boundary metadata without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, external evidence transfer, review artifact mutation, or deterministic gate changes. Phase 29 agent execution integration is complete for `agent_execution` schema/API parity, dry-run plan receipts, explicit `--execute` plus `--execution` enforcement, provider adapter isolation, deterministic fake provider execution, configured local runner callback support without free-form shell input, env-only generic API provider execution with bounded package/prompt disclosure, dashboard status/list fields, local receipts, advisory-result normalization, no raw provider response storage, no credential value recording, no MCP execution exposure, no review artifact mutation, and unchanged deterministic gates.

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
- [x] Implemented `daemon start`, `daemon status`, and `daemon stop` for local background ephemeral browser supervision.
- [x] Added browser smoke tests for local file observation and click actions.
- [x] Strengthened browser smoke coverage for form controls, keyboard input, deterministic scroll, wait actions, screenshots, reports, and spec export.
- [x] Added deterministic headed/devtools launch-mode regression coverage without requiring a GUI display.
- [x] Added `npm run test:pack` local package dry-run verification and aggregate gate wiring.
- [x] Added local release readiness notes in `CHANGELOG.md` and `docs/workflow/RELEASE.md`.
- [x] Added browser smoke coverage for supervised ordered actions in one ephemeral context.
- [x] Added architecture regression coverage for generic runtime boundaries, shared evidence helpers, and local Node CLI packaging.
- [x] Added architecture and browser smoke coverage for local daemon boundaries and start/status/stop.
- [x] Added local GitHub Actions CI configuration and `ops/CI_MANIFEST.tsv`.
- [x] Added `tools/check_product_ci.sh` and wired it into product-local aggregate checks.
- [x] Added `npm run release:check` for local release-readiness verification without publishing.
- [x] Closed local JSON schema-versioning and artifact-retention decisions with `doctor` metadata, product docs, and deterministic tests.
- [x] Created the public GitHub repository at `https://github.com/xxxMasahiro/browser-debug-cli`.
- [x] Fast-forwarded local `main` to the local MVP runtime commit and pushed `main` to `origin/main`.
- [x] Confirmed GitHub Actions `main` CI passed on push for Node 20, Node 22, and browser smoke jobs.
- [x] Updated CI action versions to `actions/checkout@v5` and `actions/setup-node@v5` after the first remote run reported Node 20 action-runtime deprecation annotations.
- [x] Verified the running Dashboard Control Center at `http://127.0.0.1:5173/` with screenshot and trace capture.
- [x] Confirmed `http://127.0.0.1:5174/` was not listening during verification.
- [x] Re-ran product-local `./tools/product-gate`, `npm test`, `npm run test:browser`, and `git diff --check`.
- [x] Re-ran lesson-side product scaffold, product repository authority, and workflow-pair checks successfully.
- [x] Recorded the pre-implementation review-platform direction in developer memory after xhigh sub-agent review.
- [x] Defined the Phase 7 implementation plan for review MVP, target manifests, site review, route discovery, viewport matrices, risk-gated actions, mock comparison, local MCP adapter, optional model review, and public API readiness.
- [x] Implemented machine-readable schemas and `schema list` / `schema get`.
- [x] Implemented `browser-debug review --url <url> --json` with local observation, layout, screenshot, review, report, and mock-metric artifacts.
- [x] Implemented `browser-debug review --target <manifest> --json` with target manifest loading, route discovery, viewport execution, and coverage artifacts.
- [x] Implemented action candidate risk classification for navigation, state-revealing, input-required, mutating, destructive, and external actions.
- [x] Implemented shell-safe structured input for `--input -`, `--target @file`, `--actions @file`, and `--action @file`.
- [x] Implemented conservative local mock metrics under `.browser-debug/diffs/`.
- [x] Implemented local stdio MCP adapter entrypoint `browser-debug-mcp` and `browser-debug mcp serve` metadata.
- [x] Added public local package API exports and schema package files while keeping the package private and unreleased.
- [x] Strengthened product structure, security, architecture, CLI, and browser smoke tests for review/MCP boundaries.
- [x] Synchronized requirements, specification, implementation plan, security, verification, task tracker, handoff, manifests, README, and changelog with the Phase 7 implementation.
- [x] Implemented `target init --url <url> --json` to generate local target manifest artifacts.
- [x] Added developer-facing finding enrichment with priority, impact, recommendations, fix candidates, and implementation notes.
- [x] Added `action_plan` and `review_advisory` to review results.
- [x] Added target review Markdown reports through `review --target <manifest> --report --json`.
- [x] Added MCP tools for target manifest initialization and target review.
- [x] Added local Codex plugin metadata, local MCP configuration, and plugin-facing review skill.
- [x] Added reusable `templates/review-target-manifest.json`.
- [x] Included plugin metadata, plugin skill, and target template in the local package dry-run file set without publishing.
- [x] Added `quality_signals` to single-URL and target review output.
- [x] Added generic quality signals for visual hierarchy, responsive layout, interaction affordance, accessibility structure, evidence completeness, developer handoff, release readiness, and model-review boundary state.
- [x] Expanded local review evidence and findings for headings, landmarks, image alt text, contrast, visible overlaps, and mobile touch-target sizing.
- [x] Added Quality Signals sections to Markdown review reports.
- [x] Strengthened browser smoke coverage for quality signals, alt text, contrast, overlap, target route coverage summaries, local release readiness, and disabled model-review boundaries.
- [x] Target review now enqueues manifest `expectedRoutes` as explicit review targets.
- [x] Coverage artifacts now include `coverage.routes.expected`.
- [x] Target review records `route_budget_exceeded` skipped routes when `budgets.maxRoutes` prevents full coverage.
- [x] Target quality signals report expected manifest route counts and route-budget-exceeded counts.
- [x] Browser smoke coverage verifies unlinked expected routes and route-budget skip accounting.
- [x] Target manifests support optional `pages` entries for named page expectations, page-specific viewports, page-specific mock paths, and priority.
- [x] Target review checks manifest page expected visible text and selectors against local browser evidence.
- [x] Target coverage now includes page expectation expected, checked, failed, and skipped records.
- [x] Target quality signals now include `page_expectations` counts for checked pages, failed pages, skipped pages, and missing expectations.
- [x] Single-URL and target reviews write local `review_artifact_index` artifacts with evidence classes, rerun guidance, and local safety boundaries.
- [x] Browser smoke coverage verifies page expectation checks, page-specific mock metrics, artifact indexes, and report output.
- [x] Layout evidence records image load state, visible loading indicators, and empty table/list/grid containers.
- [x] Review findings flag broken visible images, lingering loading indicators after the review wait, and empty data containers without visible empty-state messaging.
- [x] Single-URL and target quality signals include rendered-state summaries.
- [x] Markdown reports include a Developer Triage section and rendered-state quality signal status.
- [x] Target review output includes manifest suggestions for missing page expectations, unpinned expected routes, route-budget exhaustion, failed page checks, and rendered-state gaps.
- [x] Browser smoke coverage verifies rendered-state findings, evidence summaries, developer triage reports, and manifest suggestions.
- [x] Refined loading indicator evidence so normal ready/progress business-state text does not produce lingering loading UI findings without explicit loading semantics.
- [x] Browser smoke coverage verifies ready/progress business-state text is not reported as a loading indicator.
- [x] Added target manifest `sourceData`, `localContentUxAdvisory`, and page `expectations.dataBindings` support for opt-in content UX advisory.
- [x] Added pure `src/content-ux-advisory.js` advisory logic without Playwright, filesystem access, artifact reads, external transfer, or target-specific literals.
- [x] Added target review `local_content_ux_advisory` and `quality_signals.content_ux` output only when manifest opt-in is enabled.
- [x] Preserved existing review findings, `metrics.finding_count`, `action_plan`, and `quality_signals.release_readiness` when content UX advisory is enabled.
- [x] Synchronized schema registry and schema files for review and target manifest fields, with no-browser parity coverage.
- [x] Added Markdown report output for Content UX Advisory without copying source values or full page text.
- [x] Updated generated target manifests and reusable target manifest template with disabled advisory scaffolding.
- [x] Added no-browser, architecture, and browser smoke coverage for content UX advisory opt-in behavior, non-disclosure, and local-first boundaries.
- [x] Added bounded element evidence summaries for selector-scoped content UX advisory checks.
- [x] Added selector-scoped `text`, `attribute`, `data-state`, and `data-risk` data binding evaluation.
- [x] Added `localContentUxAdvisory.requiredUserQuestions` and page `expectations.userQuestions` advisory checks for information architecture and user journey review.
- [x] Added `templates/status-dashboard-content-ux-target-manifest.json` as a reusable disabled-by-default status-dashboard manifest example.
- [x] Added additive `content_ux_findings` output that stays separate from review `findings`.
- [x] Added additive `content_ux_action_plan` output that stays separate from the existing `action_plan`.
- [x] Added additive `content_ux_readiness` output that stays separate from `quality_signals.release_readiness`.
- [x] Added bounded Content UX Developer Handoff Markdown report output.
- [x] Added no-browser and browser smoke coverage for dedicated content UX handoff output, source-value non-disclosure, and unchanged legacy review fields.
- [x] Added expanded content UX advisory categories for status clarity, action clarity, navigation clarity, information architecture, source alignment, content contracts, coverage contracts, and review scope.
- [x] Added additive `content_ux_page_handoff` output for page-level content UX triage.
- [x] Added additive `content_ux_manifest_authoring` output for manifest-only authoring suggestions.
- [x] Strengthened generated and reusable target manifest scaffolding with the expanded content UX check vocabulary.
- [x] Added no-browser and browser smoke coverage for page handoff, manifest authoring suggestions, report output, and unchanged legacy review fields.
- [x] Confirmed arbitrary source-data file and URL loaders remain unimplemented and approval-bound.
- [x] Added optional `localContentUxAdvisory.reviewBrief`, `localContentUxAdvisory.rubric`, and page `role` manifest fields.
- [x] Added additive `content_ux_review_brief` output for audience, page role, and decision-need triage.
- [x] Added additive `content_ux_rubric_evaluation` output for manifest-declared content UX criteria.
- [x] Added bounded Content UX Review Brief Markdown report output.
- [x] Added no-browser and browser smoke coverage for review brief, rubric evaluation, source-value non-disclosure, disabled-output absence, and unchanged legacy review fields.
- [x] Moved packaged sample vocabulary to a domain-neutral status-dashboard template while keeping lesson-specific Control Center semantics in target-owned manifests.
- [x] Added preferred `status_clarity` and `action_clarity` content UX categories while preserving legacy rubric category aliases for existing manifests.
- [x] Added `target validate --target <manifest> --json` and `target validate --input - --json` for no-browser target manifest validation.
- [x] Added local validation output for normalized manifest counts, authoring suggestions, review next commands, and explicit local-first boundaries.
- [x] Added MCP `browser_debug_target_validate` and local API `runTargetValidate` without adding HTTP/socket transport, shell tools, cleanup execution tools, external upload, or profile reuse.
- [x] Added no-browser coverage for successful validation, invalid manifest errors, source-value non-disclosure, and MCP validation wiring.
- [x] Added `resource status --json` for no-browser local memory, swap, cgroup, pressure, and process memory preflight.
- [x] Added MCP `browser_debug_resource_status` and local API exports for resource status collection and parsing.
- [x] Added no-browser and architecture coverage for deterministic resource fixture output, MCP resource status wiring, and read-only local boundaries without browser launch, artifact writes, cache mutation, swap mutation, file deletion, shell execution, profile reuse, external upload, or arbitrary process control.
- [x] Added review `--resource-guard advisory|fail-critical|off` with additive resource guard output, preflight, target route/viewport rechecks, screenshot/trace pressure warnings, and fail-critical no-launch behavior.
- [x] Added daemon `--idle-timeout` and `--max-lifetime` lifecycle guards with metadata and local worker shutdown behavior.
- [x] Added `resource artifacts plan`, `resource artifacts cleanup --dry-run`, and MCP `browser_debug_resource_artifacts_plan` without exposing cleanup execution through MCP.
- [x] Added `resource artifacts cleanup --execute` for selected regular files under the configured artifact root with local cleanup receipts.
- [x] Added no-browser and architecture coverage for resource guard, artifact planning, explicit cleanup receipts, daemon lifecycle options, and local safety boundaries.
- [x] Added local agent advisory surface listing, bounded package generation, prompt and receipt artifacts, advisory ingest, and separate advisory report output.
- [x] Added agent advisory schemas, package API exports, no-browser coverage, and architecture boundaries without provider API calls, automatic upload, credential storage, MCP agent execution, or deterministic gate changes.
- [x] Added local `agent requests list` status output, request-status schema/API export, pending/imported no-browser coverage, and read-only boundaries without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, review artifact mutation, or deterministic gate changes.
- [x] Added local `agent requests show` detail output, request-detail schema/API export, selected-result matching, pending/imported no-browser coverage, and read-only boundaries without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, artifact writes, review artifact mutation, or deterministic gate changes.
- [x] Added local `agent workflow create/status/index/report` output, workflow schema/API exports, dashboard handoff step state, post-ingest status recomputation, index aggregation, Markdown workflow reports, and no-browser coverage without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, external evidence transfer, review artifact mutation, or deterministic gate changes.
- [x] Synchronized the Phase 29 agent execution integration plan across product and workflow documents without implementing runtime provider calls, credential handling, raw artifact transfer, MCP execution, or review gate changes.
- [x] Completed Phase 29 execution adapters with `src/agent-execution-providers.js`, deterministic fake provider coverage, configured local runner callback support, env-only generic API execution, local run receipts, normalized advisory result output, dashboard status/list fields, and architecture tests that keep provider calls out of review, resource, daemon, cleanup, Playwright, and MCP execution paths.

## Remaining Work

- [x] Phase 29a: add `agent_execution` schema and document/security/schema parity without changing existing workflow or review schemas except additive references.
- [x] Phase 29b: add CLI parser and package API surfaces for `agent execution plan/run/status/list`.
- [x] Phase 29c: add dedicated execution and provider adapter modules while keeping provider calls out of review, resource, daemon, cleanup, Playwright, and MCP execution paths.
- [x] Phase 29d: implement dry-run execution plans, local receipts, boundary flags, and dashboard next-command hints.
- [x] Phase 29e: implement the provider runner abstraction and deterministic fake provider tests.
- [x] Phase 29f: implement configured local subscription-agent runner support without free-form shell input or SaaS web UI automation.
- [x] Phase 29g: implement one-shot API provider execution with explicit `--execute`, env-only credentials, bounded disclosure, advisory normalization, and no raw response storage.
- [x] Phase 29h: add dashboard execution status/list contract fields while keeping existing workflow status semantics and MCP execution non-exposure.

## Future Approval-Bound Work

- [ ] If approved later, integrate model/API review outside the Phase 29 agent execution adapter boundary or send review evidence beyond the bounded package/prompt disclosure policy.
- [ ] If approved later, extend provider execution beyond the Phase 29 dry-run, explicit `--execute`, env-only credential, bounded-disclosure, local-receipt, advisory-only boundary.
- [ ] If approved later, expose any execution operation through MCP. Phase 29 keeps `agent execution run` out of MCP.
- [ ] If approved later, add HTTP/socket MCP server mode or remote control channels.
- [ ] If approved later, run real headed visual regression checks in an environment with a display.
- [ ] If approved later, choose the public package name and license.
- [ ] If approved later, publish the npm package after release checklist, CI, package name, license, and credential handling are complete.
- [ ] If approved later, register or install the Codex plugin in a marketplace.
- [ ] If approved later, design any host cleanup, system cache mutation, swap configuration, cleanup outside the configured artifact root, privileged helper execution, MCP cleanup execution, or arbitrary process-control workflow with separate security documentation and tests.

## Next Step

Phase 29 implementation work is complete. Next work should move to release-hardening or a newly planned phase only after product checks pass. Ask for explicit approval before evidence transfer outside the Phase 29 bounded disclosure policy, arbitrary source-data file or URL loaders, HTTP/socket MCP server mode, authentication automation, external daemon control channels, external upload, existing-browser-profile reuse, persistent credential storage, public package naming, license changes, plugin marketplace registration, npm publication, cleanup outside the configured artifact root, automatic cleanup, host memory-cache mutation, swap configuration, privileged helper execution, MCP cleanup execution, MCP agent execution, or arbitrary process control.

## Stop Conditions

- Runtime Playwright implementation is requested before Phase 0 checks pass.
- GitHub public repository creation is requested without explicit approval.
- npm publish is requested before CI and release planning exist.
- Any secret, cookie, storage state, or credential-like data appears in repository files.
- A design change would require existing browser profile reuse, credential storage, OAuth, webhooks, external upload, or arbitrary shell execution without a security plan and approval.
- Review-platform runtime code introduces Dashboard Control Center or FrameCue Control Center-specific branches instead of generic target manifests.
- MCP adapter work introduces HTTP/socket listeners, arbitrary shell execution, cleanup execution tools, external upload, or persistent storage without explicit approval and security documentation.
- Resource safety work mutates system cache, changes swap configuration, deletes outside the configured artifact root, executes shell commands, uses privileged helpers, exposes MCP cleanup execution, or controls arbitrary processes without explicit approval and security documentation.
- Agent execution work changes existing deterministic review outputs, existing `agent_workflow` status meanings, resource guard behavior, artifact cleanup behavior, or release-readiness semantics.
- Agent execution work stores credential values, raw provider responses, raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, report bodies, cookies, storage state, existing browser profile data, or raw review artifacts.
- Agent execution work bypasses dry-run planning, explicit `--execute`, env-only credential loading, local receipts, bounded disclosure, or advisory-only normalization.
- Agent execution work exposes execution through MCP, accepts free-form shell commands, automates SaaS web UIs, adds OAuth/login automation, persists credentials, or adds HTTP/socket provider control paths.

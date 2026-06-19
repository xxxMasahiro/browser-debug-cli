# SPECIFICATION.md

## Product Shape

Browser Debug CLI is planned as a Node.js CLI package backed by Playwright. It should be usable from any product repository and should not require the caller to run an MCP server.

The Phase 2a design baseline uses Node.js 20 or newer, ESM modules, and a local CLI binary named `browser-debug`. The final npm package name can still be confirmed during release planning, but runtime code should not depend on a scoped package name.

## Planned Architecture

- CLI entrypoint: accepts commands, options, and JSON input/output flags.
- Core library: owns Playwright session management, observation, actions, and artifact creation.
- Browser supervisor: keeps a reusable browser context alive when fast iterative debugging is needed.
- Observation layer: summarizes URL, title, accessibility tree, visible text, form controls, action candidates, console errors, failed requests, screenshots, and selected metadata.
- Action layer: performs explicit actions such as click, fill, select, press, scroll, wait, navigate, screenshot, and trace capture.
- Report layer: converts session evidence into issue reports and handoff notes.
- Review core: converts normalized browser evidence into deterministic UI review findings.
- Quality signal layer: summarizes local review evidence into visual hierarchy, rendered state, responsive layout, interaction, accessibility, page expectations, evidence completeness, release-readiness, and model-boundary signals.
- Site review layer: discovers routes, runs viewport matrices, applies action risk policy, and emits coverage.
- Artifact index layer: groups local review artifacts, evidence classes, rerun guidance, and local safety boundaries for developer handoff.
- Manifest suggestion layer: turns target review coverage and rendered-state evidence into local suggestions for better reruns without editing runtime code for specific applications.
- Content UX advisory layer: evaluates manifest opt-in source-to-screen content contracts, selector-scoped state contracts, required user-question evidence, review briefs, and rubric criteria from existing target review evidence without creating review findings or changing release gates.
- Resource status layer: reads local process-visible memory, swap, cgroup, and pressure signals before browser-heavy work without launching Playwright, writing artifacts, mutating host cache, changing swap, deleting files, or controlling arbitrary processes.
- Resource guard layer: reuses resource status for review preflight and route/viewport rechecks, emits additive `resource_guard` data, warns on heavy screenshot/trace artifacts, and can stop browser work only when explicitly set to `fail-critical`.
- Resource artifact layer: inventories `.browser-debug/` artifact usage, proposes cleanup candidates, and performs explicit artifact-root-only cleanup with receipts when `--execute` is provided.
- Daemon lifecycle layer: adds optional local idle-timeout and max-lifetime shutdown guards to detached ephemeral browser workers.
- Agent advisory layer: creates bounded local evidence packages from review artifact indexes, generates handoff prompts for local subscription agents, lists and inspects local request status from package/result artifacts, imports untrusted advisory JSON, and renders separate advisory reports without direct API calls, external upload, credential storage, or deterministic gate changes.
- Agent execution layer: plans and runs subscription-style local agent or API-style provider execution from bounded agent packages through dedicated provider adapters, exposes status/list metadata, and normalizes output as advisory-only results without mutating deterministic review artifacts or existing workflow status semantics.
- Schema layer: defines stable JSON contracts for envelopes, artifacts, target manifests, findings, reports, and adapter I/O.
- Adapter layer: keeps CLI as the source of truth and later exposes the same core through an MCP stdio adapter.

## Planned CLI Surface

The Phase 2a command surface is:

```text
browser-debug doctor
browser-debug session start
browser-debug session close --session <id>
browser-debug observe --url <url> --json
browser-debug supervise --url <url> --actions <json-array> --json
browser-debug daemon start --url <url> --json
browser-debug daemon status --daemon <id> --json
browser-debug daemon stop --daemon <id> --json
browser-debug resource status --json
browser-debug resource artifacts plan --json
browser-debug resource artifacts cleanup --dry-run --json
browser-debug resource artifacts cleanup --execute --json
browser-debug agent surfaces list --json
browser-debug agent package --review-index <review-artifact-index> --surface <surface-id> --json
browser-debug agent requests list --json
browser-debug agent requests show --package <agent-package> --json
browser-debug agent workflow create --package <agent-package> --json
browser-debug agent workflow status --workflow <agent-workflow> --json
browser-debug agent workflow index --json
browser-debug agent workflow report --workflow <agent-workflow> --json
browser-debug agent execution plan --package <agent-package> --surface <surface-id> --provider <provider-id> --model <model-id> --json
browser-debug agent execution run --execution <agent-execution> --package <agent-package> --surface <surface-id> --provider <provider-id> --model <model-id> --execute --json
browser-debug agent execution status --execution <agent-execution> --json
browser-debug agent execution list --json
browser-debug agent ingest --package <agent-package> --input <agent-result-json> --json
browser-debug agent report --review-index <review-artifact-index> --agent-result <agent-result> --json
browser-debug target init --url <url> --json
browser-debug target validate --target <manifest> --json
browser-debug act --session <id> --action <json>
browser-debug report --session <id>
browser-debug spec export --session <id>
browser-debug review --url <url> --json
browser-debug review --target <manifest> --json
browser-debug schema list --json
browser-debug schema get --name <schema> --json
browser-debug mcp serve
```

The MVP implementation order is:

1. `doctor` with environment and safety checks.
2. Command parsing and deterministic JSON error output without launching a browser.
3. `observe --url <url> --json` with an ephemeral headless Playwright context.
4. Artifact directory handling under `.browser-debug/`.
5. Session start, explicit actions, reports, and spec export after one-shot observation is stable.

## Current Implemented Slice

The repository now includes a private local Node.js package named `browser-debug-cli` with the `browser-debug` executable at `bin/browser-debug.js`. The implementation is ESM-only and uses Playwright as its browser runtime dependency.

Implemented behavior:

- `browser-debug doctor --json` returns the standard JSON envelope and local environment checks.
- Parser errors return deterministic JSON envelopes when `--json` is used.
- Planned command names are parsed explicitly.
- `observe --url <url> --json` validates absolute `http`, `https`, or `file` URLs, launches an ephemeral Chromium context, captures structured page state, writes a local observation artifact, and closes the context.
- `observe --screenshot` writes a local screenshot artifact.
- `observe --trace` writes a local Playwright trace zip and emits a warning because traces can contain page content.
- `observe --headed` launches a visible browser mode when the host environment supports it.
- `observe --devtools` launches visible browser mode with DevTools enabled when the host environment supports it.
- `supervise --url <url> --actions <json-array>` launches one ephemeral Chromium context, applies ordered local actions in that same process-scoped context, writes observation metadata for the initial page and each action, writes local supervision metadata under `.browser-debug/sessions/`, and closes the context before process exit.
- `daemon start --url <url>` starts a detached local worker process with one ephemeral Chromium context, writes daemon metadata under `.browser-debug/daemons/`, writes an initial observation, and returns a daemon ID and process ID. `daemon status --daemon <id>` reads metadata and checks whether the process is alive. `daemon stop --daemon <id>` sends a local process signal and records the stopped state.
- `daemon start --idle-timeout <duration>` and `daemon start --max-lifetime <duration>` add optional lifecycle metadata and local worker timers that stop the daemon after inactivity or a fixed lifetime without external control channels.
- `resource status --json` reports local memory, swap, cgroup, pressure, and current process memory signals. It returns `data.resource_status`, recommendations, local safety boundaries, and warnings for elevated pressure without launching a browser, writing artifacts, mutating system cache, configuring swap, deleting files, uploading evidence, or reusing profiles.
- `resource artifacts plan --json` reports `.browser-debug/` usage, largest files, top-level directory totals, cleanup candidates, and local boundaries without deleting files.
- `resource artifacts cleanup --dry-run --json` reports the same cleanup proposal without deleting files. `resource artifacts cleanup --execute --json` deletes only selected regular files under the configured artifact root, preserves receipts, and writes an `artifact_cleanup_receipt` artifact.
- `agent surfaces list --json` returns provider-neutral local agent surfaces. Local subscription-agent surfaces are available for local handoff; the generic API provider surface is listed as approval-bound and does not execute network requests.
- `agent package --review-index <path> --surface <id> --json` reads an explicitly provided local review artifact index, creates `.browser-debug/agent-packages/<id>/packet.json`, `.browser-debug/agent-packages/<id>/prompt.md`, and an evidence-packet receipt. The package includes bounded triage, coverage, evidence-class, rerun, and local artifact-reference metadata only. It does not copy raw screenshot bytes, trace contents, raw DOM, console payloads, network payloads, reports, or sourceData values.
- `agent requests list --json` scans local `.browser-debug/agent-packages/` and `.browser-debug/agent-results/` metadata and reports whether each advisory package is `waiting_for_agent` or `advisory_imported`. `--package <path>` narrows the status to one workspace-relative package. The command is read-only, does not launch a browser, does not contact providers, does not upload evidence, does not store credentials, does not expose MCP agent execution, and does not mutate review artifacts.
- `agent requests show --package <path> --json` reads one workspace-relative package and returns package metadata, disclosure policy, local artifact-reference summaries, source review index metadata, selected/latest result paths, bounded advisory result summary, and dashboard handoff hints. `--agent-result <path>` can select a specific matching workspace-relative result. The command is read-only, writes no artifacts, does not launch a browser, does not contact providers, does not upload evidence, does not store credentials, does not expose MCP agent execution, and does not mutate review artifacts.
- `agent workflow create --package <path> --json` reads one workspace-relative package, writes `.browser-debug/agent-workflows/<id>/workflow.json` plus a workflow receipt, and records dashboard-oriented package, prompt, agent-review, ingest, report-pending, request status, and provider-boundary metadata. The manifest contains local references and bounded metadata only; it does not copy raw artifact bytes, execute agents, contact providers, upload evidence, store credentials, launch a browser, expose MCP agent execution, or mutate review artifacts.
- `agent workflow status --workflow <path> --json` reads one workspace-relative workflow manifest, recomputes current status from local package/result metadata, and reports `waiting_for_agent`, `advisory_imported`, or `package_missing` with dashboard handoff commands. The command is read-only and writes no artifacts.
- `agent workflow index --json` scans local `.browser-debug/agent-workflows/` manifests and returns aggregate workflow status counts, report-pending counts, and explicit provider boundary flags without writing artifacts, launching a browser, contacting providers, uploading evidence, storing credentials, exposing MCP agent execution, or mutating review artifacts.
- `agent workflow report --workflow <path> --json` reads one workflow status snapshot, writes a bounded Markdown summary under `.browser-debug/reports/`, and keeps deterministic review artifacts unchanged. It does not launch a browser, contact providers, upload evidence, store credentials, expose MCP agent execution, or mutate review artifacts.
- `agent ingest --package <path> --input <json> --json` validates and normalizes untrusted agent output from inline JSON, stdin, or a workspace-relative `@file` into `agent_advisory`, `agent_advisory_findings`, `agent_advisory_action_plan`, `agent_advisory_readiness`, and `owner_decision_requests`. These outputs are separate from review `findings`, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.
- `agent report --review-index <path> --agent-result <path> --json` writes a separate Markdown advisory report under `.browser-debug/reports/` without mutating existing review artifacts.
- `session start --url <url>` creates local session metadata and can attach the first observation.
- `act --session <id> --action <json>` supports simple local actions such as `navigate`, `observe`, `screenshot`, `click`, `fill`, `select`, `press`, `scroll`, and `wait` using an ephemeral page visit. Scroll actions use deterministic page scrolling from the requested deltas.
- `report --session <id>` writes a Markdown report.
- `spec export --session <id>` writes a JSON action/spec export.
- `review --url <url>` runs a single-URL deterministic local review, captures observation and layout evidence, optionally captures screenshots and mock metrics, writes review artifacts, and returns evidence-backed findings.
- `review --target <manifest>` runs a manifest-driven site review with generic route discovery, explicit expected-route execution, optional page expectation checks, viewport matrix execution, coverage artifacts, local review artifact indexes, and aggregated findings.
- `review --resource-guard advisory|fail-critical|off` controls additive local resource guard behavior. Advisory is the default. Fail-critical can stop before browser launch or skip remaining target work only when resource status is critical. Resource guard output does not change review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.
- `target init --url <url>` writes a reusable local target manifest artifact under `.browser-debug/targets/` with same-origin scope, seed route, empty expected route and page lists, viewport matrix, route budget, screenshot defaults, and safe local review boundaries.
- `target validate --target <manifest>` or `target validate --input -` loads a target manifest through the same normalization contract as target review, returns route/page/content UX counts, manifest-authoring suggestions, review next commands, and explicit local-first boundaries, and does not launch a browser, mutate the manifest, expose sourceData values, upload artifacts, or reuse profiles.
- Review results include `action_plan`, `review_advisory`, `quality_signals`, `evidence_summary`, and `artifact_index` objects. Target review results also include `manifest_suggestions`, and can include `local_content_ux_advisory`, `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, `content_ux_page_handoff`, `content_ux_manifest_authoring`, `content_ux_review_brief`, and `content_ux_rubric_evaluation` only when the target manifest explicitly enables it. `action_plan` prioritizes review findings, groups developer next actions, and reports a local release gate. Content UX action/readiness/page/authoring/brief/rubric output is separate and advisory-only. `review_advisory` is a local heuristic signal that summarizes browser health, rendered state, layout, accessibility, interaction, mock, and coverage concerns without claiming human or model aesthetic approval. `quality_signals` gives structured developer handoff data for visual hierarchy, rendered state, responsive layout, interaction affordance, accessibility structure, evidence completeness, local release readiness, route coverage, page expectations, optional content UX advisory, and the disabled model-review boundary. `artifact_index` points to a local artifact index JSON that groups evidence classes and rerun guidance.
- `schema list` and `schema get --name <schema>` expose machine-readable JSON contracts for envelopes, artifacts, findings, target manifests, review results, and MCP tool metadata.
- `browser-debug-mcp` provides a local stdio MCP adapter with an allowlisted tool surface over the same CLI/core contracts, including target manifest initialization, target manifest validation, local resource status preflight, local artifact usage planning, and target review. It does not expose artifact cleanup execution.
- `act --input -`, `supervise --input -`, `--action @file`, and `--actions @file` support shell-safe structured input while preserving inline JSON compatibility.
- `npm test` runs deterministic no-browser tests, including headed/devtools launch-mode regression through an injected Playwright browser type and architecture regressions for generic runtime boundaries, shared page evidence helpers, local daemon boundaries, and local Node CLI packaging. `npm run test:browser` runs Playwright smoke tests for observation, screenshots/traces, click actions, form controls, keyboard input, scroll, wait, reports, spec export, supervised ordered actions, and local daemon start/status/stop.
- `npm run test:pack` runs `npm pack --dry-run --json` with a `/tmp` npm cache to verify the package file set without publishing.
- `.github/workflows/ci.yml` defines GitHub Actions jobs for Node.js checks, package dry-run verification, explicit Chromium installation, and browser smoke tests. It uses current GitHub action major versions for checkout and Node setup. `ops/CI_MANIFEST.tsv` and `tools/check_product_ci.sh` validate that definition locally.
- `npm run release:check` runs no-browser and package release-readiness checks without publishing. Browser smoke coverage remains a separate explicit local check because it launches Chromium.
- `CHANGELOG.md` and `docs/workflow/RELEASE.md` track unreleased local changes, release blockers, local readiness checks, and no-publish boundaries.

The package is marked `private` and `UNLICENSED` until public release naming, licensing, and npm publication are approved.

## Implemented Review Platform

The review platform is implemented as a reusable layer above the current Playwright runtime. It does not reimplement Playwright and does not clone the full Playwright MCP tool surface. It collects local browser evidence, normalizes that evidence, and emits developer-facing findings with explicit evidence and confidence.

Implemented review components:

- `playwright-runtime`: shared browser, context, page, action, screenshot, and trace execution.
- `evidence-model`: normalized DOM, accessibility, bounding box, computed style, console, network, viewport, and artifact evidence.
- `review-engine`: deterministic and bounded heuristic rules for browser health, rendered state, layout integrity, interaction quality, accessibility basics, mock fidelity, evidence quality, heading hierarchy, landmarks, image alt text, broken visible images, explicit or semantically marked lingering loading indicators, empty data containers, contrast, overlap, and mobile target sizing.
- `site-review`: target manifest loading, route discovery, viewport matrix execution, action risk policy, budgets, and coverage reporting.
- `reporter`: JSON and Markdown issue reports with artifact references, reproduction steps, prioritized action plans, developer triage summaries, manifest suggestions, local artifact indexes, local heuristic advisory data, and implementation-focused fix candidates.
- `content-ux-advisory`: pure local helper that reads normalized manifest data and target review summaries, then returns advisory source-to-screen, selector-scoped state, and user-question signals without Playwright, filesystem access, or artifact reads.
- `resource-status`: pure local preflight helper that reads process-visible memory, swap, cgroup, and pressure state without Playwright, shell execution, host mutation, artifact writes, or external transfer.
- `resource-guard`: reusable review guard that classifies local resource pressure before browser work and before each target route/viewport review.
- `resource-artifacts`: local artifact usage and explicit cleanup helper scoped to the configured artifact root with dry-run and receipt behavior.
- `schema`: machine-readable contracts for envelopes, findings, artifacts, target manifests, reports, and MCP tool I/O.
- `cli-adapter`: the primary command surface for review workflows.
- `mcp-adapter`: a thin local stdio adapter over the same core through `browser-debug-mcp`.

The review MVP supports:

```text
browser-debug review --url <url> --viewport <name-or-size> --screenshot --json
```

It should produce the standard JSON envelope with `data.review`, `data.findings`, `data.metrics`, `data.action_plan`, `data.review_advisory`, `data.quality_signals`, additive `data.resource_guard`, and `data.environment`, plus artifact descriptors. Findings should include:

```text
id
category
severity
confidence
source
selector
rect
route
viewport
message
evidence
artifacts
repro
priority
impact
recommendation
fix_candidates
implementation_notes
owner_decision_required
```

The initial deterministic categories are:

- `browser_health`: console errors, page errors, failed requests, navigation failures, broken visible images, and timeout warnings.
- `layout_integrity`: empty render, horizontal overflow, clipped text, explicit lingering loading indicators, empty data containers without empty-state messaging, overlapping visible elements, zero-size important elements, and off-viewport primary controls.
- `interaction_quality`: actionability, focus visibility, hover/focus evidence, target size, mobile touch-target sizing, disabled state, and basic keyboard path signals.
- `accessibility_basics`: missing accessible names, unlabeled form controls, duplicate IDs, heading hierarchy issues, missing main landmarks, missing image alt text, low text contrast, and basic ARIA/name issues.
- `mock_fidelity`: optional screenshot-to-mock metrics, masked regions, and conservative inconclusive states.
- `evidence_quality`: missing screenshots, unstable captures, missing environment metadata, and review limitations.

The site review command supports a generic target manifest:

```text
browser-debug review --target <manifest> --json
```

The target manifest should describe:

```text
baseUrl
scope
seeds
expectedRoutes
pages
sourceData
localContentUxAdvisory
viewportMatrix
actionPolicy
budgets
artifacts
masks
regions
appHints
```

The runtime must not contain product-specific branches for individual applications, localhost ports, route names, menu labels, or page IDs. Those targets can be represented as local manifests, fixtures, or acceptance evidence outside the generic review runtime.

Route discovery is generic and uses same-origin anchors and navigation action candidates in the current implementation. Manifest `expectedRoutes` are also enqueued as explicit review targets, so owners can cover known routes that are not discoverable from the initial crawl. Optional manifest `pages` are also enqueued as review targets and can define `name`, `url` or `path`, `priority`, `viewports`, `expectations.text`, `expectations.selectors`, `expectations.dataBindings`, and optional page-level `mock` metrics. Coverage output reports expected, discovered, visited, skipped, failed, expected-missing routes, and page expectation checks. Queued routes or pages that cannot be reviewed because `budgets.maxRoutes` is exhausted are recorded as skipped with `reason=route_budget_exceeded`. Later enhancements may add history navigation, DOM metadata, redirects, and app-provided manifest hints without changing the core contract.

`target init` exists so a developer or agent can create a starting manifest before reviewing a whole application. The generated manifest is intentionally generic: it does not include application-specific route names or control labels, and it expects owners to add known `expectedRoutes`, `pages`, route budgets, viewport matrices, masks, or regions as needed. `target validate` exists as a no-browser authoring checkpoint after those edits. It reports normalized manifest counts and advisory authoring gaps without reading arbitrary source-data files or URLs, exposing sourceData values, launching Chromium, or writing changes back to the manifest. After editing, `expectedRoutes` and `pages` are review inputs, not just passive coverage expectations.

Action exploration should be risk-gated. The default policy may execute navigation and read-only state-revealing actions. Input-required, mutating, destructive, and external actions require explicit manifest allowlists and must remain local-first.

Mock comparison is optional. The current local implementation compares PNG dimensions, hashes, and byte-difference metrics without adding image-processing dependencies. If actual and mock dimensions differ, the result is `inconclusive` rather than a false pass/fail claim. Pixel heatmaps and region crops remain later compatible enhancements.

## Local Quality Signals Contract

`quality_signals` is an additive review output object. It is designed for developer triage and agent handoff, not final product approval. Single-URL review includes:

```text
visual_hierarchy
rendered_state
responsive_layout
interaction_affordance
accessibility_structure
evidence_completeness
developer_handoff
release_readiness
model_review_boundary
```

Target-manifest review includes:

```text
route_coverage
page_expectations
content_ux
viewport_coverage
rendered_state
finding_summary
evidence_completeness
developer_handoff
release_readiness
model_review_boundary
```

The `model_review_boundary` signal must remain `not_enabled` with `external_evidence_transfer=false` until a separately approved model or vision review layer exists. Local release readiness is a review gate over the current evidence only; it does not authorize package publication, license changes, marketplace registration, npm publication, or evidence upload.

For target reviews, `quality_signals.route_coverage` includes expected manifest route counts, visited route-viewport counts, skipped route counts, and route-budget-exceeded counts so agents can decide whether to raise the route budget, split a manifest, or rerun the review. `quality_signals.page_expectations` includes expected page counts, checked pages, failed pages, skipped pages, missing text expectations, and missing selector expectations so agents can identify page-state mismatches before human or model approval. `quality_signals.content_ux` is present only for manifest opt-in advisory runs and summarizes source-to-screen, selector-scoped binding, and required user-question advisory counts without affecting release readiness. `quality_signals.rendered_state` summarizes broken-image, loading-indicator, and empty-container findings across visited route viewports.

`manifest_suggestions` is an additive target-review output. It suggests manifest-only improvements such as adding named page expectations, pinning important expected routes, raising or splitting exhausted route budgets, reviewing failed page expectations, and adding fixtures or page expectations for rendered-state gaps. Suggestions are advisory and never mutate manifest files automatically.

## Local Content UX Advisory Contract

`local_content_ux_advisory` is an additive target-review output. It is emitted only when a target manifest declares `localContentUxAdvisory.enabled=true`. Absent or disabled configuration keeps target review output compatible with previous behavior.

The manifest contract is:

```text
sourceData
localContentUxAdvisory.enabled
localContentUxAdvisory.audience
localContentUxAdvisory.goal
localContentUxAdvisory.checks
localContentUxAdvisory.requiredUserQuestions[]
localContentUxAdvisory.reviewBrief
localContentUxAdvisory.rubric[]
pages[].role
pages[].expectations.dataBindings[]
pages[].expectations.userQuestions[]
```

`sourceData` supports bounded inline JSON entries with `id`, `data`, optional `required`, and optional `maxSizeBytes`. The local implementation does not read arbitrary manifest paths or remote source URLs. If a source entry declares a `path` or `url`, the advisory records that the external reference was ignored and asks the owner to provide bounded inline data or approve a future loader design.

Each `dataBindings` entry can declare `id`, `sourceId`, JSON Pointer `pointer`, optional `selector`, `target`, `attribute`, `match`, `severity`, and `required`. `target="text"` checks either reviewed page text or selector-scoped element text when `selector` is provided. `target="attribute"` requires a selector and an attribute name from the bounded element-evidence allowlist. `target="data-state"` checks selector-scoped state attributes such as `data-state`, `data-status`, `aria-current`, `aria-selected`, `aria-expanded`, or `aria-pressed`. `target="data-risk"` checks selector-scoped risk attributes such as `data-risk`, `data-severity`, `aria-invalid`, or `aria-disabled`.

`requiredUserQuestions` and page-level `userQuestions` can declare `id`, `question`, optional `pageId`, optional `selector`, `expectedEvidence`, `matchMode`, `textMatch`, `severity`, and `required`. The advisory checks whether the reviewed page text or selector-scoped element text contains enough evidence for the target user to answer the declared question. This is a local heuristic information-architecture signal, not subjective product approval.

`reviewBrief` can declare `summary`, `userRoles`, and `decisionNeeds[]`. `rubric[]` can declare `id`, `category`, optional `pageId`, optional `selector`, `criterion`, `expectedEvidence`, `matchMode`, `textMatch`, `severity`, and `required`. Manifest pages can declare a generic `role` such as `status_overview`, `triage_detail`, or `decision_gate`. The local advisory evaluates decision needs and rubric criteria against reviewed page text or selector-scoped element text, but it does not copy expected evidence values or source values into report output.

The output includes status, counts, advisory signals, separate `content_ux_findings`, separate `content_ux_action_plan`, separate `content_ux_readiness`, separate `content_ux_page_handoff`, separate `content_ux_manifest_authoring`, separate `content_ux_review_brief`, separate `content_ux_rubric_evaluation`, source-data availability counts, user-question counts, limitations, and `quality_signals.content_ux`. It does not copy source values, full page text, raw DOM, screenshots, console payloads, or network payloads into the advisory output or Markdown report. It is advisory-only: it must not create review findings, change `metrics.finding_count`, change the existing `action_plan`, change `quality_signals.release_readiness`, or authorize external evidence transfer.

`content_ux_findings` are not entries in the existing `findings` array and do not use the review finding schema. They are bounded developer-handoff records derived from local advisory signals with category, severity, confidence, source signal, selector/page context, sanitized evidence summary, recommendation, and `gate_effect="none"`. `content_ux_action_plan` groups those advisory records into content-owner next actions and sets `legacy_action_plan_unchanged=true`. `content_ux_readiness` summarizes advisory-only readiness and sets `legacy_release_readiness_unchanged=true`, `blocking_release_gate=false`, and `external_evidence_transfer=false`.

`content_ux_findings.category` can include `content_contract`, `source_data_alignment`, `status_clarity`, `information_architecture`, `action_clarity`, `navigation_clarity`, `coverage_contract`, or `review_scope`. Existing manifests that declare `workflow_state_clarity` or `next_action_clarity` as rubric categories remain accepted as legacy-compatible aliases, but generated templates and default advisory findings use the domain-neutral category names. `content_ux_page_handoff` groups advisory findings by manifest page, including page status, finding count, top categories, and bounded top findings. `content_ux_manifest_authoring` suggests manifest-only improvements such as declaring audience or goal, adding inline source data, adding page data bindings, adding user questions, fixing binding pointers, or strengthening action and navigation contracts. These suggestions are advisory and never mutate the manifest automatically.

`content_ux_review_brief` summarizes declared audience, page roles, and decision needs. `content_ux_rubric_evaluation` summarizes rubric criteria by category and records passed, owner-review, and inconclusive criteria. Both are local, advisory-only, additive, and separate from review findings and release readiness.

## Local Artifact Index Contract

Each review writes a local `review_artifact_index` JSON artifact under `.browser-debug/review-artifacts/`. The index records the review ID, review mode, artifact root, artifact descriptors, evidence classes, triage summary, coverage summary when available, rerun guidance, and local safety boundaries. The index is a handoff aid only; it does not upload evidence, delete artifacts, reuse browser profiles, store credentials, or authorize publication.

## Local Resource Status Contract

`resource status` is a no-browser preflight command for planning browser-heavy work. It reads process-visible system memory, swap, cgroup memory limits, Linux memory pressure data when available, and current Node.js process memory. The standard JSON envelope includes `data.resource_status.status`, memory snapshots, cgroup snapshots, pressure snapshots, process memory, thresholds, recommendations, a `cache_policy`, and explicit local boundaries.

The command status reflects successful inspection, while `data.resource_status.status` can be `ok`, `watch`, or `critical`. `watch` and `critical` produce warnings and recommendations such as reducing route or viewport budgets, splitting manifests, validating target manifests before browser review, capturing screenshots and traces selectively, and stopping unneeded Browser Debug CLI daemons. These are planning signals, not deterministic product gates.

The command must not launch a browser, write artifacts, upload evidence, reuse browser profiles, mutate system cache, change swap configuration, delete files, execute shell commands, run privileged helpers, or control arbitrary processes. Any future host cleanup, swap configuration, cleanup outside the configured artifact root, or privileged memory operation requires a separate approved design, security documentation, tests, and operator approval.

## Local Resource Guard and Artifact Safety Contract

`review --resource-guard advisory|fail-critical|off` reuses the local resource status contract. It records preflight checks before single-URL review and route/viewport checks during target review. Advisory is the default and emits warnings only. Fail-critical can stop browser launch or skip remaining target work only when the resource status is critical. The output is additive under `data.resource_guard` and must not change review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

`resource artifacts plan` inventories the configured artifact root and returns summary totals, top-level directory totals, largest files, cleanup candidates, and no-delete boundaries. `resource artifacts cleanup --dry-run` returns the same proposal without deleting files. `resource artifacts cleanup --execute` deletes selected regular files only under the configured artifact root and writes a local receipt under `receipts/`. It does not follow symlinks, mutate system cache, configure swap, execute shell commands, use privileged helpers, upload evidence, reuse profiles, control arbitrary processes, or expose cleanup execution through MCP.

## Agent Advisory Handoff Contract

The agent advisory layer is a local handoff/import contract for subscription-capable local agents and a future API-provider boundary. It is not direct model/API execution and is not a deterministic review gate.

The surface registry uses provider-neutral records:

```text
id
kind: subscription_surface | api_provider
transport: local_files | local_stdio | provider_api
status: available | approval_required | disabled
external_evidence_transfer
credential_mode
implemented
capabilities
boundaries
```

`local-subscription-agent` and `local-stdio-agent` are available local surfaces. `generic-api-provider` is an approval-bound boundary marker only; it does not contact a provider, require credentials, upload evidence, or send artifacts outside the local process.

`agent_task_package` records:

```text
source review artifact index
surface
disclosure_policy
evidence_packet
prompt metadata
local safety boundary
```

The disclosure policy defaults to metadata and local artifact references only. Raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, and report bodies are excluded by default. The command writes content-free receipts with hashes, included evidence classes, sensitive artifact reference types, and explicit `api_call_performed=false`.

`agent_request_status` records:

```text
package id, package path, prompt path, receipt path
source review artifact index and review id
task and surface
status: waiting_for_agent | advisory_imported
imported result paths and latest result path
advisory finding count and owner decision request count
local safety boundary flags
```

The request status command is a local index over package/result metadata. It does not execute an agent, call a provider API, upload evidence, store credentials, mutate review artifacts, or change deterministic gates.

`agent_request_detail` records one request's local handoff detail:

```text
package path, prompt path, receipt path
status and selected/latest result paths
source review artifact index metadata
package disclosure policy and local artifact-reference summary
bounded advisory finding/action/owner-decision counts
dashboard handoff hints and local safety boundary flags
```

The request detail command is read-only over local package/result metadata. It does not write artifacts, execute an agent, call a provider API, upload evidence, store credentials, mutate review artifacts, or change deterministic gates.

`agent_workflow` records one local dashboard or automation handoff workflow:

```text
workflow id, name, path, receipt path, and evaluated time
package path, prompt path, request status, and request detail
step state for package, agent review, ingest, and report
dashboard handoff commands for status, index, ingest, and report
provider boundary flags
local safety boundary flags
```

Workflow create writes only local workflow metadata and a receipt under `.browser-debug/`. Workflow status and index are read-only over workflow/package/result metadata. Workflow report writes a bounded local Markdown status summary. These commands do not execute an agent, call a provider API, upload evidence, store credentials, mutate review artifacts, expose MCP agent execution, or change deterministic gates.

`agent_advisory_result` records imported advisory output as untrusted text. It may include visual design, content information architecture, user journey, mock interpretation, implementation diagnosis, accessibility advisory, and evidence-quality categories. It must set `gate_effect="none"`, `legacy_action_plan_unchanged=true`, `legacy_release_readiness_unchanged=true`, and `blocking_release_gate=false`. Imported advisory output must never execute shell commands, browser actions, file edits, cleanup, publication, dependency changes, manifest mutations, or external uploads.

## Agent Execution Contract

The agent execution layer is an additive bridge from local packages to local subscription runners or API provider adapters. The current implementation covers the no-network dry-run plan, explicit run parser/API surface, dedicated provider adapter registry, deterministic fake provider, configured local runner callback boundary, env-only generic API provider adapter, local status, and local list contract. This layer is not a replacement for review, workflow, ingest, or report commands. It must keep the existing package, workflow, ingest, report, resource, daemon, cleanup, and review contracts intact.

`agent_execution` records:

```text
execution id, name, path, receipt path, created time, updated time
package path, prompt path, source review artifact index, workflow path
surface id, surface kind, provider id, model id, runner id
mode: dry_run_plan | run
status: planned | running | completed | failed | blocked
step state for plan, runner/provider call, advisory normalization, ingest, and report
advisory result path, normalized result summary, and dashboard handoff commands
credential requirement names and credential source labels without values
disclosure policy, evidence transfer policy, and artifact class summary
boundary flags and gate effect
```

The dry-run command:

```text
browser-debug agent execution plan --package <agent-package> --surface <surface-id> --provider <provider-id> --model <model-id> --json
```

is the default no-network operation. It validates the package, resolves the surface, records the disclosure policy, records provider/model selection metadata, and writes local plan metadata plus a receipt under `.browser-debug/agent-executions/`. It sets `api_call_performed=false`, `external_evidence_transfer=false`, `automatic_upload=false`, `credential_values_recorded=false`, `credential_storage="none"`, `persistent_credential_storage=false`, `raw_response_stored=false`, `raw_provider_response_stored=false`, `existing_review_mutated=false`, `mcp_execution_exposed=false`, and `gate_effect="none"`.

The run command:

```text
browser-debug agent execution run --execution <agent-execution> --package <agent-package> --surface <surface-id> --provider <provider-id> --model <model-id> --execute --json
```

requires a prior dry-run execution record and an explicit `--execute` flag, and fails deterministically without either. Runtime validation rejects package, surface, provider, or model mismatches between the run request and the dry-run plan. The provider adapter registry is dedicated to agent execution and is not reachable from review, resource, daemon, cleanup, Playwright, or MCP execution paths.

Implemented providers:

- `fake-agent`: deterministic local provider for no-browser provider success/failure and dashboard contract coverage. It performs no API call or external transfer.
- `local-runner`: configured local runner callback boundary for subscription-style execution. It uses provider/model identifiers and package API context callbacks, not free-form shell input or SaaS web UI automation.
- `generic-api-provider`: one-shot provider API adapter. It reads endpoint and credential values only from `BROWSER_DEBUG_AGENT_API_ENDPOINT` and `BROWSER_DEBUG_AGENT_API_TOKEN`, never from CLI arguments, committed files, package artifacts, workflow files, reports, receipts, `.env` auto-loading, or persistent local storage. Tests use injected transports rather than live network calls.

Execution may send only bounded package and prompt content allowed by the disclosure policy. By default, it must not transfer raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, report bodies, cookies, storage state, existing browser profile data, or raw review artifacts. API execution must record that an API call occurred and which bounded evidence classes were sent, but it must not store raw provider responses. Runner/provider output is normalized into `agent_advisory_result` and remains untrusted advisory data.

`agent execution status --execution <path> --json` reads one local execution record and reports current state, normalized advisory result path, missing credential hints, receipt paths, dashboard handoff commands, dashboard status fields, and boundary flags. `agent execution list --json` scans local execution records and returns aggregate planned/running/completed/failed/blocked counts, advisory-result counts, and boundary flags for dashboards and local automation. Status and list are read-only and must not launch browsers, call providers, upload evidence, store credentials, write review artifacts, or change deterministic gates.

The planned layer keeps dashboard user experience aligned across subscription and API modes:

```text
agent package -> agent execution plan/run -> agent execution status/list -> agent ingest/report -> agent workflow status/index/report
```

It does not change review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, `resource_guard`, artifact cleanup behavior, target manifest behavior, or existing `agent_workflow` status meanings.

## MCP Adapter Contract

MCP compatibility is implemented as an adapter, not as the product owner layer. The initial MCP adapter:

- Uses stdio/local process communication only.
- Calls the same CLI/core contracts used by local commands.
- Exposes a narrow allowlist: `browser_debug_doctor`, `browser_debug_observe`, `browser_debug_review`, `browser_debug_target_init`, `browser_debug_target_validate`, `browser_debug_resource_status`, `browser_debug_resource_artifacts_plan`, `browser_debug_review_target`, `browser_debug_schema_list`, and `browser_debug_schema_get`.
- Avoids HTTP listeners, socket listeners, remote control channels, arbitrary shell execution, cleanup execution commands, profile reuse, storage-state persistence, OAuth, external upload, and credential handling.
- Does not expose `agent execution run`; execution remains a CLI/API-core boundary unless a later explicit MCP allowlist decision adds read-only plan/status tools.
- Returns the same envelope families as the CLI.

Any network MCP server mode, external model integration, external upload, existing-profile reuse, or credential-bearing workflow requires separate approval, security documentation, and tests.

## Browser Modes

- `headless`: default fast mode for structured observation and regression debugging.
- `headed`: visible browser mode for final UI/UX quality, animation, hover, focus, and operation feel.
- `devtools`: headed mode with DevTools for targeted inspection.

Long-running browser supervision is opt-in. `supervise` is process-scoped, uses an ephemeral context, does not reuse a user's normal browser profile, and closes before CLI exit. `daemon start` is background-scoped, uses a detached local worker with an ephemeral context, writes only ignored local metadata and observations, and stops through `daemon stop`. The default `observe` path still launches an ephemeral context, collects the requested evidence, and closes cleanly after one page observation.

## AI Interaction Contract

The CLI should expose structured observations and action candidates. The AI decides the next action outside the CLI, then sends that action back to the CLI. This keeps the tool agent-independent and avoids binding the product to one model, one chat UI, or one MCP runtime.

Review output should distinguish deterministic findings, heuristic findings, model-advisory findings, and owner-required decisions. "No findings" means no configured rule violation was observed; it must not be presented as proof that the design is good.

## Artifact Contract

Artifacts should be local by default and written under an ignored product workspace directory such as `.browser-debug/`. Planned artifact types include:

- screenshots
- traces
- console summaries
- network failure summaries
- accessibility summaries
- action history
- issue reports

Sensitive browser data must not be emitted unless a later approved feature defines safe redaction and explicit consent.

The initial artifact layout is:

```text
.browser-debug/
  sessions/
  observations/
  screenshots/
  traces/
  reports/
  specs/
  daemons/
  targets/
  reviews/
  layouts/
  diffs/
  coverage/
  review-artifacts/
  receipts/
```

Committed files must not include `.browser-debug/`, screenshots, traces, cookies, storage state, existing browser profiles, credentials, or secret-like values.

The default artifact retention policy is manual retention. Browser Debug CLI does not automatically delete generated artifacts and does not upload artifacts. Developers may remove the ignored `.browser-debug/` root themselves after reviewing whether screenshots, traces, reports, or session metadata are still needed, or run explicit artifact-root-scoped cleanup with `resource artifacts cleanup --execute`. Built-in cleanup must remain explicit, local-only, receipt-backed, tested, and limited to selected regular files under the configured artifact root.

## JSON Output Contract

Every command that supports `--json` should return an object with these top-level fields:

```text
schema_version
command
status
observed_at
data
warnings
errors
artifacts
```

Errors must be structured and non-secret-bearing. Page content, console output, network data, screenshots, traces, and model suggestions remain untrusted data.

## Schema Versioning Contract

The local MVP schema version is `0.1.0`. This version applies to top-level JSON envelopes, artifact descriptors, local session metadata, daemon metadata, supervision metadata, observation artifacts, and spec exports unless a file declares a more specific artifact schema.

Compatible changes may add fields while keeping existing field names, meanings, and JSON types stable. Breaking changes include renaming fields, removing fields, changing field types, or changing status/error vocabulary semantics; those changes require a schema version bump, synchronized product documents, and regression tests.

`doctor --json` exposes `data.schema_version_policy` and `data.artifact_retention` so agents and scripts can inspect the current compatibility and artifact-retention policy without scraping documents.

## Plugin Bundle Contract

The repository includes local Codex plugin metadata:

```text
.codex-plugin/plugin.json
.mcp.json
skills/browser-debug-review/SKILL.md
templates/review-target-manifest.json
```

The plugin bundle points to the local stdio MCP adapter and the plugin-facing review skill. It does not register a marketplace entry, publish a package, change the license, add external upload, add OAuth, add credential storage, or start HTTP/socket MCP transports.

## Runtime Security Contract

- Browser contexts are ephemeral by default.
- Existing browser profiles, cookies, storage state, local storage, and credentials are not read or written.
- Artifact root paths must stay inside the current workspace.
- Observation and report data applies basic redaction to common secret-like strings and sensitive URL query parameters.
- Trace zip files are raw local evidence and can contain unredacted page content. They must remain under ignored `.browser-debug/` paths unless a future approved workflow defines safer handling.
- Process-scoped supervision and background daemon supervision both use ephemeral contexts. The background daemon does not create a persistent browser profile, persistent storage state, external control channel, HTTP listener, socket server, or artifact upload path.

## OSS Workflow Contract

The repository should move through these phases:

- Phase 0: scaffold and synchronized planning documents.
- Phase 1: local Git initialization and first commit.
- Phase 2a: package/runtime design without network, dependency installation, or runtime implementation.
- Phase 2b: public GitHub repository creation through `gh`.
- Phase 3: GitHub Actions CI.
- Phase 4: npm package metadata and CLI packaging implementation.
- Phase 5: MVP Playwright implementation.
- Phase 6: release and npm publish flow.

The current repository implements local CI configuration, local CI validation, release readiness documentation, dry-run package verification, public GitHub repository creation, `origin/main` synchronization, and remote GitHub Actions `main` CI verification. It does not execute npm publication or other public release actions.

## Out of Scope for Phase 0

- Runtime CLI implementation.
- Dependency installation.
- Browser launch.
- GitHub remote creation.
- npm package publication.
- Remote CI workflow execution.

## Out of Scope for Phase 2a

- Dependency installation.
- Browser launch.
- Runtime Playwright implementation.
- GitHub remote creation.
- Remote CI workflow execution.
- npm package publication.

## Out of Scope for the Current Local MVP

- Existing browser profile reuse.
- Authentication automation, OAuth flows, webhook handling, external upload, and credential storage.
- Remote trace storage or trace upload.
- GitHub remote setup, remote CI workflow execution, npm publication, or external upload.

## Out of Scope for the Review Platform MVP

- Full Playwright API parity.
- Full Playwright MCP tool parity.
- Human-style subjective design approval as deterministic proof.
- Model or vision review as a required dependency.
- External model/API calls without explicit opt-in.
- Product-specific runtime branches for individual applications.
- Persistent browser profile reuse, storage state, authentication automation, OAuth, webhooks, or credential storage.
- HTTP/socket MCP server mode or arbitrary shell execution.

# REQUIREMENTS.md

## Purpose

Browser Debug CLI should make browser debugging reusable across repositories and AI agents. It should provide a local Playwright-based command surface that can observe a page, expose safe action candidates, run selected actions, and produce evidence for UI/UX and functional debugging.

## Users

- Developers who want fast browser-debug feedback during feature work.
- AI coding agents that need browser state without depending on Playwright MCP.
- Reviewers who want reproducible UI/UX findings with screenshots, traces, and notes.
- OSS users who want a repository-agnostic CLI they can add to different projects.

## Required Outcomes

- Provide a standalone CLI that can be used from any repository.
- Use Playwright as the browser automation layer.
- Provide a Node.js package layout with a stable local CLI binary before public release work starts.
- Support fast headless observation for routine debugging.
- Support headed browser and DevTools workflows for visual quality, animations, hover, focus, scroll, and final interaction checks.
- Support an opt-in process-scoped supervised browser run for ordered local actions when one-shot observation is too slow.
- Support an opt-in local background daemon for ephemeral browser supervision when a browser must stay open across CLI invocations.
- Return structured page observations suitable for AI decision making.
- Provide explicit action candidates instead of requiring raw DOM scraping.
- Record reproducible artifacts such as screenshots, traces, console messages, network summaries, and issue reports.
- Keep JSON output deterministic enough for agents, scripts, and regression tests to consume.
- Keep secrets, cookies, storage state, and existing browser profiles out of committed artifacts.
- Keep the design agent-independent: Codex, other agents, scripts, or humans should all be able to use the same CLI.
- Prepare for OSS distribution through local Git, GitHub publication with `gh`, CI, and npm packaging in later phases.
- Prepare a CLI-first review platform that exposes the same review core through MCP adapters without making MCP the required runtime.
- Preserve three usable integration paths: the CLI for any shell, human, or agent; MCP stdio for MCP clients; and a Codex plugin wrapper for skill/MCP discovery.
- Provide an explicit safe HTTP MCP endpoint for local MCP-compatible tooling that cannot use stdio, while keeping it loopback-only, bearer-token gated, and limited to safe no-browser/read-only tools.
- Provide machine-readable MCP client configuration output so humans, agents, and external repositories can connect through stdio or explicit safe HTTP without reverse-engineering package internals.
- Support evidence-backed UI review findings for browser health, layout integrity, interaction quality, accessibility basics, and mock fidelity.
- Support generic target manifests so site review can cover local applications and dashboards without hard-coded product-specific branches.
- Treat manifest `expectedRoutes` as reviewable local targets so known app routes can be covered even when route discovery cannot find them from anchors or navigation candidates.
- Support optional manifest `pages` entries so named pages can define expected visible text, expected selectors, page-specific viewport coverage, and page-specific mock metrics without runtime product branches.
- Support manifest opt-in content UX advisory data so whole-application reviews can compare declared source facts with reviewed page text, selector-scoped UI state, and required user-question evidence without changing deterministic review findings or local gates.
- Provide separate content UX handoff outputs for advisory findings, next actions, and readiness so developers can act on content and information-architecture issues without mixing them into existing review findings, action plans, metrics, or release gates.
- Provide page-level content UX handoff and manifest-authoring suggestions so developers can see which page, route, selector, or target-manifest contract needs attention.
- Provide separate content UX review brief and rubric evaluation outputs so developers can compare reviewed page evidence with manifest-declared audience, page roles, user decision needs, and product communication criteria without changing existing review fields.
- Keep review findings developer-facing, reproducible, and tied to selectors, rectangles, routes, viewports, artifacts, confidence, severity, and reproduction steps.
- Produce a local review artifact index that groups review JSON, layout JSON, screenshots, mock metrics, coverage, reports, evidence classes, local boundaries, and rerun guidance for developer handoff.
- Detect generic rendered-state risks such as broken visible images, lingering loading indicators after the review wait, and empty data containers without visible empty-state messaging.
- Generate reusable target manifests so whole-application review can start from a URL without hand-writing the full manifest.
- Validate edited target manifests before browser review so developers can catch manifest shape, route, page expectation, content UX, and local boundary issues without launching Chromium.
- Provide a no-browser local resource status preflight so developers and agents can inspect memory, swap, cgroup, pressure, and process memory signals before browser-heavy review work.
- Integrate resource status into review as additive resource guard output with default advisory behavior, optional fail-critical stopping, route/viewport rechecks, and screenshot/trace pressure warnings.
- Provide optional daemon idle-timeout and max-lifetime guards so local background browsers do not remain alive indefinitely when users opt into lifecycle bounds.
- Provide local artifact usage planning and explicit `.browser-debug/`-scoped cleanup receipts so users on constrained machines can manage artifact growth without host cache or swap mutation.
- Provide local agent advisory handoff so a dashboard, local subscription agent, or future API provider boundary can use the same review package and normalized advisory-result schema.
- Provide local `agent package`, `agent ingest`, and `agent report` commands that create bounded evidence packages, import untrusted advisory JSON, and render separate advisory reports without changing deterministic review output.
- Provide local `agent requests list` and `agent requests show` output so dashboards and local automation can track and inspect advisory packages without running provider APIs or mutating review output.
- Provide local `agent workflow create`, `agent workflow status`, `agent workflow index`, and `agent workflow report` output so dashboards and local automation can track package, prompt, agent response, ingest, report-pending states, and local workflow summaries without running provider APIs or changing review output.
- Provide an agent execution layer so dashboards, local automation, subscription-style local agents, and API-style provider execution can share the same package, dry-run plan, run, status, result/report, and workflow experience without changing deterministic review output.
- Support subscription-style local agent execution through configured local runner callbacks, not through SaaS web UI automation or free-form shell input.
- Support API-style provider execution only through a dry-run execution plan, explicit `--execute`, env-only credentials, bounded disclosure policy, local receipts, and advisory-only result normalization.
- Provide local `agent execution plan`, `agent execution run`, `agent execution status`, and `agent execution list` contracts as an additive layer separate from existing `agent workflow` state.
- Suggest target manifest improvements when dogfood review evidence shows missing page expectations, unpinned discovered routes, exhausted route budgets, failed page checks, or rendered-state gaps.
- Provide action plans, implementation-focused fix candidates, and local heuristic advisory signals that help developers decide what to fix first.
- Provide structured local quality signals for visual hierarchy, rendered state, responsive layout, interaction affordance, accessibility structure, evidence completeness, local release readiness, and model-review boundaries.
- Provide local plugin metadata so Codex can discover the CLI/MCP review workflow without making remote services mandatory.

## Non-Goals

- Do not clone Playwright MCP or require MCP as the runtime interface.
- Do not replace final visual review; the tool should help operate and capture evidence, while humans approve product-level decisions when needed.
- Do not bypass authentication or collect credentials.
- Do not upload artifacts to external services by default.
- Do not add runtime features that cross into authentication, profile reuse, external upload, credential handling, or external daemon control channels without explicit implementation approval and security documentation.
- Do not create public repositories, remotes, remote CI execution, or npm publication paths as part of package/runtime design.
- Do not reimplement Playwright or clone the full Playwright MCP tool surface.
- Do not claim subjective visual judgment as deterministic proof; subjective or model-assisted review findings must remain advisory unless backed by deterministic evidence and owner acceptance.
- Do not hard-code individual application names, localhost ports, route names, or product-specific UI labels into the generic runtime.
- Do not send screenshots, traces, raw DOM, source text, console logs, network evidence, or reports to a model or external service without explicit opt-in and security documentation.
- Do not treat content UX advisory as deterministic product approval, a replacement for owner judgment, or a release gate.
- Do not treat content UX review brief or rubric output as model judgment, aesthetic approval, deterministic product approval, or a release gate.
- Do not read arbitrary source-data files or remote source-data URLs from target manifests in the local content UX advisory layer.
- Do not mutate system memory cache, configure swap, delete artifacts automatically, kill arbitrary processes, or perform privileged host cleanup from the local resource status preflight or guard.
- Do not expose artifact cleanup execution through MCP; MCP may report local artifact usage but must not delete files.
- Do not expose HTTP `full` or `admin`, remote HTTP listeners, socket transports, shell tools, cleanup execution, package generation, ingest, report writing, workflow creation, execution planning, `agent execution run`, provider/API execution, or credential handling through MCP without a separate approved phase.
- Do not emit bearer token values, credentials, local secrets, raw environment values, or external upload configuration from MCP client configuration helpers.
- Do not treat local agent advisory output as deterministic findings, release approval, or a replacement for owner judgment.
- Do not run provider APIs, upload evidence, store credentials, or expose agent/API execution through MCP as part of the local agent advisory handoff layer.
- Do not let agent execution mutate review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, resource guard output, artifact cleanup behavior, or existing `agent_workflow` status meanings.
- Do not run agent/API execution without a local dry-run execution plan, explicit `--execute`, local receipt, and advisory-only normalization path.
- Do not accept provider credentials through CLI arguments, committed files, package artifacts, workflow files, reports, receipts, `.env` auto-loading, or persistent local storage.
- Do not upload or send raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, report bodies, cookies, storage state, existing browser profile data, or raw review artifacts as part of default agent execution.
- Do not store raw provider responses; only normalized advisory results and local receipts may be retained.
- Do not expose `agent execution run` through MCP in the planned execution layer.
- Do not register a plugin marketplace entry, change the package license, choose a public package name, or publish to npm without explicit release approval.

## Success Criteria

- The repository has the standard product scaffold expected by the lesson workflow.
- The initial five documents are synchronized and describe the same product direction.
- Product-local checks can validate structure, document sync, security, and design-system placeholders.
- Package/runtime design records the CLI shape, artifact boundaries, safety defaults, and focused verification plan before implementation begins.
- The first no-browser implementation slice provides local package metadata, the `browser-debug` executable, `doctor`, command parsing, deterministic JSON errors, and focused tests without launching a browser.
- The local MVP runtime provides Playwright-backed one-shot observation, local screenshots/traces/observation artifacts, session metadata, simple actions, report export, spec export, redaction tests, and browser smoke tests.

## Phase 2a Package and Runtime Design Criteria

- The working CLI binary is `browser-debug`.
- The package uses Node.js 20 or newer and ESM modules.
- The default runtime mode is local-first, headless, and artifact-safe.
- The first implementation slice is `doctor` plus a no-browser command parser and JSON output contract.
- The first Playwright slice is a one-shot `observe --url <url> --json` command using an ephemeral browser context.
- The default artifact root is `.browser-debug/`, which must stay ignored and must not contain cookies, storage state, credentials, or raw secrets.
- Long-running browser supervision is opt-in after the one-shot observation flow is working.

## Current Local MVP Criteria

- `doctor --json` verifies Node.js, ESM configuration, artifact ignore policy, and Playwright package availability.
- `observe --url <url> --json` launches an ephemeral Chromium context, captures structured page data, closes the browser context, and writes an observation artifact.
- `observe --screenshot` writes a local screenshot artifact without committing it.
- `observe --trace` writes a local Playwright trace artifact and warns that traces can contain page content.
- `session start`, `act`, `report`, and `spec export` operate on local `.browser-debug/` session metadata.
- `supervise --url <url> --actions <json-array>` keeps one ephemeral browser context alive for ordered local actions within a single CLI process and closes it before exit.
- `daemon start --url <url>`, `daemon status --daemon <id>`, and `daemon stop --daemon <id>` keep a local background ephemeral browser worker alive across CLI invocations and stop it through local process signaling.
- Page text, console messages, URLs, action data, and generated reports are treated as untrusted data and pass through basic secret redaction.
- Browser smoke tests verify local file observation, click actions, form controls, keyboard input, deterministic scroll, screenshots, reports, spec export, process-scoped supervision, and local daemon start/status/stop without using external services.
- Headed and DevTools mode regression tests verify Playwright launch-mode wiring without requiring a GUI display.
- Architecture regression tests check for generic runtime boundaries, shared page evidence helpers, and local Node CLI packaging.
- Local package dry-run verification confirms the npm package file set without publishing.
- Local CI manifest checks validate the GitHub Actions workflow definition without remote execution.
- Release readiness notes and `npm run release:check` track the unreleased status, public-release blockers, and no-publish boundaries.
- The review platform adds `review`, `schema list`, `schema get`, and local stdio MCP adapter surfaces while keeping existing commands compatible.
- Review artifacts are written under ignored `.browser-debug/` directories for reviews, layouts, diffs, and coverage.
- No-browser tests cover schema commands, review parsing, target manifest normalization, action risk classification, shell-safe action input, and MCP allowlisted tools.
- Browser smoke tests cover deterministic review findings, mock metrics, target manifest review, route discovery, viewport execution, and coverage artifacts.
- `target init --url <url> --json` writes a reusable local target manifest artifact for route and viewport review.
- `target validate --target <manifest> --json` validates edited target manifests without launching a browser, mutating the manifest, exposing sourceData values, uploading artifacts, or reusing profiles.
- `resource status --json` reports local memory, swap, cgroup, pressure, and process memory signals without launching a browser, writing artifacts, deleting caches, mutating swap, mutating system cache, uploading evidence, or reusing profiles.
- `review --resource-guard advisory|fail-critical|off` adds resource preflight and route/viewport recheck data to review output. Advisory mode is the default and does not change review findings, `metrics.finding_count`, existing action plans, or release readiness. Fail-critical mode can stop browser launch or remaining target work only when local resource status is critical.
- `daemon start --idle-timeout <duration>` and `daemon start --max-lifetime <duration>` add optional local lifecycle bounds to daemon metadata and worker shutdown behavior.
- `resource artifacts plan --json` reports local artifact usage and cleanup candidates without deleting files. `resource artifacts cleanup --execute --json` deletes only selected regular files under the configured artifact root and writes a local receipt.
- `agent surfaces list --json` reports local subscription-agent surfaces and a future API-provider boundary without contacting providers.
- `agent package --review-index <path> --json` creates a local bounded evidence package and prompt from an existing review artifact index without copying raw screenshots, traces, DOM, console payloads, network payloads, or source-data values.
- `agent requests list --json` reads local package/result artifacts and reports pending/imported advisory handoff status without launching a browser, contacting providers, uploading evidence, or writing review artifacts.
- `agent requests show --package <path> --json` returns one advisory handoff detail with package metadata, local artifact references, selected result summary, dashboard handoff hints, and unchanged gate boundary flags without writing artifacts.
- `agent workflow create --package <path> --json` writes a local workflow manifest and receipt under `.browser-debug/` for dashboard and automation handoff without launching a browser, contacting providers, uploading evidence, storing credentials, or mutating review artifacts.
- `agent workflow status --workflow <path> --json` and `agent workflow index --json` read local workflow/package/result metadata and report current handoff status without writing artifacts, launching a browser, contacting providers, uploading evidence, storing credentials, or changing deterministic review output.
- `agent workflow report --workflow <path> --json` writes a local Markdown workflow status summary without launching a browser, contacting providers, uploading evidence, storing credentials, mutating review artifacts, or changing deterministic review output.
- `agent execution plan --package <path> --surface <id> --json` creates a local no-network dry-run execution plan and receipt from a bounded agent package without launching a browser, contacting providers, uploading evidence, storing credentials, mutating review artifacts, changing deterministic gates, or exposing execution through MCP.
- `agent execution status --execution <path> --json` and `agent execution list --json` read local execution metadata for dashboards and automation without launching browsers, contacting providers, uploading evidence, storing credentials, writing review artifacts, or changing existing workflow status semantics.
- `agent ingest --package <path> --input <json> --json` imports untrusted agent advisory JSON from inline input, stdin, or a workspace-relative `@file` into separate advisory fields and writes local receipts without changing deterministic review findings, metrics, existing action plans, or release readiness.
- `agent report --review-index <path> --agent-result <path> --json` renders a separate Markdown advisory report without mutating existing review JSON.
- Review outputs include `action_plan`, `review_advisory`, and `quality_signals` objects for developer handoff while keeping subjective or model-like judgment out of deterministic gates.
- Review outputs include local `evidence_summary` data and `artifact_index` metadata so agents can evaluate expected UI state and hand developers a bounded artifact bundle.
- Target review can emit `local_content_ux_advisory`, `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, `content_ux_page_handoff`, `content_ux_manifest_authoring`, and `quality_signals.content_ux` only when the target manifest explicitly enables `localContentUxAdvisory.enabled=true`.
- The repository includes local plugin metadata, local MCP configuration, and a plugin-facing skill without adding marketplace registration, npm publication, external upload, credential handling, or an HTTP default in the packaged MCP config.
- `browser-debug-mcp --transport http --profile safe --host 127.0.0.1 --port <port>` starts only a local safe HTTP MCP endpoint. It requires a bearer token, validates loopback Host and Origin headers, and does not expose browser-launching, write-producing, cleanup, provider/API, shell, `full`, or `admin` tools.
- `browser-debug mcp config --json` returns reusable client configuration for stdio MCP without launching a server, mutating files, or requiring repository-specific source inspection.
- `browser-debug mcp config --transport http --profile safe --port <port> --json` returns launch and client-connection metadata for the explicit safe HTTP MCP endpoint without printing token values.

## Phase 35 HTTP MCP Integration Hardening Criteria

- Add a no-side-effect MCP client configuration command that can be used from any repository after install or from this checkout.
- Keep generated stdio configuration compatible with normal MCP client `mcpServers` shapes while preserving the existing packaged `.mcp.json` compatibility behavior.
- Keep generated HTTP configuration safe-profile-only, loopback-only, bearer-token-env-based, and explicit about the single-request POST JSON response subset.
- Default generated HTTP examples to a fixed local port suitable for client configuration, while keeping the server runtime default port unchanged.
- Add packed-install smoke coverage that creates the safe HTTP MCP handler from the installed package API and completes an authenticated `initialize` request without binding a port.
- Keep all configuration output token-free, credential-free, local-first, reusable, and generic across external repositories.

## Phase 29 Agent Execution Criteria

- Completed: `agent execution plan --package <path> --surface <id> --provider <id> --model <id> --json` creates a local no-network dry-run plan and receipt for subscription or API execution.
- Completed: `agent execution run --execution <path> --package <path> --surface <id> --provider <id> --model <id> --execute --json` requires a prior dry-run execution plan, rejects execution without explicit `--execute`, validates package/surface/provider/model plan consistency, and records local run receipts.
- Completed: `agent execution status --execution <path> --json` and `agent execution list --json` report local execution state, normalized advisory-result paths, dashboard status fields, and aggregate boundary flags without launching browsers, mutating review artifacts, or changing deterministic gates.
- Completed: subscription-style execution supports configured local runner callbacks through provider/model identifiers and rejects free-form shell input or SaaS web UI automation.
- Completed: deterministic fake-provider execution covers no-browser provider success paths and advisory-result normalization.
- Completed: API-style execution reads endpoint and credential values only from named environment variables, supports injected fetch transports for tests, records that an API call occurred, and never records credential values.
- Completed: execution plans and receipts record `api_call_performed`, `external_evidence_transfer`, `automatic_upload`, `credential_values_recorded`, `credential_storage`, `persistent_credential_storage`, `raw_response_stored`, `raw_provider_response_stored`, `existing_review_mutated`, `mcp_execution_exposed`, and `gate_effect`.
- Completed: execution output normalizes provider or runner responses into the existing untrusted advisory-result shape so dashboards get the same final experience for subscription and API modes.
- Execution output should not change review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, resource guard behavior, artifact cleanup behavior, or existing workflow status semantics.
- MCP should not expose `agent execution run` in this phase. If read-only execution plan/status tools are ever exposed through MCP, they require a separate allowlist decision and tests.

## Review Platform Criteria

- Completed: the review platform uses the existing Playwright runtime as the browser automation layer and adds a reusable review core above observation, action, artifact, and reporting primitives.
- Completed: `browser-debug review --url <url> --json` provides a single-URL review MVP with deterministic findings for browser health, horizontal overflow, clipped content, missing accessible names, empty renders, and local evidence completeness.
- Completed: `browser-debug review --target <manifest> --json` extends review to a generic target manifest with `baseUrl`, seed routes, scope rules, viewport matrix, action policy, artifact settings, and execution budgets.
- Completed: site review discovers routes from same-origin links and action candidates, then reports discovered, visited, skipped, failed, and expected-missing routes.
- Completed: site review visits manifest `expectedRoutes` as explicit review targets and records route-budget skips when `budgets.maxRoutes` prevents full coverage.
- Completed: site review checks optional manifest `pages` for expected visible text and selectors, records page expectation coverage, and emits findings when expected UI state is missing.
- Completed: page entries can add page-specific viewport coverage and page-specific mock metrics while reusing the existing target review and mock comparison paths.
- Completed: review runs a viewport matrix and records route, viewport, and action coverage without depending on a specific application stack.
- Completed: findings include `category`, `severity`, `confidence`, `selector`, `rect`, `evidence`, `artifacts`, and `repro` data.
- Completed: findings include developer-facing enrichment fields such as `priority`, `impact`, `recommendation`, `fix_candidates`, and `implementation_notes`.
- Completed: review results include `action_plan` and `review_advisory` to prioritize remediation and summarize local heuristic visual review signals.
- Completed: review results include `quality_signals` for heading hierarchy, rendered state, landmarks, image alt text, contrast, overlap, mobile target sizing, route coverage, evidence completeness, release readiness, developer handoff, and the disabled model-review boundary.
- Completed: target review results include `quality_signals.page_expectations` for expected page counts, checked pages, failed pages, skipped pages, and missing text or selector expectations.
- Completed: review results include local artifact indexes that summarize evidence classes and rerun guidance without uploading artifacts.
- Completed: local rendered-state review findings flag broken visible images, explicit or semantically marked lingering loading indicators, and empty data containers without visible empty-state messaging.
- Completed: loading indicator detection ignores normal ready/progress business-state text unless explicit loading semantics or loading-like attributes are present.
- Completed: target review output includes manifest suggestions for adding named page expectations, pinning expected routes, raising or splitting route budgets, and covering rendered-state gaps.
- Completed: target review supports opt-in `localContentUxAdvisory` with inline `sourceData` and page `expectations.dataBindings` for advisory source-to-screen checks.
- Completed: content UX advisory supports selector-scoped `text`, `attribute`, `data-state`, and `data-risk` bindings plus required user-question checks for information architecture and user-journey handoff.
- Completed: content UX advisory is additive, local-only, creates only separate `content_ux_findings`, does not create review findings, does not change `metrics.finding_count`, does not change `action_plan`, and does not change `quality_signals.release_readiness`.
- Completed: target review emits separate `content_ux_action_plan` and `content_ux_readiness` outputs so content-owner handoff can advance without changing existing release readiness or action-plan semantics.
- Completed: content UX advisory categorizes advisory findings for status clarity, action clarity, navigation clarity, information architecture, source alignment, content contracts, coverage contracts, and review scope while still accepting legacy manifest category aliases.
- Completed: target review emits separate `content_ux_page_handoff` and `content_ux_manifest_authoring` outputs for page-level triage and manifest authoring guidance.
- Completed: target review emits separate `content_ux_review_brief` and `content_ux_rubric_evaluation` outputs for manifest-declared audience, page roles, decision needs, and rubric criteria.
- Completed: mock comparison is optional and conservative; dimension mismatches, missing baselines, or unsupported images produce `inconclusive` review metrics rather than false pass/fail certainty.
- Completed: MCP support is implemented as thin adapters over the same core, not as a separate product runtime or default dependency. Stdio remains the compatibility default, and HTTP is explicit, loopback-only, token-gated, and safe-profile-only.
- Completed: model or vision review remains outside deterministic local review checks and has not been implemented.

## Plugin and Dogfood Readiness Criteria

- Completed: `target init` creates a manifest artifact that can be edited for applications with multiple routes.
- Completed: `target validate` checks edited manifests and reports normalized counts, local authoring suggestions, review next commands, and local-first boundaries before browser review.
- Completed: edited manifests can add unlinked `expectedRoutes`, and target review will visit them within scope and budget.
- Completed: edited manifests can add optional `pages` entries for expected page state and per-page mock metrics.
- Completed: edited manifests can opt into content UX advisory by declaring bounded inline `sourceData`, `localContentUxAdvisory`, and page `expectations.dataBindings`.
- Completed: edited manifests can add `localContentUxAdvisory.reviewBrief`, `localContentUxAdvisory.rubric`, and page `role` fields for advisory review-brief and rubric evaluation.
- Completed: reusable target manifest templates include a generic status-dashboard content UX advisory example without adding runtime product-specific branches.
- Completed: target review can emit a Markdown report with action plan and local advisory sections.
- Completed: Markdown reports include quality signal summaries so developers can triage local review output without reading raw JSON first.
- Completed: MCP tool allowlists include target manifest initialization, target manifest validation, and target review without adding shell, cleanup execution, socket transport, remote HTTP listener, external upload, or profile-reuse tools.
- Completed: MCP tool allowlists include local resource status preflight without adding shell, cleanup execution, socket transport, remote HTTP listener, external upload, profile-reuse, or privileged host mutation tools.
- Completed: MCP tool allowlists include local artifact usage planning without exposing artifact cleanup execution.
- Completed: local agent advisory handoff commands create bounded task packages, list and inspect request state, import advisory results, and render separate reports without direct API calls, automatic upload, credential storage, MCP agent execution, or deterministic gate changes.
- Completed: `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/browser-debug-review/SKILL.md` define a local plugin bundle over the existing CLI/MCP surface.
- Completed: `templates/review-target-manifest.json` provides a reusable manifest starting point for local route and viewport review.

## Closed Local Decisions

- JSON envelopes, artifact descriptors, and local metadata use schema version `0.1.0` for the local MVP. Additive fields may be added while existing fields keep their meaning and type. Renaming, removing, or changing the type of existing fields requires a schema version bump with updated docs and tests.
- Generated artifacts are retained manually under the ignored `.browser-debug/` artifact root. The CLI does not auto-delete artifacts. Explicit cleanup is available only under the configured artifact root with `resource artifacts cleanup --execute` and a local receipt.

## Open Decisions

- Final public npm package name and npm scope.
- Release license and contribution policy.

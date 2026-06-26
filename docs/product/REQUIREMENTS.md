# REQUIREMENTS.md

## Purpose

TraceCue is the canonical product identity. The legacy Browser Debug CLI name and `browser-debug` commands remain compatibility aliases during the migration.

TraceCue should make visual evidence, browser debugging, and UI review reusable across repositories and AI agents. It should provide a local Playwright-based command surface that can observe a page, expose safe action candidates, run selected actions, and produce evidence for UI/UX and functional debugging.

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
- Provide machine-readable MCP capability policy output so humans, agents, and external repositories can see which profiles, transports, admin-only agent execution tools, and remaining write/execute exclusions are currently in force without starting a server or inspecting source files.
- Provide a shared read-only operation registry and risk taxonomy so humans, dashboards, agents, MCP capability reports, and MCP execution gate reports can inspect risky operation families before any write, delete, provider, capture, translation, release, alias, artifact-root, or shell authority is implemented.
- Provide a read-only operation roadmap governance report so humans, dashboards, agents, and safe MCP clients can inspect draft phase A/B/C boundary contracts, phase order, group/risk classification, and approval-bound status without treating draft roadmap entries as product-plan commitments or live execution permission.
- Provide a read-only operation contracts report so humans, dashboards, agents, and safe MCP clients can inspect the shared Phase 61-64 risk taxonomy, gate schema, execute-token shape, and receipt shape before any token issuance, receipt writing, execution harness, or operation-specific live behavior exists.
- Provide a read-only operation policy report so humans, dashboards, agents, and safe MCP clients can inspect Phase 65-68 admin policy defaults, CLI plan readiness, disabled generic harness state, MCP readiness, and approved admin-only agent execution exposure without mutating policy or running live side effects from the report.
- Provide a read-only operation admin readiness report so humans, dashboards, agents, and safe MCP clients can inspect Phase 69-70 MCP admin execute-token flow readiness, generic harness bridge readiness, and approved admin-only agent execution bridge state without issuing tokens, storing tokens, or dispatching the generic harness.
- Provide a read-only operation provider readiness report so humans, dashboards, agents, and safe MCP clients can inspect Phase 71-78 provider MCP planning, bounded disclosure contracts, env credential guard names, admin-only fake/local/API execution exposure, and safe MCP status/list readiness without calling providers, executing local runners, reading credential values, or transferring evidence from the readiness report.
- Provide stdio `admin` MCP tools for the existing `agent execution plan` and `agent execution run --execute` flow, limited to deterministic fake providers, configured local runner callbacks, and env-only generic API providers with idempotency keys, workspace confinement, bounded disclosure, local receipts, safe/full exclusion, and HTTP exclusion.
- Keep future cleanup execution, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, constrained shell execution, and release hardening represented as explicit registry/gate entries until each operation family has its own approved implementation slice.
- Provide a packaged external-repository usage guide so humans, shell-based agents, MCP-capable agents, and Codex users can choose CLI, MCP stdio, safe HTTP MCP, or plugin connection modes without source inspection.
- Provide TraceCue-local language settings that separate dashboard display locale from artifact output language, using the supported locale contract `ja|en|ko|zh-CN|zh-TW|es|pt-BR|fr|de|id|vi|th|hi|ar` without depending on the parent lesson repository.
- Provide read-only CLI/API/MCP inspection for those language settings so dashboards, humans, and agents can discover the active UI locale, output language mode, source-language behavior, and translation-execution boundary without writing files or running providers.
- Provide a read-only identity audit and rename-readiness check so humans and agents can distinguish canonical repository URL, legacy repository URL, checkout name, legacy aliases, and artifact-root migration boundaries before and after repository rename work.
- Document target runtime readiness for consumer repositories so frontend-only dev-server reviews, missing API/backend services, API base configuration gaps, and intentional degraded modes can be distinguished without adding app-specific runtime code.
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
- Provide a shared visual evidence metadata contract for browser screenshots, standalone screenshots, generated mock images, screen captures, window captures, and desktop app captures without embedding raw pixels in JSON records.
- Provide a planning-only visual review provider policy inside `agent execution plan` so future AI-assisted visual review can disclose raw-pixel, provider, external-transfer, credential, and MCP boundaries before any execution path is expanded.
- Provide standalone image review for workspace-confined image files so existing screenshots, generated mock images, and manually captured UI images can enter the same local evidence workflow without browser launch or provider execution.
- Provide local visual review result preparation so existing review artifact indexes can become metadata-only future AI visual review contracts without provider execution, raw pixel transfer, external upload, MCP exposure, or deterministic review mutation.
- Provide explicit CLI visual review execution from preparation artifacts so AI or local-provider advisory output can be normalized as visual review results without raw pixel transfer, existing review mutation, release gate changes, raw provider response storage, or MCP exposure.
- Provide a read-only visual review dashboard so local control centers, humans, CLI users, and safe MCP clients can inspect visual review preparation, execution, and result status without writing artifacts, running providers, reading raw pixels, or changing gates.
- Provide a read-only MCP execution gate report so future MCP planning, provider execution, cleanup execution, and visual review execution can be reviewed against explicit safety gates before any write/execute tool is exposed.
- Provide a read-only capture planning report so screen, window, and desktop app capture can be reviewed against local privacy, artifact, raw-pixel, and MCP execution boundaries before any OS capture implementation is added.
- Provide a capture metadata handoff for existing workspace image files so they can be identified as screen, window, or desktop app evidence without OS capture, raw-pixel JSON embedding, provider calls, artifact writes, or MCP exposure.
- Provide a desktop review provider-preparation planning report from capture handoff metadata so future provider preparation can be reviewed without rereading image bytes, writing artifacts, calling providers, transferring evidence, exposing MCP tools, or mutating existing reviews.

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
- Do not expose HTTP `full` or `admin`, remote HTTP listeners, socket transports, shell tools, cleanup execution, package generation, ingest, report writing, workflow creation, execution planning outside the approved stdio `admin` agent execution plan path, `agent execution run` outside the approved stdio `admin` path, provider/API execution outside the approved stdio `admin` agent execution adapter path, or credential handling through MCP without a separate approved phase.
- Do not emit bearer token values, credentials, local secrets, raw environment values, or external upload configuration from MCP client configuration helpers.
- Do not treat an MCP capability policy report or the `admin` profile name as permission to expose write, delete, provider/API, shell, daemon/session, or credential-bearing tools.
- Do not hide consumer application API/backend startup failures through TraceCue runtime branches; document target runtime prerequisites in the consumer repository instead.
- Do not treat local agent advisory output as deterministic findings, release approval, or a replacement for owner judgment.
- Do not run provider APIs, upload evidence, store credentials, or expose agent/API execution through MCP as part of the local agent advisory handoff layer, except for the approved stdio `admin` agent execution plan/run adapter path that requires a prior local plan, explicit execute acknowledgement, bounded disclosure, and local receipts.
- Do not let agent execution mutate review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, resource guard output, artifact cleanup behavior, or existing `agent_workflow` status meanings.
- Do not run agent/API execution without a local dry-run execution plan, explicit `--execute`, local receipt, and advisory-only normalization path.
- Do not accept provider credentials through CLI arguments, committed files, package artifacts, workflow files, reports, receipts, `.env` auto-loading, or persistent local storage.
- Do not upload or send raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, report bodies, cookies, storage state, existing browser profile data, or raw review artifacts as part of default agent execution.
- Do not store raw provider responses; only normalized advisory results and local receipts may be retained.
- Do not expose `agent execution run` through MCP outside the approved stdio `admin` agent execution adapter path.
- Do not treat visual evidence metadata, visual review result preparation artifacts, visual review execution artifacts, or artifact references as permission to transfer raw pixels, upload raw evidence, expose MCP execution, or store raw provider responses.
- Do not treat visual review dashboard output as permission to run providers, write artifacts, mutate review state, transfer raw pixels, or change release gates.
- Do not treat MCP execution gate reports as permission to expose MCP write, delete, provider, credential, shell, daemon/session, or raw-pixel transfer tools.
- Do not treat operation registry entries as permission to execute, delete, publish, migrate artifact roots, remove aliases, call providers, translate evidence, capture pixels, or expose MCP write/execute tools.
- Do not treat operation roadmap entries as permission to promote draft phases into product-plan commitments, issue execution tokens, run live execution, trigger remote CI, execute, delete, publish, migrate artifact roots, remove aliases, call providers, translate evidence, capture pixels, or expose MCP write/execute tools.
- Do not treat operation contract entries as permission to issue execute tokens, enforce live gates, write receipts, run execution harnesses, execute, delete, publish, migrate artifact roots, remove aliases, call providers, translate evidence, capture pixels, or expose MCP write/execute tools.
- Do not treat operation policy entries as permission to enable admin execution tools, issue tokens, write receipts, enable harnesses, execute, delete, publish, migrate artifact roots, remove aliases, call providers, translate evidence, capture pixels, or expose MCP write/execute tools.
- Do not treat operation admin readiness entries as permission to issue execute tokens, store tokens, expand MCP admin execution beyond the approved agent execution bridge, dispatch generic harnesses, execute from the readiness report, delete, publish, migrate artifact roots, remove aliases, call providers from the readiness report, translate evidence, capture pixels, or expose unrelated MCP write/execute tools.
- Do not treat operation provider readiness entries, safe MCP status/list metadata, or capability-id aliases as permission to call providers, execute local runners, read credential values, transfer evidence, delete, publish, migrate artifact roots, remove aliases, translate evidence, capture pixels, or expose MCP write/execute tools beyond the approved stdio admin agent execution plan/run tools.
- Do not treat capture planning reports as permission to capture screens, enumerate windows or processes, write image artifacts, read raw pixels, call providers, transfer evidence, or expose capture execution through MCP.
- Do not treat capture metadata handoff as permission to capture screens, enumerate windows or processes, write artifacts, call providers, transfer evidence, expose MCP tools, or bypass workspace-confined image input checks.
- Do not treat language settings as permission to translate source evidence, repository documentation, raw page text, selectors, URLs, logs, screenshots, traces, or provider output through external services. Translation execution remains disabled until a separate approved implementation defines local templates, provider boundaries, disclosure, and tests.
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
- `browser-debug mcp config --json` returns reusable client configuration for stdio MCP without launching a server, mutating files, or requiring repository-specific source inspection. It includes installed-bin metadata and local-checkout metadata for unpublished package use.
- `browser-debug mcp config --transport http --profile safe --port <port> --json` returns launch and client-connection metadata for the explicit safe HTTP MCP endpoint without printing token values. It includes a local-checkout launch block for the current package entrypoint when `browser-debug-mcp` is not on PATH.
- `browser-debug mcp capabilities --profile safe|full|admin|all --scope all|profiles|excluded --json` returns the current MCP profile, transport, and admin exclusion policy without launching a server, mutating files, reading credentials, or enabling write/execute tools.
- `trace-cue operation registry --json` returns the shared operation registry, 1-8 roadmap group mapping, risk taxonomy, required gates, current MCP exposure flags, and read-only boundary metadata without writing artifacts, deleting files, executing providers, capturing pixels, translating content, publishing packages, migrating artifact roots, removing legacy aliases, running shell commands, or changing MCP permissions.
- `trace-cue settings language --json` returns the current dashboard display locale and artifact output language settings from the TraceCue-local dashboard settings file or defaults, normalizes aliases such as `zh`, exposes direction and `Intl` locale metadata, and reports that translation execution is disabled.
- `trace-cue settings language policy --json` returns the supported locale contract, independent language-setting roles, output modes, reserved translation modes, and read-only local boundary flags without launching a browser, writing artifacts, reading credentials, calling providers, or contacting the parent lesson repository.
- Review JSON, target review JSON, visual review dashboard JSON, and Markdown review reports include bounded language-setting metadata so dashboards and consumers can see which UI and artifact-language policy was applied without changing existing findings, metrics, action plans, quality signals, or gates.
- `docs/workflow/CONSUMER_USAGE.md` is packaged with the local tarball and documents external-repository CLI, MCP stdio, safe HTTP MCP, Codex plugin connection flows, and target runtime readiness checks without requiring source-code inspection.

## Phase 37 External Repository Usage Criteria

- Add a packaged guide for using Browser Debug CLI from a consumer repository before npm publication.
- Document that the current working directory should be the consumer repository when review artifacts and target manifests belong there.
- Document CLI, MCP stdio, safe HTTP MCP, and Codex plugin as connection modes over the same core rather than unrelated products.
- Document the practical capability differences between CLI, MCP `safe`, MCP `full`, MCP `admin`, safe HTTP MCP, and the Codex plugin.
- Document that consumer reviews depend on the target app's full local runtime, and that missing API/backend services can correctly surface as browser-health findings or `needs_attention`.
- Keep the guide generic, local-first, token-free, credential-free, and free of consumer-specific paths or product names.
- Keep package smoke coverage proving the guide is included in the local tarball without publishing.

## Phase 39 Consumer Runtime Readiness Criteria

- Clarify that Browser Debug CLI can be connected correctly while the reviewed app is still missing its own backend/API runtime.
- Document that frontend-only dev servers may produce valid `needs_attention` or browser-health findings when required local API endpoints are absent.
- Keep app-specific startup commands, API base environment variables, degraded-mode expectations, and acceptance notes in the consumer repository.
- Keep Browser Debug CLI runtime generic; do not add product-specific branches for missing consumer backend state.
- Add no-browser architecture coverage proving the packaged consumer guide keeps runtime-readiness guidance generic and free of consumer-specific paths or product names.

## Phase 35 HTTP MCP Integration Hardening Criteria

- Add a no-side-effect MCP client configuration command that can be used from any repository after install or from this checkout.
- Keep generated stdio configuration compatible with normal MCP client `mcpServers` shapes while preserving the existing packaged `.mcp.json` compatibility behavior.
- Include a generated local-checkout `mcpServers` shape for stdio use when the package bin is not installed or not on PATH.
- Keep generated HTTP configuration safe-profile-only, loopback-only, bearer-token-env-based, and explicit about the single-request POST JSON response subset.
- Include a generated local-checkout launch shape for safe HTTP use when the package bin is not installed or not on PATH.
- Default generated HTTP examples to a fixed local port suitable for client configuration, while keeping the server runtime default port unchanged.
- Add packed-install smoke coverage that creates the safe HTTP MCP handler from the installed package API and completes an authenticated `initialize` request without binding a port.
- Keep all configuration output token-free, credential-free, local-first, reusable, and generic across external repositories.

## Phase 36 MCP Capability Policy Criteria

- Add a no-side-effect MCP capability policy command that can be used from any repository after install or from this checkout.
- Report safe/full/admin profile tool surfaces, stdio and safe HTTP transport support, and the current `admin` policy in a machine-readable JSON envelope.
- Report excluded MCP operations such as artifact cleanup execution, package/ingest/report writing, workflow creation/report writing, execution planning outside the approved stdio `admin` agent execution plan path, `agent execution run` outside the approved stdio `admin` path, provider/API execution outside the approved stdio `admin` agent execution adapter path, arbitrary shell, daemon/session control, socket transport, remote HTTP listeners, and HTTP `full` or `admin`.
- Keep the report read-only, token-free, credential-free, local-first, reusable, and generic across external repositories.
- Expose the same report through the safe/full/admin MCP profiles because the report does not launch browsers, write artifacts, delete files, call providers, upload evidence, execute shell commands, or open listeners.
- Keep `admin` distinct from `full`; the capability report may identify approved stdio `admin` agent execution plan/run exposure but must not itself enable cleanup execution, unrelated provider/API execution, shell tools, daemon/session control, credential handling, HTTP `full` or `admin`, socket transport, or remote listeners.

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
- MCP stdio `admin` may expose `agent execution plan/run` only for the approved Phase 74-76 provider execution path. Safe, full, and HTTP MCP profiles must not expose execution; additional MCP execution families require a separate allowlist decision and tests.

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
- Completed: MCP tool allowlists include read-only MCP capability policy inspection without exposing unrelated write/execute/admin operations.
- Completed: local agent advisory handoff commands create bounded task packages, list and inspect request state, import advisory results, and render separate reports without direct API calls, automatic upload, credential storage, MCP agent execution, or deterministic gate changes.
- Completed: `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/browser-debug-review/SKILL.md` define a local plugin bundle over the existing CLI/MCP surface.
- Completed: `templates/review-target-manifest.json` provides a reusable manifest starting point for local route and viewport review.

## Closed Local Decisions

- JSON envelopes, artifact descriptors, and local metadata use schema version `0.1.0` for the local MVP. Additive fields may be added while existing fields keep their meaning and type. Renaming, removing, or changing the type of existing fields requires a schema version bump with updated docs and tests.
- Generated artifacts are retained manually under the ignored `.browser-debug/` artifact root. The CLI does not auto-delete artifacts. Explicit cleanup is available only under the configured artifact root with `resource artifacts cleanup --execute` and a local receipt.

## Open Decisions

- Final public npm package name and npm scope.
- Release license and contribution policy.

## Phase 41 Visual Evidence Core Criteria

- TraceCue must support local metadata records for visual evidence from browser screenshots, image files, future screen captures, future window captures, and future desktop app captures.
- Visual evidence metadata must remain local-first, artifact-root-confined, schema-versioned, and additive to existing review and agent workflows.
- The current default artifact root remains `.browser-debug/` for compatibility; `.trace-cue/` remains a future migration option only.
- Visual evidence metadata must not include raw image bytes, provider responses, credentials, cookies, storage state, or automatic external transfer.
- Existing CLI aliases, MCP tool names, artifact roots, schema fields, and browser review behavior must continue to work without tradeoffs.

## Phase 43 Standalone Image Review Criteria

- `review --image <workspace-file> --json` reviews workspace-confined image files without launching a browser.
- Standalone image review must reuse visual evidence metadata and write local review/index artifacts under the configured artifact root.
- Standalone image review must not embed raw pixels in JSON, copy source images into packages, call providers, upload evidence, read credentials, expose MCP execution, or change existing URL/target review behavior.

## Phase 51 Desktop Image Review Criteria

- `review --image <workspace-file> --capture-handoff <workspace-json|-> --json` must accept existing screen, window, and desktop app screenshot handoff metadata.
- The image review must verify that the handoff source path and SHA-256 media hash match the reviewed workspace image before propagating desktop provenance.
- The output must keep source provenance caller-declared and must not claim TraceCue captured or verified the actual OS screen, window, or desktop app identity.
- Desktop image review must remain no-browser, no-provider, no-raw-pixel JSON, no external transfer, no MCP execution, and additive to existing standalone image review.

## Phase 53-55 Multi-Agent Visual Review Aggregation Criteria

- `visual review aggregate --preparation <workspace-json> --json` must read existing local visual review result metadata for one preparation and aggregate advisory findings across reviewer outputs.
- Aggregation must keep every advisory finding source-attributed to result, provider, model, and finding identifiers.
- Aggregation must report corroborated findings, conflicts, owner decision requests, source effects, and read-only boundary flags.
- Aggregation must treat provider output as untrusted advisory data, bound text and result counts, skip malformed or unsafe local artifacts with warnings, and avoid release gate changes.
- Aggregation must not run providers, read raw pixels, write artifacts, mutate existing reviews, expose MCP tools, read credentials, or store raw provider responses.

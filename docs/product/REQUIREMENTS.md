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
- Prepare a CLI-first review platform that can later expose the same review core through an MCP stdio adapter without making MCP the required runtime.
- Support evidence-backed UI review findings for browser health, layout integrity, interaction quality, accessibility basics, and mock fidelity.
- Support generic target manifests so site review can cover local applications such as Control Centers without hard-coded product-specific branches.
- Treat manifest `expectedRoutes` as reviewable local targets so known app routes can be covered even when route discovery cannot find them from anchors or navigation candidates.
- Support optional manifest `pages` entries so named pages can define expected visible text, expected selectors, page-specific viewport coverage, and page-specific mock metrics without runtime product branches.
- Keep review findings developer-facing, reproducible, and tied to selectors, rectangles, routes, viewports, artifacts, confidence, severity, and reproduction steps.
- Produce a local review artifact index that groups review JSON, layout JSON, screenshots, mock metrics, coverage, reports, evidence classes, local boundaries, and rerun guidance for developer handoff.
- Detect generic rendered-state risks such as broken visible images, lingering loading indicators after the review wait, and empty data containers without visible empty-state messaging.
- Generate reusable target manifests so whole-application review can start from a URL without hand-writing the full manifest.
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
- Do not hard-code Dashboard Control Center, FrameCue Control Center, localhost ports, route names, or product-specific UI labels into the generic runtime.
- Do not send screenshots, traces, raw DOM, source text, console logs, network evidence, or reports to a model or external service without explicit opt-in and security documentation.
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
- Review outputs include `action_plan`, `review_advisory`, and `quality_signals` objects for developer handoff while keeping subjective or model-like judgment out of deterministic gates.
- Review outputs include local `evidence_summary` data and `artifact_index` metadata so agents can evaluate expected UI state and hand developers a bounded artifact bundle.
- The repository includes local plugin metadata, local MCP configuration, and a plugin-facing skill without adding marketplace registration, npm publication, external upload, credential handling, or HTTP/socket MCP transport.

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
- Completed: local rendered-state review findings flag broken visible images, lingering loading indicators, and empty data containers without visible empty-state messaging.
- Completed: target review output includes manifest suggestions for adding named page expectations, pinning expected routes, raising or splitting route budgets, and covering rendered-state gaps.
- Completed: mock comparison is optional and conservative; dimension mismatches, missing baselines, or unsupported images produce `inconclusive` review metrics rather than false pass/fail certainty.
- Completed: MCP support is implemented as a thin local stdio adapter over the same core, not as a separate product runtime, network service, or default dependency.
- Completed: model or vision review remains outside deterministic local review checks and has not been implemented.

## Plugin and Dogfood Readiness Criteria

- Completed: `target init` creates a manifest artifact that can be edited for applications with multiple routes.
- Completed: edited manifests can add unlinked `expectedRoutes`, and target review will visit them within scope and budget.
- Completed: edited manifests can add optional `pages` entries for expected page state and per-page mock metrics.
- Completed: target review can emit a Markdown report with action plan and local advisory sections.
- Completed: Markdown reports include quality signal summaries so developers can triage local review output without reading raw JSON first.
- Completed: MCP tool allowlists include target manifest initialization and target review without adding shell, cleanup, HTTP/socket, external upload, or profile-reuse tools.
- Completed: `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/browser-debug-review/SKILL.md` define a local plugin bundle over the existing CLI/MCP surface.
- Completed: `templates/review-target-manifest.json` provides a reusable manifest starting point for local route and viewport review.

## Closed Local Decisions

- JSON envelopes, artifact descriptors, and local metadata use schema version `0.1.0` for the local MVP. Additive fields may be added while existing fields keep their meaning and type. Renaming, removing, or changing the type of existing fields requires a schema version bump with updated docs and tests.
- Generated artifacts are retained manually under the ignored `.browser-debug/` artifact root. The CLI does not auto-delete artifacts and does not provide a destructive cleanup command in the local MVP.

## Open Decisions

- Final public npm package name and npm scope.
- Release license and contribution policy.

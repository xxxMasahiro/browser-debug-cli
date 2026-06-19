# HANDOFF.md

## Current State

Browser Debug CLI has completed Phase 1, Phase 2a package/runtime design verification, the Phase 5 local MVP runtime slice, the Phase 7 local review-platform implementation, the Phase 8 local dogfood/plugin-readiness implementation, the Phase 9 local review-quality implementation, the Phase 10 local dogfood route-readiness implementation, the Phase 11 local page-expectation review implementation, the Phase 12 local rendered-state dogfood hardening implementation, the Phase 13 local dogfood signal refinement implementation, the Phase 14 local content UX advisory implementation, the Phase 15 local content UX heuristic strengthening implementation, the Phase 16 local content UX handoff output implementation, the Phase 17 local content UX practical handoff implementation, the Phase 18 local content UX review brief/rubric implementation, the Phase 19 local target manifest validation implementation, the Phase 20 local resource status preflight implementation, the Phase 21-24 local resource safety implementation, the Phase 25 local agent advisory handoff implementation, the Phase 26 local agent request status implementation, the Phase 27 local agent request detail implementation, the Phase 28 local agent workflow status implementation, the Phase 29 agent execution integration, the Phase 30 release-hardening slice, the Phase 31 MCP profile-gating slice, and the Phase 32 rename-readiness slice. Phase 32 now has centralized product identity metadata, package/plugin/MCP alignment tests, MCP identity metadata, package API identity exports, identity-derived package dry-run and packed-install smoke paths, and unchanged local-first boundaries. Phase 0 scaffold and document sync are complete, local Git is initialized, the initial scaffold commit exists, local CI configuration is present, and product-gate evidence has been recorded locally.

This file is paired with `docs/workflow/TASK_TRACKER.md`. Keep the HANDOFF and TASK_TRACKER workflow-state pair synchronized whenever task state changes.

## What Has Been Decided

- Product name: Browser Debug CLI.
- Repository path: `/home/masahiro/projects/agent-toolbox/browser-debug-cli`.
- Main purpose: local Playwright-based browser debugging and UI/UX inspection for humans and AI agents.
- Main design choice: agent-independent CLI, not Playwright MCP.
- Debug strategy: fast headless observation by default, headed browser or DevTools for important visual and interaction checks.
- OSS path: local Git, GitHub through `gh`, CI, npm packaging, MVP implementation, release.
- Product-local gate passed.
- Lesson-side scaffold, authority, and workflow-pair checks passed.
- Root agent entry is `AGENTS.MD`; legacy `AGENT.md` is absent.
- `ops/PRODUCT_PROFILE.json` remains `menu_id=free-development` with display name `Browser Debug CLI`.
- `ops/PRODUCT_OPERATION_MODE.tsv` remains `parent_managed` with `managed_by_parent=true`.
- Local Git has been initialized and the initial branch is `main`.
- The first scaffold commit exists.
- Product-gate evidence is recorded under `.git/product-gate-evidence/`.
- Phase 2a uses `browser-debug` as the working CLI binary name.
- Phase 2a uses Node.js 20 or newer, ESM modules, local-first execution, and ephemeral browser contexts by default.
- The first implementation slice should be `doctor`, command parsing, deterministic JSON errors, and focused tests.
- The first Playwright slice should be one-shot `observe --url <url> --json` with artifacts under ignored `.browser-debug/`.
- Process-scoped browser supervision is opt-in and implemented after one-shot observation.
- Phase 2a design verification passed with `./tools/product-gate`.
- The repository now has private local package metadata, `bin/browser-debug.js`, ESM source modules, and `tests/cli.test.js`.
- `doctor`, command parsing, deterministic JSON errors, and planned no-browser stubs are implemented.
- `observe --url <url> --json` validates input, launches an ephemeral Chromium context, captures structured page state, writes local artifacts, and closes the context.
- `npm test` is wired into `./tools/test_product_repository.sh` and `./tools/product-gate`.
- Local verification passed with `npm test`, `./tools/product-gate`, `git diff --check`, `doctor --json`, and the no-browser `observe` stub.
- Playwright is installed as a runtime dependency.
- `session start`, `session close`, simple `act`, `report`, and `spec export` are implemented with local file-backed session metadata.
- `supervise --url <url> --actions <json-array>` is implemented for process-scoped ephemeral browser supervision and closes before CLI exit.
- `daemon start`, `daemon status`, and `daemon stop` are implemented for local background ephemeral browser supervision through a detached worker process, local metadata, and local process signals.
- `npm run test:browser` passed for local file observation and click action smoke coverage.
- `npm run test:browser` now covers local file observation, screenshot/trace artifacts, click actions, form controls, keyboard input, deterministic scroll, wait actions, reports, and spec export.
- `npm test` now covers headed/devtools launch-mode wiring through a deterministic injected browser type.
- `npm run test:pack` verifies the local npm package file set with `npm pack --dry-run --json` and a `/tmp` npm cache.
- `CHANGELOG.md` and `docs/workflow/RELEASE.md` now track unreleased local changes and publication blockers.
- `npm run test:browser` covers supervised ordered actions in one ephemeral context.
- `npm test` includes architecture regressions for generic runtime boundaries, shared evidence helpers, and local Node CLI packaging.
- `npm run test:browser` covers daemon start/status/stop, and `npm test` covers local daemon boundary regressions.
- Local GitHub Actions CI configuration is present under `.github/workflows/ci.yml`.
- `ops/CI_MANIFEST.tsv` and `tools/check_product_ci.sh` validate CI configuration without remote execution.
- `npm run release:check` provides local release-readiness verification without publishing.
- The public GitHub repository exists at `https://github.com/xxxMasahiro/browser-debug-cli`.
- Local `main` tracks `origin/main` and has been fast-forwarded to the local MVP runtime commit.
- GitHub Actions `main` CI has passed on push for Node 20, Node 22, and browser smoke jobs.
- CI uses `actions/checkout@v5` and `actions/setup-node@v5` to avoid Node 20 action-runtime deprecation annotations from the first remote run.
- JSON schema versioning is defined for the local MVP as `0.1.0`: additive fields are compatible, while field removal, renaming, type changes, or vocabulary semantic changes require a schema version bump with docs and tests.
- Artifact retention is manual by default: generated artifacts remain under ignored `.browser-debug/` until the developer removes that local artifact root or explicitly runs artifact-root-scoped cleanup with a receipt. The CLI does not auto-delete artifacts.
- `observe --trace` is implemented and writes local Playwright trace zip artifacts with a page-content warning.
- Dashboard Control Center `http://127.0.0.1:5173/` was observed successfully with screenshot and trace artifacts.
- FrameCue Control Center `http://127.0.0.1:5174/` was not listening during verification.
- Final local verification passed with `npm test`, `npm run test:browser`, `./tools/product-gate`, `git diff --check`, lesson-side product scaffold check, lesson-side product repository authority status, and lesson-side workflow-pair sync check.
- The pre-implementation review-platform direction was recorded in developer memory after xhigh sub-agent review.
- The accepted framing is a Playwright-powered review and evidence core with CLI as the source of truth and a future thin local MCP stdio adapter over the same core.
- The Phase 7 plan covers review schema contracts, single-URL review MVP, target manifests, site review, route discovery, viewport matrices, risk-gated action exploration, optional mock comparison, local MCP adapter, optional model or vision review, and public API/package readiness.
- Phase 7 local implementation is complete for machine-readable schemas, `schema list`, `schema get`, `review --url`, `review --target`, route discovery, viewport execution, coverage artifacts, action risk classification, shell-safe structured input, conservative mock metrics, local stdio MCP adapter, package API exports, and package file-set readiness.
- `browser-debug review --url <url>` writes local observation, layout, screenshot, review, report, and optional mock metric artifacts.
- `browser-debug review --target <manifest>` uses generic target manifests and writes local coverage and aggregate review artifacts.
- `browser-debug-mcp` is a local stdio adapter with an allowlisted tool surface; it does not add HTTP/socket listeners, arbitrary shell, cleanup execution tools, external upload, profile reuse, OAuth, or credential handling.
- The package remains private and `UNLICENSED`; no npm publication or release promotion was performed.
- Review runtime code must remain generic. Dashboard Control Center and FrameCue Control Center coverage should use manifests, fixtures, or acceptance evidence rather than target-specific runtime branches.
- Review findings should include category, severity, confidence, selector, rectangle, evidence, artifacts, and reproduction data.
- `browser-debug target init --url <url>` creates reusable local target manifests under `.browser-debug/targets/`.
- Review findings now include priority, impact, recommendations, fix candidates, and implementation notes.
- Review output now includes `action_plan` and local heuristic `review_advisory` data for developer handoff.
- Target review supports Markdown reports through `--report`.
- The local MCP adapter exposes target manifest initialization and target review tools in addition to doctor, observe, single-URL review, and schema tools.
- Local plugin metadata exists under `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/browser-debug-review/SKILL.md`.
- `templates/review-target-manifest.json` is the reusable starting point for app route and viewport review.
- Review output now includes `quality_signals` for visual hierarchy, responsive layout, interaction affordance, accessibility structure, evidence completeness, developer handoff, local release readiness, route coverage, and disabled model-review boundaries.
- Local review evidence now captures headings, landmarks, images, visible overlap candidates, and richer computed style data.
- Review findings now cover heading hierarchy, missing main landmarks, missing image alt text, low text contrast, visible overlap, and mobile touch-target sizing without adding new finding categories or target-specific runtime branches.
- Markdown review reports include a Quality Signals section for developer triage.
- Browser smoke coverage verifies quality signals, alt text, contrast, overlap, target coverage summaries, local release readiness, and `external_evidence_transfer=false`.
- Target review now enqueues manifest `expectedRoutes` as explicit review targets, so known unlinked app routes can be reviewed through the viewport matrix.
- Coverage artifacts now include `coverage.routes.expected`, and target quality signals report expected manifest route counts.
- Target review records route-budget skips with `reason=route_budget_exceeded` when `budgets.maxRoutes` prevents full coverage.
- Browser smoke coverage verifies unlinked expected route review and route-budget skip accounting with generic local fixtures.
- Target manifests now support optional `pages` entries for named page expectations, page-specific viewports, page-specific mock metrics, and priority.
- Target review checks page expected visible text and expected selectors, records page coverage under `coverage.pages`, and reports `quality_signals.page_expectations`.
- Single-URL and target reviews now include `evidence_summary` data and write local `review_artifact_index` artifacts under `.browser-debug/review-artifacts/`.
- Browser smoke coverage verifies page expectation checks, page-specific viewport execution, page-level mock metrics, artifact indexes, and page expectation report output.
- Layout evidence now records image load state, visible loading indicators, and empty table/list/grid containers.
- Review findings now flag broken visible images, lingering loading indicators after the review wait, and empty data containers without visible empty-state messaging.
- Single-URL and target quality signals now include rendered-state summaries.
- Markdown reports now include a Developer Triage section and rendered-state quality signal status.
- Target review output now includes manifest suggestions for missing page expectations, unpinned expected routes, exhausted route budgets, failed page checks, and rendered-state gaps.
- Browser smoke coverage verifies rendered-state findings, evidence summaries, developer triage reports, and manifest suggestions.
- Loading indicator evidence now ignores normal ready/progress business-state text unless explicit loading semantics or loading-like attributes are present.
- Browser smoke coverage verifies ready/progress business-state text is not reported as lingering loading UI.
- Target manifests now support opt-in `localContentUxAdvisory`, bounded inline `sourceData`, and page `expectations.dataBindings` for local source-to-screen advisory checks.
- `src/content-ux-advisory.js` is a pure local helper with no Playwright, filesystem access, artifact reads, external transfer, or target-specific runtime branches.
- Target review emits `local_content_ux_advisory` and `quality_signals.content_ux` only when manifest opt-in is enabled.
- Content UX advisory is additive and does not create review findings, change `metrics.finding_count`, change the existing `action_plan`, or change `quality_signals.release_readiness`.
- Markdown reports include a bounded Content UX Advisory section when enabled and do not copy source values or full page text.
- Schema registry and packaged schema files are covered by parity tests for the review and target manifest property sets.
- Target review evidence summaries now include bounded element evidence for selector-scoped advisory checks.
- Content UX advisory now evaluates selector-scoped text, explicit attributes, state attributes, and risk attributes from target manifest data bindings.
- Content UX advisory now evaluates `localContentUxAdvisory.requiredUserQuestions` and page `expectations.userQuestions` as advisory information-architecture and user-journey signals.
- `templates/status-dashboard-content-ux-target-manifest.json` provides a reusable disabled-by-default status-dashboard manifest example without runtime product-specific branches.
- Target review now emits additive `content_ux_findings`, `content_ux_action_plan`, and `content_ux_readiness` only when content UX advisory is enabled.
- `content_ux_findings` are separate from review `findings`; they do not change `metrics.finding_count`, the existing `action_plan`, or `quality_signals.release_readiness`.
- Markdown reports now include a bounded Content UX Developer Handoff section without copying source values or full page text.
- Content UX findings now include local advisory categories for status clarity, action clarity, navigation clarity, information architecture, source alignment, content contracts, coverage contracts, and review scope.
- Target review now emits additive `content_ux_page_handoff` and `content_ux_manifest_authoring` only when content UX advisory is enabled.
- Markdown reports now include page-level content UX summaries and manifest-authoring suggestion counts in the Content UX Developer Handoff section.
- Target review now emits additive `content_ux_review_brief` and `content_ux_rubric_evaluation` only when content UX advisory is enabled.
- Markdown reports now include bounded Content UX Review Brief summaries for page roles, decision needs, and rubric criteria.
- Packaged content UX templates and tests now use domain-neutral status-dashboard vocabulary while preserving selector-scoped state/risk coverage.
- `status_clarity` and `action_clarity` are the preferred default content UX categories; existing manifest rubric categories `workflow_state_clarity` and `next_action_clarity` remain accepted as legacy-compatible aliases.
- Lesson-specific Dashboard Control Center workflow, Git, CI, blocker, repository-selection, and next-safe-action semantics should live in lesson-owned target manifests or fixtures, not Browser Debug CLI runtime code.
- `browser-debug target validate --target <manifest> --json` validates edited manifests without launching a browser and returns normalized counts, authoring suggestions, review next commands, and local-first boundaries.
- The local MCP adapter exposes `browser_debug_target_validate`, and the local package API exports `runTargetValidate`.
- Target validation does not mutate manifests, expose sourceData values, upload evidence, reuse profiles, add external source loaders, add HTTP/socket MCP transport, or change review findings, metrics, existing action plans, or release readiness.
- `browser-debug resource status --json` reports local memory, swap, cgroup, pressure, and process memory signals without launching a browser or writing artifacts.
- The local MCP adapter exposes `browser_debug_resource_status`, and the local package API exports resource status collection and parsing helpers.
- Resource status preflight is read-only and does not mutate system cache, configure swap, delete files, execute shell commands, use privileged helpers, upload evidence, reuse profiles, or control arbitrary processes.
- `browser-debug review --resource-guard advisory|fail-critical|off` adds additive resource guard output, preflight, target route/viewport rechecks, screenshot/trace pressure warnings, and optional fail-critical no-launch behavior.
- `browser-debug daemon start --idle-timeout <duration>` and `browser-debug daemon start --max-lifetime <duration>` add optional local lifecycle guards to detached daemon workers.
- `browser-debug resource artifacts plan --json` and `browser-debug resource artifacts cleanup --dry-run --json` report local artifact usage and cleanup candidates without deleting files.
- `browser-debug resource artifacts cleanup --execute --json` deletes only selected regular files under the configured artifact root and writes a local receipt.
- The local MCP adapter exposes artifact usage planning only and does not expose cleanup execution.
- `browser-debug agent surfaces list --json`, `agent package`, `agent requests list`, `agent requests show`, `agent ingest`, and `agent report` are implemented for local subscription-agent handoff, read-only handoff status/detail tracking, and advisory result import.
- `browser-debug agent workflow create --package <path> --json`, `agent workflow status --workflow <path> --json`, `agent workflow index --json`, and `agent workflow report --workflow <path> --json` are implemented for local dashboard and automation tracking of package, prompt, agent-response, ingest, report-pending states, and bounded workflow summaries.
- Agent advisory output is separate from deterministic review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.
- Agent package/request-status/request-detail/workflow/ingest/report uses local package, prompt, workflow, result, report, and receipt artifacts under `.browser-debug/` without provider API calls, automatic upload, credential storage, MCP agent execution, browser launch, external evidence transfer, artifact writes from detail reads, or review artifact mutation.
- Phase 29 adds an `agent execution` layer instead of changing `agent workflow`. The current dashboard flow is package, dry-run execution plan, explicit execution run, execution status/list, normalized advisory result/report, and workflow status/index/report.
- Phase 29 subscription support uses configured local runner callbacks only, not SaaS web UI automation or free-form shell input.
- Phase 29 API support uses an env-only generic API adapter with dry-run planning, explicit `--execute`, bounded package/prompt disclosure, local receipts, no raw provider response storage, and advisory-only normalization.
- Phase 29 must not change review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, resource guard behavior, artifact cleanup behavior, target manifest behavior, or existing `agent_workflow` status meanings.
- Phase 29 must keep `agent execution run` out of MCP. Read-only execution plan/status MCP exposure, if ever added, needs a separate allowlist decision and tests.
- Phase 30 adds `npm run test:pack-install`, which verifies the packed tarball from a temporary install layout without publishing, contacting npm registry, changing package naming, changing license, mutating marketplace state, uploading evidence, or storing credentials.
- Phase 31 adds launch-selected MCP profiles. No-profile `browser-debug-mcp` remains compatible with `full`; `safe` exposes no-browser/no-delete/no-provider tools; `admin` is explicit but does not expose cleanup execution, agent/API execution, daemon/session control, shell tools, HTTP/socket transport, external upload, provider credentials, profile reuse, or arbitrary process control.
- Phase 31 confines MCP `@file` structured input to the workspace, rejecting absolute paths, parent traversal, symlink escapes, non-regular files, and oversized files without changing normal CLI `@file` behavior.
- Phase 32 centralizes package, CLI, MCP, plugin, repository, version, skill path, and temporary package-check identity metadata in `src/product-identity.js`.
- Phase 32 keeps the current package name, CLI commands, MCP server name, plugin name, display name, repository URL, private package state, and license unchanged while making future approved renames contract-driven.
- Phase 32 routes package dry-run and packed-install smoke temporary paths through identity-derived helpers and verifies package/plugin/MCP/API alignment through no-browser and packed-install tests.
- No arbitrary source-data file or URL loader was added; external references remain ignored advisory signals until a separately approved loader design exists.
- Model/API review outside the Phase 29 agent execution adapter boundary, evidence leaving the local process beyond the bounded package/prompt disclosure policy, HTTP/socket MCP server mode, persistent browser profile reuse, authentication automation, external upload, arbitrary shell execution, automatic cleanup, cleanup outside the configured artifact root, host memory-cache mutation, swap configuration, MCP cleanup execution, privileged helper execution, arbitrary process control, npm publication, package naming, and license changes remain approval-bound.

## Next Step

Phase 32 rename-readiness work is complete. Next work should move to a newly planned phase only after product checks pass. Ask for explicit approval before authentication automation, external daemon control channels, external upload outside the Phase 29 bounded disclosure policy, arbitrary source-data file or URL loaders, HTTP/socket MCP server mode, existing-browser-profile reuse, persistent credential storage, provider credential storage, package rename, repository rename, plugin rename, MCP server rename, CLI command rename, marketplace registration, license change, public package naming, npm publication, automatic cleanup, cleanup outside the configured artifact root, host memory-cache mutation, swap configuration, MCP cleanup execution, MCP agent/API execution, privileged helper execution, or arbitrary process control.

## Restart Notes

- Do not publish to npm yet.
- Keep `.browser-debug/`, screenshots, traces, storage state, cookies, credentials, and secret-like data out of committed files.
- Do not reuse existing browser profiles, persist storage state, automate OAuth/login flows, or upload artifacts without a security plan and approval.
- If product workflow commands need lesson context, use the product path explicitly to avoid mixing this repository with `task-tracker-repository`.
- Keep Phase 7 review code generic and manifest-driven.
- Keep MCP as a local stdio adapter until a separate approved design changes the transport.
- Keep model or vision review out of deterministic local gates.
- Keep target-specific Control Center details in manifests, fixtures, or acceptance evidence.
- Keep content UX source data bounded and inline unless a separate approved loader design is added.
- Keep plugin marketplace registration out of local implementation unless explicitly approved.
- Treat `resource status` and `resource_guard` as local safety signals; do not turn them into host cleanup, swap configuration, cache deletion, privileged helper execution, external upload, or arbitrary process control without a separate approved task.
- Treat artifact cleanup as artifact-root-only and explicit; do not add automatic cleanup, cleanup outside `.browser-debug/`, or MCP cleanup execution without a separate approved task.
- Keep MCP profiles launch-scoped and fail-closed. Prefer `--profile safe` for low-trust MCP clients and do not treat `admin` as permission for cleanup execution, agent/API execution, shell tools, HTTP/socket transports, external upload, profile reuse, provider credentials, or arbitrary process control.
- Treat agent advisory package/request-status/request-detail/workflow/import/report as local handoff operations; only `agent execution run` may call a provider adapter after a matching dry-run execution plan and explicit `--execute`.
- Treat agent execution as a separate layer over local packages. Do not overload existing workflow status semantics or mutate review artifacts.
- For Phase 29, preserve dry-run execution planning before any runner/provider execution.
- For Phase 29 API execution, read credential values only from named environment variables and never record them.
- For Phase 29 subscription execution, use configured local runner callbacks only; do not accept free-form shell commands or automate SaaS web UIs.
- Keep raw screenshots, traces, DOM, console payloads, network payloads, sourceData values, report bodies, raw provider responses, cookies, storage state, and existing browser profile data out of execution artifacts unless a separate explicit design changes the disclosure policy.
- Treat packed install smoke as local release evidence only; it does not authorize npm publication, package rename, license change, npm token handling, plugin marketplace registration, or external evidence transfer.
- Treat product identity metadata as rename readiness only; it does not authorize package rename, repository rename, plugin rename, MCP server rename, CLI command rename, public package naming, license change, marketplace registration, npm publication, or external evidence transfer.

## Stop Conditions

- Missing canonical docs under `docs/product/` or `docs/workflow/`.
- Root-level duplicate product documents.
- Any committed secret-like data.
- External service, OAuth, webhook, browser profile reuse, or artifact upload requested without a security plan and approval.
- Any design path that requires arbitrary shell execution or persistent credential storage.
- Review platform code adds app-specific runtime branches for individual Control Centers.
- Content UX advisory starts reading arbitrary manifest paths or remote source URLs without explicit approval and security documentation.
- MCP adapter code adds HTTP/socket listeners, external upload, arbitrary shell execution, cleanup execution tools, or persistent storage without explicit approval.
- Plugin metadata adds external upload, profile reuse, credential storage, marketplace mutation, or network transport without explicit approval.
- Resource safety code mutates system cache, changes swap configuration, deletes outside the configured artifact root, executes shell commands, uses privileged helpers, uploads evidence, reuses profiles, exposes MCP cleanup execution, or controls arbitrary processes without explicit approval.
- Agent advisory code calls provider APIs, uploads evidence, stores credentials, exposes MCP agent execution, mutates review artifacts, or changes deterministic review gates without explicit approval.
- Agent execution code changes existing deterministic review outputs, existing `agent_workflow` status meanings, resource guard behavior, artifact cleanup behavior, or release-readiness semantics.
- Agent execution code stores credential values, raw provider responses, raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, report bodies, cookies, storage state, existing browser profile data, or raw review artifacts.
- Agent execution code bypasses dry-run planning, explicit `--execute`, env-only credential loading, local receipts, bounded disclosure, or advisory-only normalization.
- Agent execution code exposes execution through MCP, accepts free-form shell commands, automates SaaS web UIs, adds OAuth/login automation, persists credentials, or adds HTTP/socket provider control paths.
- Product identity work starts changing package names, repository names, plugin names, MCP server names, CLI command names, public package naming, license, marketplace registration, npm publication, or external evidence transfer without explicit approval.

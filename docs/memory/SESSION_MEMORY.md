# SESSION_MEMORY.md

## Verbatim English Handoff Text

```text
Continue from /home/masahiro/projects/agent-toolbox/browser-debug-cli.
Read AGENTS.MD and docs/workflow/HANDOFF.md, confirm the current state, then resume.
```

## Session State

- Future development in this repository should be conducted in English.
- Phase 1 is complete.
- Local Git is initialized on `main`.
- Initial scaffold commit: `87e39f5 Initial browser debug CLI scaffold`.
- Product-gate evidence is recorded under `.git/product-gate-evidence/`.
- Phase 2a package/runtime design has started; the next approval-bound step is runtime/package implementation or, separately, public GitHub repository creation.

## 2026-06-17 Phase 2a Package/Runtime Design

- Began package/runtime design under `skills/product-development-workflow/SKILL.md`.
- At that point, no runtime implementation, dependency installation, GitHub repository creation, CI, npm work, push, or browser launch had been performed.
- Working CLI binary is `browser-debug`.
- Runtime baseline is Node.js 20 or newer with ESM modules.
- First implementation slice is `doctor`, command parsing, deterministic JSON errors, and focused tests.
- First Playwright slice is one-shot `observe --url <url> --json` with an ephemeral context and ignored `.browser-debug/` artifacts.
- Phase 2a design verification passed with `./tools/product-gate`.
- Implemented the first no-browser runtime/package slice: private local package metadata, `browser-debug` bin, ESM CLI modules, `doctor`, parser, deterministic JSON errors, planned-command stubs, and `tests/cli.test.js`. This was superseded by the later Playwright-backed local MVP.
- At that point, `observe --url <url> --json` validated the URL and returned an explicit unimplemented error without launching a browser. This was superseded by the later Playwright-backed local MVP.
- `npm test` is wired into `./tools/product-gate` through `./tools/test_product_repository.sh`.
- Verification passed with `npm test`, `./tools/product-gate`, `git diff --check`, `doctor --json`, and the no-browser `observe` stub.
- That approval boundary was later crossed for local Playwright implementation, then for public GitHub repository creation, remote setup, push, and remote `main` CI after developer approval.

## 2026-06-17 Local MVP Runtime

- Installed `playwright` as a runtime dependency.
- Implemented Playwright-backed `observe --url <url> --json` with ephemeral Chromium contexts, structured page observation, local observation artifacts, optional screenshots, console summaries, failed-request summaries, and basic redaction.
- Implemented `observe --trace` with local Playwright trace zip artifacts and trace-content warnings.
- Implemented local `.browser-debug/` artifact handling for sessions, observations, screenshots, reports, and specs.
- Implemented `session start`, `session close`, simple `act`, `report`, and `spec export` using file-backed local session metadata.
- Implemented `supervise --url <url> --actions <json-array>` for process-scoped ephemeral browser supervision.
- Implemented `daemon start`, `daemon status`, and `daemon stop` for local background ephemeral browser supervision.
- Added `npm run test:browser` for real Playwright smoke coverage.
- Strengthened browser smoke coverage for form controls, keyboard input, deterministic scroll, wait actions, screenshots, reports, and spec export.
- Added deterministic headed/devtools launch-mode regression coverage without requiring a GUI display.
- Added `npm run test:pack` local package dry-run verification using an ignored local npm cache.
- Added `CHANGELOG.md` and `docs/workflow/RELEASE.md` for local release readiness without publishing.
- Added browser smoke coverage for supervised ordered actions in one ephemeral context.
- Added architecture regression coverage for generic runtime boundaries, shared evidence helpers, and local Node CLI packaging.
- Added architecture and browser smoke coverage for local daemon boundaries and start/status/stop.
- Added local GitHub Actions CI configuration, `ops/CI_MANIFEST.tsv`, `tools/check_product_ci.sh`, and `npm run release:check` without remote execution or publishing.
- Verification passed with `npm test`, `npm run test:browser`, `node ./bin/browser-debug.js doctor --json`, Dashboard Control Center observation at `http://127.0.0.1:5173/`, screenshot review, and trace artifact existence checks.
- `http://127.0.0.1:5174/` was not listening during verification.
- Final checks also passed with `./tools/product-gate`, `git diff --check`, lesson-side product scaffold check, lesson-side product repository authority status, and lesson-side workflow-pair sync check.
- Completed after developer approval: public GitHub repository creation at `https://github.com/xxxMasahiro/browser-debug-cli`, remote `origin` setup, local `main` fast-forward, `origin/main` push, and GitHub Actions `main` CI verification.
- Updated GitHub Actions checkout and Node setup actions to v5 after the first remote run reported Node 20 action-runtime deprecation annotations.
- Next approval-bound work: public package naming, license changes, npm publication, existing-browser-profile reuse, OAuth/login automation, external daemon control channels, external upload, or credential storage.

## 2026-06-17 Phase 11 Review Handoff

- Phase 7 through Phase 10 review-platform work was completed before this state: deterministic review, target manifests, route and viewport coverage, risk-gated actions, conservative mock metrics, local stdio MCP adapter, plugin metadata, quality signals, expected route execution, and route-budget skip coverage.
- Phase 11 is complete for optional manifest `pages`, page-specific viewports, deterministic expected text and selector checks, page-level mock metrics, local `review_artifact_index` artifacts, `coverage.pages`, and `quality_signals.page_expectations`.
- The implementation remains generic and local-first. No Control Center-specific runtime branches, external upload, model/API review, OAuth/login automation, existing-profile reuse, HTTP/socket MCP transport, npm publication, license change, or marketplace mutation was added.
- Current local verification includes `npm test`, `npm run test:browser`, product-local checks, release readiness checks, and parent workflow authority checks.

## 2026-06-18 Phase 12 Rendered-State Dogfood Handoff

- Phase 12 is complete for generic rendered-state dogfood hardening.
- Layout evidence records image load state, visible loading indicators, and empty table/list/grid containers.
- Review findings flag broken visible images, lingering loading indicators after the review wait, and empty data containers without visible empty-state messaging.
- Single-URL and target quality signals include rendered-state summaries.
- Markdown reports include a Developer Triage section and rendered-state quality signal status.
- Target review output includes manifest suggestions for missing page expectations, unpinned expected routes, exhausted route budgets, failed page checks, and rendered-state gaps.
- Browser smoke coverage verifies rendered-state findings, evidence summaries, developer triage reports, and manifest suggestions.
- The implementation remains generic and local-first. No Control Center-specific runtime branches, external upload, model/API review, OAuth/login automation, existing-profile reuse, HTTP/socket MCP transport, npm publication, license change, or marketplace mutation was added.

## 2026-06-18 Phase 14 Content UX Advisory Handoff

- Phase 14 is complete for manifest opt-in local content UX advisory.
- Target manifests support bounded inline `sourceData`, `localContentUxAdvisory`, and page `expectations.dataBindings`.
- Target review emits `local_content_ux_advisory` and `quality_signals.content_ux` only when `localContentUxAdvisory.enabled=true`.
- The advisory checks source-to-screen text bindings without creating findings, changing `metrics.finding_count`, changing `action_plan`, or changing `quality_signals.release_readiness`.
- The advisory module is pure local code without Playwright, filesystem reads, artifact reads, external transfer, or target-specific runtime branches.
- Schema registry/file parity, source-value non-disclosure, report output, and browser-smoke invariance are covered by tests.
- The implementation remains generic and local-first. No arbitrary source-data file or URL loader, Control Center-specific runtime branch, external upload, model/API review, OAuth/login automation, existing-profile reuse, HTTP/socket MCP transport, npm publication, license change, or marketplace mutation was added.

## 2026-06-18 Phase 15 Content UX Heuristic Strengthening Handoff

- Phase 15 is complete for selector-scoped local content UX advisory.
- Target review evidence summaries include bounded element evidence with selectors, text, accessible names, allowed attributes, and rectangles.
- `pages[].expectations.dataBindings` now evaluates selector-scoped `text`, explicit `attribute`, `data-state`, and `data-risk` targets.
- `localContentUxAdvisory.requiredUserQuestions` and page `expectations.userQuestions` now provide advisory information-architecture and user-journey checks.
- `templates/status-dashboard-content-ux-target-manifest.json` provides a reusable disabled-by-default status-dashboard manifest example.
- The implementation remains generic, local-first, and advisory-only. It does not create review findings, change `metrics.finding_count`, change the existing `action_plan`, change `quality_signals.release_readiness`, read arbitrary source-data files or URLs, add Control Center-specific runtime branches, upload evidence, call models/APIs, automate OAuth/login, reuse existing profiles, add HTTP/socket MCP transport, publish packages, change license, or mutate marketplace state.

## 2026-06-18 Phase 16 Content UX Handoff Output Handoff

- Phase 16 is complete for dedicated content UX handoff outputs.
- Target review emits additive `content_ux_findings`, `content_ux_action_plan`, and `content_ux_readiness` only when `localContentUxAdvisory.enabled=true`.
- `content_ux_findings` stay separate from review `findings` and do not change `metrics.finding_count`.
- `content_ux_action_plan` stays separate from the existing `action_plan` and records `legacy_action_plan_unchanged=true`.
- `content_ux_readiness` stays separate from `quality_signals.release_readiness` and records `legacy_release_readiness_unchanged=true`, `blocking_release_gate=false`, and `external_evidence_transfer=false`.
- Markdown reports include a bounded Content UX Developer Handoff section without copying source values or full page text.
- The implementation remains generic, local-first, and advisory-only. It does not read arbitrary source-data files or URLs, add Control Center-specific runtime branches, upload evidence, call models/APIs, automate OAuth/login, reuse existing profiles, add HTTP/socket MCP transport, publish packages, change license, or mutate marketplace state.

## 2026-06-18 Phase 17 Content UX Practical Handoff

- Phase 17 is complete for practical local content UX handoff output.
- `content_ux_findings` now categorize local advisory signals into status clarity, action clarity, navigation clarity, information architecture, source alignment, content contracts, coverage contracts, and review scope.
- Target review emits additive `content_ux_page_handoff` with page status, owner-review need, finding count, top categories, and bounded top findings.
- Target review emits additive `content_ux_manifest_authoring` with manifest-only suggestions for audience, goal, source data, data bindings, user questions, next-action contracts, and navigation contracts.
- Target init and reusable templates expose the expanded content UX check vocabulary while keeping advisory opt-in disabled by default.
- Markdown reports include page-level content UX summaries and manifest-authoring suggestion counts.
- The implementation remains generic, local-first, advisory-only, and non-mutating. It does not read arbitrary source-data files or URLs, add Control Center-specific runtime branches, upload evidence, call models/APIs, automate OAuth/login, reuse existing profiles, add HTTP/socket MCP transport, publish packages, change license, or mutate marketplace state.

## 2026-06-18 Phase 18 Content UX Review Brief and Rubric Handoff

- Phase 18 is complete for local content UX review brief and rubric evaluation.
- Target manifests can declare page `role`, `localContentUxAdvisory.reviewBrief`, and `localContentUxAdvisory.rubric`.
- Target review emits additive `content_ux_review_brief` with audience, page-role, and decision-need summaries.
- Target review emits additive `content_ux_rubric_evaluation` with rubric criteria status, category counts, owner-review counts, and inconclusive counts.
- Markdown reports include a bounded Content UX Review Brief section.
- Packaged content UX templates and tests use domain-neutral status-dashboard vocabulary while keeping selector-scoped state/risk advisory coverage.
- The preferred default content UX categories are `status_clarity` and `action_clarity`; existing manifest rubric categories `workflow_state_clarity` and `next_action_clarity` remain accepted as legacy-compatible aliases.
- Lesson-specific Dashboard Control Center workflow, Git, CI, blocker, repository-selection, and next-safe-action semantics belong in lesson-owned target manifests or fixtures, not Browser Debug CLI runtime code.
- The implementation remains generic, local-first, advisory-only, and non-mutating. It does not change review findings, `metrics.finding_count`, the existing `action_plan`, or `quality_signals.release_readiness`; it does not read arbitrary source-data files or URLs, add Control Center-specific runtime branches, upload evidence, call models/APIs, automate OAuth/login, reuse existing profiles, add HTTP/socket MCP transport, publish packages, change license, or mutate marketplace state.

## 2026-06-18 Phase 19 Target Manifest Validation Handoff

- Phase 19 is complete for no-browser target manifest validation.
- `browser-debug target validate --target <manifest> --json` and `browser-debug target validate --input - --json` validate edited target manifests through the existing normalization contract.
- Validation output includes manifest counts, content UX authoring suggestions, review next commands, and explicit local-first boundaries.
- The local MCP adapter exposes `browser_debug_target_validate`, and the package API exports `runTargetValidate`.
- The implementation remains generic, local-first, no-browser, and non-mutating. It does not launch Chromium, mutate manifests, expose sourceData values, read arbitrary source-data files or URLs, upload evidence, reuse profiles, add HTTP/socket MCP transport, change review findings, change `metrics.finding_count`, change the existing `action_plan`, or change `quality_signals.release_readiness`.

## 2026-06-18 Phase 20 Resource Status Preflight Handoff

- Phase 20 is complete for no-browser local resource status preflight.
- `browser-debug resource status --json` reports process-visible memory, swap, cgroup, pressure, and Node.js process memory signals.
- Resource status output includes status classification, thresholds, warnings, recommendations, cache policy, and explicit local-first boundaries.
- The local MCP adapter exposes `browser_debug_resource_status`, and the package API exports resource status collection and parsing helpers.
- The implementation remains generic, local-first, no-browser, read-only, and non-mutating. It does not launch Chromium, write artifacts, mutate system cache, configure swap, delete files, execute shell commands, use privileged helpers, upload evidence, reuse profiles, add HTTP/socket MCP transport, control arbitrary processes, change review findings, change `metrics.finding_count`, change the existing `action_plan`, or change `quality_signals.release_readiness`.

## 2026-06-18 Phase 21-24 Resource Safety Handoff

- Phase 21-24 is complete for local resource safety integration.
- `browser-debug review --resource-guard advisory|fail-critical|off` emits additive `resource_guard` output, runs review preflight and target route/viewport rechecks, warns for screenshot/trace pressure, and can stop browser launch only in explicit `fail-critical` mode.
- Resource guard output does not change review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.
- `browser-debug daemon start --idle-timeout <duration>` and `browser-debug daemon start --max-lifetime <duration>` add optional local lifecycle guards with daemon metadata and worker shutdown.
- `browser-debug resource artifacts plan --json` and `browser-debug resource artifacts cleanup --dry-run --json` report artifact usage and cleanup candidates without deletion.
- `browser-debug resource artifacts cleanup --execute --json` deletes selected regular files only under the configured artifact root and writes a receipt under `.browser-debug/receipts/`.
- The local MCP adapter exposes `browser_debug_resource_artifacts_plan` only; cleanup execution is not exposed through MCP.
- The implementation remains generic, local-first, and bounded. It does not mutate system cache, configure swap, execute shell commands, use privileged helpers, upload evidence, reuse profiles, add HTTP/socket MCP transport, expose MCP cleanup execution, clean outside the configured artifact root, or control arbitrary processes.

## 2026-06-19 Phase 27 Agent Request Detail Handoff

- Phase 27 is complete for local agent request detail output.
- `browser-debug agent requests show --package <path> --json` returns one advisory handoff package detail with package metadata, disclosure policy, source review index metadata, local artifact-reference summaries, selected/latest result paths, bounded advisory result summary, dashboard handoff hints, and boundary flags.
- `browser-debug agent requests show --package <path> --agent-result <path> --json` selects a matching workspace-relative imported result and rejects mismatched result/package pairs.
- The implementation remains read-only, local-first, and advisory-only. It does not write artifacts, launch browsers, call provider APIs, upload evidence, store credentials, expose MCP agent execution, mutate review artifacts, or change deterministic review findings, metrics, existing action plans, or release readiness.

## 2026-06-19 Phase 28 Agent Workflow Status Handoff

- Phase 28 is complete for local agent workflow status output.
- `browser-debug agent workflow create --package <path> --json` writes a local `.browser-debug/agent-workflows/<id>/workflow.json` manifest and workflow receipt for dashboard/local automation handoff.
- `browser-debug agent workflow status --workflow <path> --json` recomputes current workflow state from local package/result metadata and reports waiting, imported, or package-missing state without writing artifacts.
- `browser-debug agent workflow index --json` aggregates local workflow manifests and reports waiting/imported/package-missing/report-pending counts.
- `browser-debug agent workflow report --workflow <path> --json` writes a bounded local Markdown workflow status summary without mutating review artifacts.
- At the end of Phase 28, provider/API execution was still unimplemented and approval-bound; workflow output only recorded provider-boundary metadata and did not call providers, upload evidence, store credentials, expose MCP agent execution, launch browsers, mutate review artifacts, or change deterministic gates. Phase 29 later added the bounded execution adapter described below.

## 2026-06-19 Verbatim Resume Note

````text
はい、問題なく再開できます。

次回はこの情報だけで十分です。

```text
browser-debug-cli
branch: feature/agent-execution-doc-sync
commit: 1af1fcd Document agent execution integration plan
状態: clean
内容: Phase 29 Agent Execution Integration の文書同期のみ完了。runtime 実装は未着手。
次: Phase 29a から実装開始、または push/PR/main CI に進む。
```

親リポジトリは変更していません。次回は「前回の `1af1fcd` から Phase 29a を進めてください」または「push/PR/main CI まで進めてください」でスムーズに続けられます。
````

## 2026-06-19 Phase 29 Agent Execution Foundation Slice

- Implemented the first Phase 29 runtime foundation slice for `agent_execution` before provider adapters were added.
- Added `src/agent-execution.js`, `agent execution plan/status/list`, and the first `agent execution run` parser/API surface with explicit `--execute` enforcement.
- Added `agent_execution` schema registry/file parity and package API exports.
- Fixed product-local gate evidence source validation so documented `product.design_system.*` evidence rows can be recorded under their canonical source id.
- Dry-run execution plans write local metadata and receipts under `.browser-debug/agent-executions/` and `.browser-debug/receipts/`.
- Preserved existing `agent_workflow` status semantics, deterministic review findings, metrics, existing action plans, release readiness, resource guard behavior, artifact cleanup behavior, and MCP allowlist boundaries.
- Verification so far: `node --check src/agent-execution.js`, `node --check src/cli.js`, `node --check src/parser.js`, `npm test`, `./tools/check_product_structure.sh`, `./tools/check_product_docs.sh`, `./tools/check_product_security.sh`, `./tools/check_product_design_system.sh`, `./tools/product-gate`, and `npm run release:check`.
- The follow-up provider-runner isolation slice is complete in the adapter completion entry below.

## 2026-06-19 Phase 29 Agent Execution Adapter Completion

- Completed the remaining Phase 29 implementation plan for agent execution provider adapters.
- Added `src/agent-execution-providers.js` as the dedicated adapter boundary for deterministic fake provider execution, configured local runner callbacks, and env-only generic API execution.
- Updated `agent execution plan` to record provider adapter metadata, dashboard status fields, normalized result paths, and run commands that include `--execution`.
- Updated `agent execution run` to require a matching dry-run execution plan plus explicit `--execute`, reject package/surface/provider/model mismatches, write local run receipts, update execution status, and write normalized advisory results under `.browser-debug/agent-results/`.
- Preserved existing review findings, metrics, action plans, release readiness, resource guard behavior, artifact cleanup behavior, existing `agent_workflow` status meanings, and MCP execution non-exposure.
- The implementation does not accept free-form shell commands, automate SaaS web UIs, persist credential values, store raw provider responses, mutate review artifacts, launch browsers from agent execution, or add provider calls outside the adapter module.
- No-browser coverage now includes fake provider success, configured local runner success, API missing-configuration blocking, injected API transport success, advisory normalization, dashboard status/list aggregation, and provider boundary architecture checks.

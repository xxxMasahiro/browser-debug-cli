# VERIFICATION.md

## Verification Scope

Current verification checks repository structure, document synchronization, security defaults, review/MCP/plugin local boundaries, CI configuration, design-system placeholders, product operation mode, local MVP runtime behavior, review platform behavior, dogfood target workflow behavior, no-browser target manifest validation, expected-route execution, route-budget coverage accounting, page expectation coverage, rendered-state findings, manifest suggestions, opt-in content UX advisory behavior, selector-scoped advisory contracts, required user-question advisory checks, dedicated content UX handoff output, page-level content UX handoff, manifest-authoring suggestions, review brief/rubric evaluation, local artifact indexes, local review-quality signals, and browser smoke coverage.

## Product-Local Commands

```bash
npm test
npm run test:browser
npm run test:pack
npm run release:check
./tools/check_product_structure.sh
./tools/check_product_docs.sh
./tools/check_product_security.sh
./tools/check_product_ci.sh
./tools/check_product_design_system.sh
./tools/test_product_repository.sh
./tools/product-gate
```

`./tools/test_product_repository.sh` and `./tools/product-gate` run structure, docs, security, CI manifest, design-system, product mode, `npm test`, and `npm run test:pack` when `package.json` is present. `npm run test:browser` is intentionally separate because it launches local Chromium. `npm run release:check` is a no-publish convenience wrapper for no-browser and package dry-run checks.

## Lesson-Side Commands

From `/home/masahiro/projects/ai-driven-development-lesson`:

```bash
./tools/product-scaffold-check check --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli --context free-development --product-type all --git-optional --ci-optional
./tools/product-repository-authority status --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli --context free-development --product-type all --git-optional --ci-optional
./tools/check_workflow_pair_sync.sh --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli
```

## Current Runtime Checks

The current implementation includes command parser tests, deterministic JSON error tests, `doctor` tests for environment, schema-versioning, and artifact-retention metadata, review parser tests, schema command tests, schema registry/file parity tests, target init tests, target validate tests, target manifest tests, opt-in content UX advisory tests, selector-scoped binding tests, required user-question tests, dedicated content UX handoff tests, page handoff tests, manifest-authoring suggestion tests, review brief/rubric tests, action risk classification tests, MCP adapter allowlist tests, shell-safe action input tests, headed/devtools launch-mode tests, session/report/spec tests, daemon parser tests, redaction tests, architecture regressions for generic runtime boundaries, shared evidence helpers, local daemon boundaries, content UX advisory purity, review/MCP/plugin security boundaries, local package dry-run verification, and Playwright smoke tests for local file observation, screenshot/trace artifacts, click actions, form controls, keyboard input, deterministic scroll, wait actions, reports, spec export, process-scoped supervision, daemon start/status/stop, deterministic review findings, action plans, local review advisory output, quality signals, rendered-state findings, mock metrics, target manifest review, target reports, manifest suggestions, content UX advisory opt-in invariance, selector-scoped content UX advisory, content UX Developer Handoff reports, content UX page handoff output, manifest-authoring output, content UX review brief/rubric output, route discovery, explicit expected-route execution, route-budget skip coverage, viewport execution, and coverage artifacts. Manual local checks can use:

Phase 11 adds no-browser coverage for optional manifest page normalization and browser smoke coverage for page expectation checks, page-specific mock metrics, review artifact indexes, `coverage.pages`, and `quality_signals.page_expectations`.

Phase 12 adds browser smoke coverage for broken visible images, lingering loading indicators, empty table/list/grid containers, `quality_signals.rendered_state`, Developer Triage report output, and target review `manifest_suggestions`.

Phase 14 adds no-browser coverage for schema parity, manifest content UX advisory normalization, and source-value non-disclosure. It also adds browser smoke coverage proving `localContentUxAdvisory.enabled=true` emits advisory output without changing findings, metrics, action plans, or release readiness.

Phase 15 adds no-browser and browser smoke coverage for selector-scoped `text`, `attribute`, `data-state`, `data-risk`, and required user-question advisory checks while preserving advisory-only gate behavior.

Phase 16 adds no-browser and browser smoke coverage for additive `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, Markdown Content UX Developer Handoff output, source-value non-disclosure, disabled-output absence, and unchanged review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.

Phase 17 adds no-browser and browser smoke coverage for expanded content UX categories, additive `content_ux_page_handoff`, additive `content_ux_manifest_authoring`, Markdown page/authoring summaries, source-value non-disclosure, disabled-output absence, and unchanged review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.

Phase 18 adds no-browser and browser smoke coverage for additive `content_ux_review_brief`, additive `content_ux_rubric_evaluation`, Markdown brief/rubric summaries, source-value non-disclosure, disabled-output absence, and unchanged review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.

Phase 19 adds no-browser coverage for `target validate` parser/runtime behavior, invalid manifest errors, manifest count output, source-value non-disclosure, MCP validation wiring, and local-first boundaries without launching a browser.

```bash
node ./bin/browser-debug.js observe --url http://127.0.0.1:3000/ --screenshot --trace --timeout 15000 --json
node ./bin/browser-debug.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --timeout 15000 --json
node ./bin/browser-debug.js daemon start --url http://127.0.0.1:3000/ --timeout 15000 --json
node ./bin/browser-debug.js daemon status --daemon <id> --json
node ./bin/browser-debug.js daemon stop --daemon <id> --json
node ./bin/browser-debug.js target init --url http://127.0.0.1:3000/ --json
node ./bin/browser-debug.js target validate --target .browser-debug/targets/<id>.json --json
node ./bin/browser-debug.js review --url http://127.0.0.1:3000/ --viewport mobile --screenshot --report --timeout 15000 --json
node ./bin/browser-debug.js review --target .browser-debug/targets/<id>.json --report --timeout 15000 --json
node ./bin/browser-debug.js schema list --json
node ./bin/browser-debug.js schema get --name review --json
node ./bin/browser-debug.js mcp serve --json
```

Optional acceptance checks against local application control surfaces should run only when their local URLs are provided and listening.

## Planned Review Platform Checks

Phase 7 review-platform implementation includes focused checks before any release claim:

- Parser tests for `review --url`, `review --target`, `schema list`, `schema get`, and MCP adapter entrypoints.
- Schema tests for envelopes, artifacts, findings, target manifests, review results, and MCP tool metadata.
- No-browser unit tests for target manifest validation, viewport matrix expansion, action risk classification, redaction, shell-safe action input, and MCP tool output shape.
- Architecture tests that prevent application-specific runtime literals, persistent browser profile reuse, storage-state persistence, HTTP/socket listeners, arbitrary shell execution, unapproved upload paths, and destructive cleanup commands.
- Browser smoke fixture tests for console errors, empty renders, horizontal overflow, clipped text, missing accessible names, nonblank screenshots, route coverage, viewport coverage, and local artifact placement.
- Mock comparison tests for local metrics and dimension mismatch `inconclusive` behavior.
- MCP adapter tests for stdio/local-only behavior, tool allowlist, schema-compatible responses, no shell tool, no cleanup tool, and no external upload by default.

Optional acceptance checks against local application servers may run only when those servers are listening. Those checks should use target manifests or fixtures and should not introduce product-specific branches into the runtime.

## Phase 8 Dogfood and Plugin Checks

- No-browser tests cover `target init`, generated manifest shape, MCP target tools, and plugin metadata boundaries.
- Browser smoke tests cover enriched findings, `action_plan`, `review_advisory`, target review reports, and route/viewport coverage artifacts.
- Architecture tests verify `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/browser-debug-review/SKILL.md` stay local and stdio-based.
- Plugin validation should pass with the local plugin validator before publication or marketplace work is proposed.
- Package dry-run verification must include plugin metadata, the plugin-facing skill, and the reusable target manifest template without publishing.

## Phase 9 Review Quality Checks

- Browser smoke tests cover `quality_signals` in single-URL and target review output.
- Browser smoke tests cover image alt text findings, low contrast findings, visible overlap findings, local release readiness, and disabled model-review boundaries.
- Markdown report smoke coverage verifies that the Quality Signals section is present.
- Architecture tests continue to block target-specific runtime branches, existing-profile reuse, storage-state persistence, HTTP/socket listeners, arbitrary shell execution, unapproved upload paths, and destructive cleanup commands.

## Phase 10 Dogfood Route Checks

- Browser smoke tests cover unlinked manifest `expectedRoutes` being visited as explicit review targets.
- Browser smoke tests cover `coverage.routes.expected` and `quality_signals.route_coverage.expected_manifest_routes`.
- Browser smoke tests cover `route_budget_exceeded` skipped routes when `budgets.maxRoutes` prevents full coverage.
- These checks use local fixture pages so they do not depend on a specific application, framework, localhost port, route name, or UI label.

## Phase 11 Page Expectation Checks

- No-browser tests cover optional manifest `pages` normalization, page priority normalization, page-specific viewport merging, and generated manifests with empty `pages`.
- Browser smoke tests cover expected visible text, missing expected selectors, page-specific mobile viewport execution, page-level mock metrics, `coverage.pages`, `quality_signals.page_expectations`, local `review_artifact_index` artifacts, and Markdown report page expectation output.
- These checks use local fixture pages and do not depend on a specific application, framework, localhost port, route name, or UI label.

## Phase 12 Rendered-State Dogfood Checks

- Browser smoke tests cover broken visible images, visible loading indicators that remain after the review wait, and empty table/list/grid containers without visible empty-state messaging.
- Browser smoke tests cover `quality_signals.rendered_state`, `evidence_summary.loading_indicators`, `evidence_summary.empty_containers`, Developer Triage Markdown report output, and target `manifest_suggestions`.
- These checks use local fixture pages and do not depend on a specific application, framework, localhost port, route name, or UI label.

## Phase 13 Dogfood Signal Refinement Checks

- Browser smoke tests cover normal ready/progress business-state text and verify it is not reported as lingering loading UI.
- Loading indicator evidence remains limited to explicit loading semantics, loading-like attributes, roles, or short status text rather than arbitrary ancestor text.
- These checks use local fixture pages and do not depend on a specific application, framework, localhost port, route name, or UI label.

## Phase 14 Content UX Advisory Checks

- No-browser tests cover schema registry/file property parity for review and target manifest schemas.
- No-browser tests cover target manifest `sourceData`, `localContentUxAdvisory`, and page `expectations.dataBindings` normalization.
- No-browser tests cover pure content UX advisory source-to-screen matching and verify source values are not copied into advisory JSON.
- Architecture tests verify the advisory module has no Playwright import, filesystem import, target-specific literals, external control channel, arbitrary shell execution, upload path, or destructive cleanup path.
- Browser smoke tests cover manifest opt-in advisory output, `quality_signals.content_ux`, bounded Markdown report output, and unchanged review findings, `metrics.finding_count`, the existing `action_plan`, and `quality_signals.release_readiness`.
- These checks use local fixture pages and do not depend on a specific application, framework, localhost port, route name, or UI label.

## Phase 15 Content UX Heuristic Checks

- No-browser tests cover selector-scoped text, explicit attribute, state attribute, and risk attribute advisory checks.
- No-browser tests cover `localContentUxAdvisory.requiredUserQuestions` and page `expectations.userQuestions`.
- Browser smoke tests cover real Playwright element evidence for selector-scoped content UX advisory checks.
- Browser smoke tests continue to prove enabled advisory output does not change review findings, `metrics.finding_count`, the existing `action_plan`, or `quality_signals.release_readiness`.
- These checks use local fixture pages and reusable templates instead of runtime branches for a specific application, framework, localhost port, route name, or UI label.

## Phase 16 Content UX Handoff Checks

- No-browser tests cover separate `content_ux_findings`, `content_ux_action_plan`, and `content_ux_readiness` generation from local advisory signals.
- No-browser tests verify content UX handoff output does not copy source values.
- Browser smoke tests verify disabled manifests omit all top-level `content_ux_*` handoff outputs.
- Browser smoke tests verify enabled manifests emit top-level `content_ux_*` handoff outputs and Content UX Developer Handoff report output.
- Browser smoke tests continue to prove enabled advisory output does not change review findings, `metrics.finding_count`, the existing `action_plan`, or `quality_signals.release_readiness`.

## Phase 17 Content UX Practical Handoff Checks

- No-browser tests cover expanded advisory categories for status clarity, action clarity, navigation clarity, information architecture, coverage contracts, and content contracts.
- No-browser tests cover `content_ux_page_handoff` grouping by manifest page.
- No-browser tests cover `content_ux_manifest_authoring` suggestions for missing user questions, next-action contracts, and navigation contracts.
- Browser smoke tests verify enabled manifests emit `content_ux_page_handoff` and `content_ux_manifest_authoring`.
- Browser smoke tests verify Content UX Developer Handoff reports include page and manifest-authoring summary lines.
- Browser smoke tests continue to prove enabled advisory output does not change review findings, `metrics.finding_count`, the existing `action_plan`, or `quality_signals.release_readiness`.

## Phase 18 Content UX Review Brief Checks

- No-browser tests cover manifest page `role`, `localContentUxAdvisory.reviewBrief`, and `localContentUxAdvisory.rubric` normalization.
- No-browser tests cover `content_ux_review_brief` and `content_ux_rubric_evaluation` output while preserving source-value non-disclosure.
- Browser smoke tests verify disabled manifests omit the new review brief and rubric outputs.
- Browser smoke tests verify enabled manifests emit `content_ux_review_brief`, `content_ux_rubric_evaluation`, and Content UX Review Brief report output.
- Browser smoke tests continue to prove enabled advisory output does not change review findings, `metrics.finding_count`, the existing `action_plan`, or `quality_signals.release_readiness`.

## Release Readiness Checks

`CHANGELOG.md`, `.github/workflows/ci.yml`, `ops/CI_MANIFEST.tsv`, and `docs/workflow/RELEASE.md` are release-readiness files. They do not authorize publish actions. npm credentials, license changes, and `npm publish` remain approval-bound.

## Phase 2a Design Checks

- Product documents describe the same CLI binary, package baseline, JSON contract, artifact root, and safety defaults.
- `TASK_TRACKER.md` and `HANDOFF.md` agree on the current phase and next approval boundary.
- No npm publication path is added in the local MVP phase.
- Playwright visual checks are required after browser-runtime behavior changes when a suitable local target is available.

## Phase 7 Design Checks

- Product documents describe the same review-platform direction, target manifest model, CLI/MCP adapter boundary, and security defaults.
- Review findings keep deterministic, heuristic, model-advisory, and owner-required outcomes separate.
- MCP remains an adapter over the CLI/core contract, not a separate runtime owner.
- Model/API review remains opt-in and is not part of deterministic local gates.
- Target-specific application details remain in manifests, fixtures, or acceptance evidence, not generic runtime code.

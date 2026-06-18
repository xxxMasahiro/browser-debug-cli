# IMPLEMENTATION_PLAN.md

## Preconditions

- Work stays in `/home/masahiro/projects/agent-toolbox/browser-debug-cli`.
- The lesson repository remains the parent workflow source.
- Phase 0 is documentation and scaffold only.
- Runtime browser automation starts only after the scaffold and initial documents are verified.

## Phase Plan

### Phase 0: Scaffold and Document Sync

- Create the standard product repository structure.
- Add product-local `AGENTS.MD`, docs, ops manifests, skills, tools, `src/`, and `tests/`.
- Synchronize the initial five documents:
  - `docs/product/REQUIREMENTS.md`
  - `docs/product/SPECIFICATION.md`
  - `docs/product/IMPLEMENTATION_PLAN.md`
  - `docs/workflow/TASK_TRACKER.md`
  - `docs/workflow/HANDOFF.md`
- Run structure, document, security, design-system, and workflow-pair checks.

### Phase 1: Local Git

- Confirm the user wants to enter local Git mode.
- Run `git init`.
- Review `git status`.
- Create an initial commit once scaffold checks pass.
- Decide whether `.githooks/` should be added for product-local hooks.

### Phase 2a: Package and Runtime Design

- Record the local package baseline without installing dependencies.
- Use `browser-debug` as the working CLI binary name.
- Use Node.js 20 or newer and ESM modules.
- Define the command surface, JSON output contract, artifact layout, and security defaults.
- Keep the first implementation slice limited to `doctor`, command parsing, deterministic JSON errors, and focused tests.
- Keep the first Playwright slice limited to one-shot `observe --url <url> --json` with an ephemeral context.
- Keep long-running browser supervision opt-in and later than one-shot observation.
- Do not create a GitHub repository, install dependencies, launch browsers, add CI, or publish packages in this phase.

### Phase 2b: GitHub Public Repository

- Confirm public OSS repository name and owner. Completed with `xxxMasahiro/browser-debug-cli`.
- Use `gh auth status` and `gh repo create` only after approval. Completed after developer approval.
- Push the initial branch. Completed by fast-forwarding local `main` and pushing `origin/main`.
- Add remote-sync notes to the handoff. Completed.

### Phase 3: CI

- Add `.github/workflows/` and `ops/CI_MANIFEST.tsv`. Completed locally.
- Add product-local CI manifest validation without remote execution. Completed with `tools/check_product_ci.sh`.
- Run local checks before push. Completed locally.
- Confirm GitHub Actions status after a remote repository and push exist. Completed for `main` push CI.

### Phase 4: npm Package Design and Local CLI Scaffold

- Add `package.json`. Completed for the private local package.
- Use `browser-debug` as the local CLI binary name. Completed.
- Use ESM modules and Node.js 20 or newer. Completed.
- Keep the package private and `UNLICENSED` until public release naming and licensing are approved.
- Add package metadata, test commands, browser smoke commands, and distribution file declarations. Completed for the local MVP slice.
- Add local package dry-run verification without publishing. Completed with `npm run test:pack` and aggregate product-gate wiring.
- Add a local release-readiness command without publishing. Completed with `npm run release:check`.
- Preserve the Phase 2a design baseline unless the user approves a design change.

### Phase 5: MVP Runtime

- Implement `doctor`. Completed for local environment and safety checks.
- Implement command parsing and deterministic JSON error output. Completed for the planned command surface.
- Implement one-shot `observe`. Completed with Playwright-backed ephemeral Chromium contexts.
- Implement session start and simple actions. Completed for file-backed local session metadata and ephemeral action execution.
- Implement opt-in process-scoped browser supervision. Completed with `supervise --url <url> --actions <json-array>`.
- Implement opt-in local background browser daemon supervision. Completed with `daemon start`, `daemon status`, and `daemon stop` using an ephemeral local worker process.
- Implement artifact directory handling. Completed for sessions, observations, screenshots, traces, reports, and spec exports under `.browser-debug/`.
- Add focused tests for command parsing, observation output, action coverage, and safety boundaries. Completed with `npm test` and `npm run test:browser`.
- Add headed/devtools launch-mode regression coverage. Completed with deterministic no-GUI tests in `npm test`.
- Define JSON schema versioning details and the default artifact retention policy. Completed with `doctor` metadata, product docs, and deterministic tests.
- Keep authentication automation, external daemon control channels, profile reuse, credential handling, and external upload for later approved phases.

### Phase 6: Release

- Add release notes and changelog. Completed locally with `CHANGELOG.md`.
- Add release readiness checklist and publication blockers. Completed locally with `docs/workflow/RELEASE.md`.
- Confirm npm account and publishing method.
- Publish only after CI and release checklist pass.

### Phase 7: Review Platform and CLI/MCP Adapter

Phase 7 extends the local MVP into a reusable review platform. It preserves the existing local-first Playwright runtime, schema compatibility rules, artifact boundaries, and security invariants. It does not reimplement Playwright, clone the full Playwright MCP surface, or add product-specific branches for individual Control Centers.

Current status: completed for local deterministic review, target manifests, route/viewport coverage, risk classification, conservative mock metrics, local stdio MCP adapter, schema registry, package API exports, and package file-set readiness. Model or vision review remains a later explicit opt-in layer and was not implemented.

#### Phase 7a: Specification and Schema Planning

- Completed: synchronized requirements, specification, implementation plan, security, verification, task tracker, and handoff before runtime work began.
- Completed: defined review JSON contracts for target manifests, review runs, findings, route coverage, viewport coverage, action coverage, layout evidence, mock metrics, and reports.
- Completed: added machine-readable schema files for the existing envelope family and the new review contracts.
- Completed: added `schema list` and `schema get`.
- Completed: recorded compatibility rules: additive fields are allowed within the current schema version, while removals, renames, type changes, status vocabulary changes, artifact path semantic changes, and action vocabulary changes require a schema version bump.
- Completed: kept human text output non-contractual; JSON envelopes, error codes, artifact descriptors, findings, action types, and exit codes are contractual.

#### Phase 7b: Review MVP for One URL

- Completed: added `browser-debug review --url <url> --viewport <name-or-size> --screenshot --json`.
- Completed: reused existing Playwright observation, artifact, redaction, and envelope helpers.
- Completed: captured layout evidence for deterministic findings: visible element rectangles, overflow metrics, accessible names, basic computed styles, focusability, console errors, failed requests, final URL, response status, screenshot descriptors, and environment metadata.
- Completed: produced `data.review`, `data.findings`, `data.metrics`, and `data.environment` in the standard JSON envelope.
- Completed: emitted local artifacts under ignored `.browser-debug/` paths, including `reviews/`, `layouts/`, screenshots, mock metrics, coverage, and Markdown reports when requested.
- Completed: implemented deterministic finding categories first: `browser_health`, `layout_integrity`, `interaction_quality`, `accessibility_basics`, `mock_fidelity`, and `evidence_quality`.
- Completed: kept trace capture outside review MVP because trace zip files can contain raw page content.

#### Phase 7c: Target Manifest and Site Review

- Completed: added `browser-debug review --target <manifest> --json`.
- Completed: defined a generic target manifest with `baseUrl`, `scope`, `seeds`, `expectedRoutes`, `viewportMatrix`, `actionPolicy`, `budgets`, `artifacts`, `masks`, `regions`, and optional `appHints`.
- Completed: kept Control Center examples out of runtime-specific branches.
- Completed: implemented route and review run IDs for deduplication while avoiding dependency on one framework or one route style.
- Completed: added support for shell-safe structured input such as `--input -`, `--target @file`, `--actions @file`, and `--action @file`.

#### Phase 7d: Route Discovery, Viewport Matrix, and Coverage

- Completed: discovered routes from same-origin anchors and navigation action candidates.
- Completed: normalized route records with URL, pathname, search, hash, and route source.
- Completed: ran each route through named viewport profiles such as desktop, laptop, and mobile.
- Completed: recorded discovered, visited, skipped, failed, and expected-missing routes.
- Completed: recorded viewport coverage through coverage artifacts and review metadata.
- Completed: deduplicated route coverage and capped findings to keep output bounded.

#### Phase 7e: Risk-Gated Action Exploration

- Completed: extended action candidates with stable IDs, role/name metadata, selector, risk class, confidence, and preconditions.
- Completed: classified actions as `navigation`, `state_revealing`, `input_required`, `mutating`, `destructive`, or `external`.
- Completed: executed route discovery through navigation candidates only; mutating, destructive, and external actions are not executed by default.
- Completed: kept arbitrary shell execution out of scope.

#### Phase 7f: Mock Comparison

- Completed: added optional `--mock` and conservative local mock metrics. `--mask` and `--region` are parsed for forward compatibility and remain reserved for later image-processing enhancements.
- Completed: normalized viewport before capture and recorded local PNG dimensions, hashes, and byte-difference metrics without adding image-processing dependencies.
- Completed: emitted local mock metrics under ignored `.browser-debug/diffs/`.
- Completed: treated dimension mismatches and missing baselines as `inconclusive`.
- Completed: avoided absolute "matches design" claims; the implementation reports threshold-based local metrics only.

#### Phase 7g: Local MCP Adapter

- Completed: added a thin MCP stdio adapter with `browser-debug-mcp` and `browser-debug mcp serve` metadata.
- Completed: reused the same CLI/core contracts used by local commands.
- Completed: exposed a narrow allowlist of tools for doctor, observe, review, and schema operations.
- Completed: kept the adapter local and stdio-only.
- Completed: did not add HTTP listeners, socket listeners, remote control channels, arbitrary shell tools, cleanup tools, existing profile reuse, storage-state persistence, OAuth, external upload, or credential handling.
- Completed: added adapter tests that verify tool allowlists and schema-compatible output.

#### Phase 7h: Model or Vision Review Layer

- Completed as boundary: model or vision review remains a later optional layer, not a dependency for deterministic review checks.
- Completed as boundary: no screenshots, traces, raw DOM, source text, console logs, network data, or reports are sent outside the local process.
- Completed as boundary: model output remains unimplemented and out of deterministic pass/fail gates.
- Completed as boundary: untrusted-data handling remains documented in security and review output semantics.

#### Phase 7i: Public API and Packaging Readiness

- Completed: added public `exports` for stable local core APIs while the package remains private and unreleased.
- Completed: excluded internal product documents from the package file set while keeping public README, changelog, schemas, runtime source, and selected workflow security/release/verification docs.
- Completed: kept local dry-run package verification through `npm run test:pack`; packed install smoke remains a release-hardening task before npm publication.
- Completed as boundary: package naming, license choice, npm token handling, and publication remain approval-bound.

### Phase 8: Dogfood Review Workflow, Plugin Bundle, and Publication Readiness

Phase 8 turns the Phase 7 review core into a more complete local workflow for whole-application review and Codex plugin use. It preserves all existing command surfaces and does not add external upload, OAuth, existing-profile reuse, HTTP/socket MCP transport, marketplace registration, license changes, or npm publication.

#### Phase 8a: Control-Surface Target Manifest Readiness

- Completed: added `browser-debug target init --url <url> --json`.
- Completed: generated target manifests are local artifacts under `.browser-debug/targets/`.
- Completed: generated manifests include same-origin scope, seed route, viewport matrix, route budget, screenshot defaults, masks, regions, and app hints.
- Completed: route budgets now count routes rather than route-viewport pairs during target review.
- Completed as boundary: application-specific route names, localhost ports, and product-specific labels remain in manifests or user-provided acceptance evidence, not runtime branches.

#### Phase 8b: Actionable Developer Review Reports

- Completed: findings now carry `priority`, `impact`, `recommendation`, `fix_candidates`, and `implementation_notes`.
- Completed: review JSON now includes `action_plan` with local release-gate status, prioritized next actions, and coverage summary.
- Completed: Markdown reports include action plan, local review advisory, recommendations, findings, and artifact references.
- Completed: target review supports `--report`.

#### Phase 8c: Local Heuristic Visual Review Advisory

- Completed: review JSON now includes `review_advisory` as a local heuristic summary of browser-health, layout, accessibility, interaction, mock, and coverage signals.
- Completed: advisory output clearly states it is not human aesthetic approval and not model output.
- Completed as boundary: subjective model or vision review remains approval-bound and external evidence transfer remains unimplemented.

#### Phase 8d: Codex Plugin Bundle

- Completed: added `.codex-plugin/plugin.json` for a local Browser Debug CLI plugin bundle.
- Completed: added `.mcp.json` pointing to the local `browser-debug-mcp` stdio adapter.
- Completed: added `skills/browser-debug-review/SKILL.md` with local review workflow and security boundaries.
- Completed: MCP allowlist now includes `browser_debug_target_init` and `browser_debug_review_target`.
- Completed as boundary: no personal marketplace entry was written, and no plugin installation state was mutated.

#### Phase 8e: Distribution Readiness Without Publication

- Completed: package file-set includes plugin metadata, the plugin-facing skill, and reusable review target template.
- Completed: added `templates/review-target-manifest.json`.
- Completed: product structure, security, manifest, schema, test, README, and workflow docs are synchronized with Phase 8.
- Completed as boundary: public package name, license, npm token handling, marketplace publication, and npm publication remain approval-bound.

### Phase 9: Local Review Quality Signals and Dogfood Readiness

Phase 9 completes the local implementation path for the five-step next-work plan: Control-surface dogfood workflow readiness, detection quality strengthening, developer improvement handoff, local release decision support, and model/vision review boundary preparation. It remains local-first and generic. It does not add target-specific Control Center runtime branches, external upload, model/API calls, OAuth, existing-profile reuse, HTTP/socket MCP transport, marketplace mutation, license changes, or npm publication.

#### Phase 9a: Control-Surface Dogfood Workflow Readiness

- Completed: target-manifest review output now includes `quality_signals` for route and viewport coverage.
- Completed: target Markdown reports include quality signal summaries for developer triage.
- Completed as boundary: specific Control Center URLs, labels, routes, and acceptance notes remain in manifests or local evidence, not runtime code.

#### Phase 9b: Detection Quality Strengthening

- Completed: layout evidence now captures headings, landmarks, images, visible overlap candidates, richer computed style data, and contrast inputs.
- Completed: review findings now cover heading hierarchy, missing main landmarks, missing image alt text, low text contrast, overlapping visible elements, and mobile touch-target sizing using existing generic categories.
- Completed: browser smoke coverage verifies alt text, contrast, overlap, quality signals, report summaries, and model-boundary metadata.

#### Phase 9c: Developer Improvement Handoff

- Completed: `quality_signals.developer_handoff` groups implementation focus, fix queue entries, implementation notes, and rerun guidance.
- Completed: Markdown reports include a dedicated Quality Signals section.
- Completed: existing action plans remain compatible and continue to carry prioritized findings and reproduction data.

#### Phase 9d: Local Release Decision Support

- Completed: `quality_signals.release_readiness` records the local evidence gate, blocker counts, owner-review need, and approval-bound release blockers.
- Completed as boundary: local release readiness does not authorize package naming, license changes, npm publication, marketplace registration, or external evidence transfer.

#### Phase 9e: Model/Vision Review Boundary Preparation

- Completed: `quality_signals.model_review_boundary` explicitly reports model review as disabled, with `external_evidence_transfer=false`.
- Completed: model/vision review remains a later approval-bound layer and is not part of deterministic gates.
- Completed: no screenshots, DOM, console logs, network evidence, traces, reports, or source text leave the local process.

### Phase 10: Manifest-Driven Dogfood Route Review

Phase 10 completes the seven-step local dogfood readiness plan for real applications without adding target-specific runtime branches. It makes target manifests authoritative enough to review known application routes even when those routes are not discoverable from same-origin links during the first crawl. It remains local-first and does not add external upload, model/API calls, authentication automation, existing-profile reuse, HTTP/socket MCP transport, marketplace mutation, license changes, or npm publication.

#### Phase 10a: Target URL Availability Boundary

- Completed as workflow boundary: application URLs remain user-provided runtime inputs or local manifest data, not compiled runtime defaults.
- Completed as workflow boundary: when no target URL is provided or listening, fixture-based browser smoke tests verify the generic route-review behavior.

#### Phase 10b: Manifest Generation and Route Editing

- Completed: `target init` remains the starting point for local manifests.
- Completed: owners can add known routes to `expectedRoutes` after manifest generation.
- Completed as boundary: expected route names, labels, and localhost ports stay in local manifests or ignored artifacts.

#### Phase 10c: Expected Route Execution

- Completed: target review now enqueues `expectedRoutes` as reviewable routes with source `expected_route`.
- Completed: unlinked expected routes can be visited through the same viewport matrix as discovered routes.
- Completed: out-of-scope or invalid expected routes still remain subject to manifest scope and URL validation.

#### Phase 10d: Coverage and Budget Accounting

- Completed: coverage output now includes `coverage.routes.expected`.
- Completed: queued routes that cannot be visited because `budgets.maxRoutes` is exhausted are recorded in `coverage.routes.skipped` with `reason=route_budget_exceeded`.
- Completed: target quality signals report expected manifest route counts and route-budget-exceeded counts.

#### Phase 10e: Developer Triage

- Completed: target reports and quality signals show when route budget prevents full review.
- Completed: developers can raise route budgets or split manifests, then rerun the same target review command.

#### Phase 10f: Re-Review Stability

- Completed: fixture tests cover unlinked expected routes and route-budget skip behavior, allowing the same manifest workflow to be rerun after fixes.

#### Phase 10g: Detection Gap Loop

- Completed as workflow boundary: findings from real dogfood runs should be classified as target-app issues or generic CLI detection gaps.
- Completed as boundary: new detection rules must remain generic and evidence-derived before being added to the runtime.

### Phase 11: Manifest Page Expectations and Artifact Indexes

Phase 11 completes the five-step local implementation path for practical whole-application review handoff. It extends the manifest-driven review workflow with optional named page expectations, structured local artifact indexes, deterministic page-state checks, page-level mock metrics, and fixture-backed dogfood validation. It remains local-first and generic. It does not add target-specific runtime branches, external upload, model/API calls, authentication automation, existing-profile reuse, HTTP/socket MCP transport, marketplace mutation, license changes, or npm publication.

#### Phase 11a: Review Target Manifest Extension

- Completed: target manifests can now include optional `pages` entries with page name, URL or path, priority, expected text, expected selectors, page-specific viewports, page-specific mock path, and threshold.
- Completed: `target init` and the reusable template include an empty `pages` array so owners can edit manifests after generation.
- Completed: page-specific viewports are merged into the target viewport matrix and executed only for the matching page when specified.
- Completed as boundary: specific application routes, labels, ports, and UI names remain in local manifests or fixtures, not runtime branches.

#### Phase 11b: Structured Review Artifact Indexes

- Completed: single-URL and target reviews write local `review_artifact_index` artifacts under `.browser-debug/review-artifacts/`.
- Completed: artifact indexes summarize artifact descriptors, evidence classes, local triage state, route and page coverage summaries, rerun guidance, and local safety boundaries.
- Completed: review output includes `evidence_summary` and `artifact_index` metadata for developer handoff.
- Completed as boundary: artifact indexes do not upload evidence, delete artifacts, reuse profiles, store credentials, or authorize publication.

#### Phase 11c: Deterministic Page-State Checks

- Completed: target review evaluates manifest page expected visible text and expected selectors against local browser evidence.
- Completed: missing expected text or selectors produce evidence-backed `layout_integrity` findings with route, viewport, priority-derived severity, reproduction steps, and fix guidance.
- Completed: target coverage includes `coverage.pages.expected`, `coverage.pages.checked`, `coverage.pages.failed`, and `coverage.pages.skipped`.
- Completed: target quality signals include `quality_signals.page_expectations` for expected, checked, failed, skipped, missing-text, and missing-selector counts.

#### Phase 11d: Page-Level Mock Metrics

- Completed: manifest page entries can provide a workspace-relative `mock` path and optional threshold.
- Completed: page-level mock metrics reuse the existing local mock comparison path and remain conservative when screenshots or dimensions are inconclusive.
- Completed as boundary: mock metrics are local numeric evidence and do not claim subjective design approval.

#### Phase 11e: Dogfood Fixture Validation

- Completed: browser smoke coverage verifies page-specific viewports, expected text, missing expected selectors, page-level mock metrics, target report output, and review artifact indexes.
- Completed: no-browser tests verify manifest page normalization and generated target manifest shape.
- Completed as boundary: live Control Center review should run only when URLs are provided and listening; fixture tests cover the generic runtime path when no live target is available.

### Phase 12: Rendered-State Dogfood Hardening

Phase 12 completes the six-step local dogfood hardening path for making real application reviews more useful without adding target-specific runtime branches. It adds generic rendered-state evidence, developer triage report summaries, manifest suggestions, and fixture-backed validation. It remains local-first and does not add external upload, model/API calls, authentication automation, existing-browser-profile reuse, HTTP/socket MCP transport, marketplace mutation, license changes, or npm publication.

#### Phase 12a: Target Availability Boundary

- Completed as workflow boundary: live application URLs remain runtime inputs or local manifest data, not compiled runtime defaults.
- Completed as workflow boundary: when no live target URL is provided, fixture-based browser smoke tests verify the generic dogfood review path.

#### Phase 12b: Rendered-State Evidence

- Completed: layout evidence now records visible image load state, loading indicators, and empty table/list/grid containers.
- Completed: review findings now flag broken visible images, lingering loading indicators after the review wait, and empty data containers without visible empty-state messaging.
- Completed: single-URL and target quality signals now include `rendered_state` summaries for developer triage.

#### Phase 12c: Developer Triage Reports

- Completed: Markdown review reports now include a Developer Triage section with actionable finding counts, severity counts, category counts, route coverage, and page expectation summaries when available.
- Completed: Markdown review reports include rendered-state quality signal status.

#### Phase 12d: Manifest Suggestions

- Completed: target review output now includes additive `manifest_suggestions`.
- Completed: manifest suggestions cover missing named page expectations, unpinned discovered routes, exhausted route budgets, failed page expectations, and rendered-state gaps.
- Completed as boundary: suggestions do not mutate manifest files automatically and do not add target-specific application logic.

#### Phase 12e: Dogfood Fixture Validation

- Completed: browser smoke coverage verifies broken-image, lingering-loading, empty-data-container, rendered-state quality signal, evidence summary, and Markdown report output.
- Completed: target browser smoke coverage verifies manifest suggestions in JSON and Markdown report output.

#### Phase 12f: Sync and Release-Safe Boundaries

- Completed: requirements, specification, implementation plan, task tracker, handoff, README, changelog, and test manifest are synchronized with the rendered-state dogfood hardening slice.
- Completed as boundary: model/API review, evidence leaving the local process, HTTP/socket MCP server mode, authentication automation, external upload, existing-profile reuse, public package naming, license changes, plugin marketplace registration, npm publication, and destructive cleanup remain approval-bound.

## Verification Method

- `./tools/product-gate`
- `./tools/check_product_ci.sh`
- `npm test`
- `npm run test:browser`
- `npm run test:pack`
- `npm run release:check`
- lesson-side `product-scaffold-check` with this repository path.
- lesson-side `product-repository-authority status` with this repository path.
- `check_workflow_pair_sync.sh --repo <this-repo>`.
- Current local runtime checks include command parser tests, JSON error tests, `doctor` schema/retention metadata tests, headed/devtools launch-mode tests, session/report/spec tests, daemon parser tests, redaction tests, architecture regressions for generic runtime boundaries, shared page evidence helpers, and local daemon boundaries, Playwright browser smoke tests with screenshots, traces, click/form/keyboard/scroll/wait actions, supervised ordered actions, daemon start/status/stop, local package dry-run verification, Control Center observation, and aggregate product-gate execution.
- Later release work should add real headed visual checks where a display is available, choose public package naming and license, and publish to npm after approval.
- Phase 7 review-platform checks should add no-browser tests for parser contracts, target manifest validation, route normalization, viewport matrix expansion, action risk classification, finding generation, issue deduplication, schema compatibility, and report shape.
- Phase 7 browser smoke checks should add fixture-based review runs for console errors, failed requests, empty render, horizontal overflow, clipped text, missing labels, screenshots, route coverage, viewport coverage, and artifact placement under ignored `.browser-debug/`.
- Phase 7 mock-comparison checks should prove exact fixture matches are within thresholds, shifted UI produces diff artifacts and metrics, masks suppress volatile regions, dimension mismatches are `inconclusive`, and stable fixtures produce stable findings across repeated runs.
- Phase 7 MCP adapter checks should prove stdio/local-only behavior, tool allowlists, no shell tools, no cleanup tools, no HTTP/socket listener, schema-compatible responses, and no external upload by default.
- Phase 8 checks cover target manifest generation, MCP target tools, plugin metadata validation, action plans, local review advisory, target Markdown reports, package dry-run file-set readiness, and local security boundaries.
- Phase 9 checks cover local quality signals, heading hierarchy evidence, image alt findings, contrast findings, overlap findings, mobile target sizing, developer handoff, local release readiness, report summaries, and disabled model-review boundaries.
- Phase 10 checks cover unlinked expected route execution, expected route coverage artifacts, route budget skip accounting, and target quality signal route-budget warnings.
- Phase 11 checks cover manifest page expectation normalization, page-specific viewport execution, expected text and selector checks, page-level mock metrics, local review artifact indexes, and page expectation quality signals.
- Phase 12 checks cover rendered-state evidence for broken images, lingering loading indicators, empty data containers, developer triage report summaries, manifest suggestions, and fixture-backed target review report output.
- Security checks should be extended to guard against `launchPersistentContext`, `userDataDir`, storage-state persistence, external listener creation, arbitrary shell execution, unapproved upload paths, and destructive cleanup commands.

## Recovery Path

- If scaffold checks fail, fix missing canonical files or manifest format first.
- If document sync fails, update `TASK_TRACKER.md` and `HANDOFF.md` together.
- If security checks fail, remove committed secret-like data and update `SECURITY.md`.
- If Git/GitHub/npm steps are requested too early, stop and return to the phase plan.
- If review findings become noisy or subjective, split deterministic findings from heuristic or model-advisory findings and require confidence labels.
- If route discovery over-crawls, reduce scope through target manifest budgets and same-origin route policy.
- If mock comparison is unstable, mark the result `inconclusive` and record environment and capture stability metadata.
- If MCP adapter work starts to diverge from the CLI core, stop and refactor through shared core modules before adding adapter-specific behavior.

## Approval Boundaries

- Ask before new runtime phases that add authentication, external daemon control channels, external upload, profile reuse, or credential handling.
- Ask before new dependency installation or network use.
- Ask before commit, push, branch deletion, or remote changes.
- Ask before `gh repo create`, remote setup, push, or any public GitHub action.
- Ask before npm publish.
- Ask before external uploads, OAuth, webhooks, credential storage, or destructive cleanup.
- Ask before model/API review integration or any evidence leaves the local process.
- Ask before HTTP/socket MCP server mode, remote control channels, persistent session storage, existing-browser-profile reuse, or authentication automation.
- Ask before public API stabilization, npm package file-set changes intended for publication, package naming, license changes, or packed release promotion.

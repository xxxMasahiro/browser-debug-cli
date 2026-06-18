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

Phase 7 extends the local MVP into a reusable review platform. It preserves the existing local-first Playwright runtime, schema compatibility rules, artifact boundaries, and security invariants. It does not reimplement Playwright, clone the full Playwright MCP surface, or add product-specific branches for individual applications.

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
- Completed: kept application examples out of runtime-specific branches.
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
- Completed: did not add HTTP listeners, socket listeners, remote control channels, arbitrary shell tools, cleanup execution tools, existing profile reuse, storage-state persistence, OAuth, external upload, or credential handling.
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

Phase 9 completes the local implementation path for the five-step next-work plan: review-surface dogfood readiness, detection quality strengthening, developer improvement handoff, local release decision support, and model/vision review boundary preparation. It remains local-first and generic. It does not add target-specific application runtime branches, external upload, model/API calls, OAuth, existing-profile reuse, HTTP/socket MCP transport, marketplace mutation, license changes, or npm publication.

#### Phase 9a: Control-Surface Dogfood Workflow Readiness

- Completed: target-manifest review output now includes `quality_signals` for route and viewport coverage.
- Completed: target Markdown reports include quality signal summaries for developer triage.
- Completed as boundary: specific application URLs, labels, routes, and acceptance notes remain in manifests or local evidence, not runtime code.

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
- Completed as boundary: live application review should run only when URLs are provided and listening; fixture tests cover the generic runtime path when no live target is available.

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
- Completed as boundary: model/API review, evidence leaving the local process, HTTP/socket MCP server mode, authentication automation, external upload, existing-profile reuse, public package naming, license changes, plugin marketplace registration, npm publication, automatic cleanup, and cleanup outside the configured artifact root remain approval-bound.

### Phase 13: Dogfood Signal Refinement

Phase 13 completes the local dogfood refinement found while reviewing real application pages. It keeps the review engine generic and avoids application-specific branches while reducing false-positive rendered-state findings.

#### Phase 13a: Loading Signal Precision

- Completed: loading indicator evidence no longer treats normal ready/progress business-state text as lingering loading UI.
- Completed: loading indicator matching remains active for explicit loading semantics, loading-like attributes, roles, class/id/test identifiers, and short status copy.
- Completed: browser smoke coverage verifies ready/progress business text does not produce `loading_indicator_count` or loading-indicator findings.

#### Phase 13b: Dogfood Recheck Boundary

- Completed: local dogfood rechecks confirmed API/proxy startup issues are reported as browser-health findings, and corrected startup removes those findings.
- Completed: corrected local dogfood review no longer reports loading indicators for ready/progress business-state copy.
- Completed as boundary: remaining target findings are target UI findings or owner-review heuristics, not target-specific Browser Debug CLI runtime branches.

### Phase 14: Manifest Opt-In Content UX Advisory

Phase 14 adds a local content UX advisory layer for the gap identified during dogfood review: deterministic rendered-state checks do not judge whether a page communicates the right state, audience, or source facts. The implementation is manifest-driven, reusable, and additive. It does not add model/API review, evidence transfer, application-specific runtime branches, arbitrary source-data file reads, HTTP/socket MCP transport, authentication automation, existing-profile reuse, package publication, license changes, or marketplace mutation.

#### Phase 14a: Document and Contract Sync

- Completed: requirements, specification, implementation plan, task tracker, handoff, security, verification, README, changelog, manifests, schema files, and target template are synchronized with the content UX advisory contract.
- Completed: the canonical opt-in field is `localContentUxAdvisory.enabled=true`.
- Completed: absent or disabled advisory configuration leaves target review output compatible with previous behavior.

#### Phase 14b: Schema Parity and Manifest Contract

- Completed: `schema get --name review` and `schema get --name target_manifest` now match the packaged schema-file property sets for the fields touched by this phase.
- Completed: target manifests can declare bounded inline `sourceData`, `localContentUxAdvisory`, and page `expectations.dataBindings`.
- Completed: generated and template target manifests include disabled content UX advisory scaffolding for discoverability.

#### Phase 14c: Pure Advisory Module

- Completed: `src/content-ux-advisory.js` normalizes advisory configuration and page data bindings, evaluates source-to-screen text bindings, and returns advisory output without Playwright, filesystem access, artifact reads, or application-specific literals.
- Completed: source values and full page text are used only in process and are not copied into advisory messages or Markdown reports.
- Completed: manifest path or URL source references are recorded as ignored advisory signals rather than read automatically.

#### Phase 14d: Target Review Integration

- Completed: target review emits `local_content_ux_advisory` and `quality_signals.content_ux` only when the manifest opts in.
- Completed: content UX advisory does not create review findings, does not change `metrics.finding_count`, does not change `action_plan`, and does not change `quality_signals.release_readiness`.
- Completed: the MCP adapter inherits the behavior through existing target manifest review tools without adding new MCP arguments or a broader tool surface.

#### Phase 14e: Reports, Tests, and Boundaries

- Completed: Markdown target reports include a bounded Content UX Advisory section when advisory output exists.
- Completed: no-browser tests cover schema parity, manifest normalization, source-value non-disclosure, and pure advisory behavior.
- Completed: browser smoke tests verify opt-in advisory output and prove the enabled advisory does not alter existing findings, metrics, action plans, or release readiness.
- Completed: architecture tests cover the pure advisory module and continue to block target-specific literals, browser profile reuse, storage-state persistence, external listeners, arbitrary shell execution, unapproved uploads, and cleanup outside the configured artifact root.

### Phase 15: Content UX Heuristic Strengthening

Phase 15 completes the five-step local implementation path for making content and UX advisory more useful for manifest-declared dashboard and application review targets without adding model/API review, evidence transfer, target-specific runtime branches, arbitrary source-data file reads, HTTP/socket MCP transport, authentication automation, existing-profile reuse, package publication, license changes, marketplace mutation, or existing-feature tradeoffs.

#### Phase 15a: Selector-Scoped Content Contracts

- Completed: target review evidence summaries now include bounded element evidence with selector, text, accessible name, allowed attributes, and rectangle data.
- Completed: `pages[].expectations.dataBindings[]` can evaluate selector-scoped `text` bindings against a specific element instead of only full page text.
- Completed: existing manifest behavior remains compatible when no selector is provided.

#### Phase 15b: Attribute, State, and Risk Bindings

- Completed: content UX advisory now evaluates `target="attribute"` with an explicit attribute name.
- Completed: content UX advisory now evaluates `target="data-state"` against selector-scoped state attributes such as `data-state`, `data-status`, and common `aria-*` state attributes.
- Completed: content UX advisory now evaluates `target="data-risk"` against selector-scoped risk attributes such as `data-risk`, `data-severity`, `aria-invalid`, and `aria-disabled`.
- Completed: source values and full page text are not copied into advisory output or Markdown reports.

#### Phase 15c: Information Architecture and User Journey Advisory

- Completed: `localContentUxAdvisory.requiredUserQuestions[]` and `pages[].expectations.userQuestions[]` can declare questions the intended user should be able to answer from reviewed page evidence.
- Completed: advisory counts now include required user questions, answered questions, unanswered questions, and inconclusive questions.
- Completed: unanswered questions remain advisory signals and do not create findings or alter release gates.

#### Phase 15d: Reusable Status Dashboard Manifest Example

- Completed: added `templates/status-dashboard-content-ux-target-manifest.json` as a generic, disabled-by-default manifest example for status dashboards.
- Completed: generated and reusable target manifests now expose disabled advisory scaffolding with content contract, source alignment, selector-scoped state, information architecture, and user journey checks.
- Completed as boundary: application-specific URLs, product names, labels, and ports remain outside runtime code.

#### Phase 15e: Tests, Safety Boundaries, and Loader Deferral

- Completed: no-browser tests cover selector-scoped text, attribute, state, risk, and required user-question advisory logic.
- Completed: browser smoke tests cover real Playwright element evidence for selector-scoped advisory checks and prove findings, metrics, action plans, and release readiness are unchanged.
- Completed: arbitrary source-data file and URL loaders remain unimplemented and approval-bound; external references continue to be recorded as ignored advisory inputs.

### Phase 16: Content UX Handoff Outputs

Phase 16 completes the six-step local implementation path for turning content UX advisory signals into developer handoff output without trading off existing review behavior. It keeps existing `findings`, `metrics.finding_count`, `action_plan`, and `quality_signals.release_readiness` semantics unchanged, and it does not add external source loaders, model/API review, evidence upload, existing-profile reuse, HTTP/socket MCP transport, authentication automation, package publication, license changes, marketplace mutation, or target-specific runtime branches.

#### Phase 16a: Dedicated Advisory Finding Namespace

- Completed: target review emits top-level `content_ux_findings` only when `localContentUxAdvisory.enabled=true`.
- Completed: `content_ux_findings` are derived from local advisory signals and are not appended to the existing review `findings` array.
- Completed: bounded advisory evidence includes source signal, selector/page context, counts, and local-only flags without source values or full page text.

#### Phase 16b: Dedicated Advisory Action Plan

- Completed: target review emits top-level `content_ux_action_plan` only when content UX advisory is enabled.
- Completed: content UX next actions are prioritized from advisory findings and remain separate from the existing `action_plan`.
- Completed: `content_ux_action_plan` sets `gate_effect="none"` and `legacy_action_plan_unchanged=true`.

#### Phase 16c: Dedicated Advisory Readiness

- Completed: target review emits top-level `content_ux_readiness` only when content UX advisory is enabled.
- Completed: content UX readiness summarizes content-owner review needs without changing `quality_signals.release_readiness`.
- Completed: `content_ux_readiness` sets `gate_effect="none"`, `blocking_release_gate=false`, `legacy_release_readiness_unchanged=true`, and `external_evidence_transfer=false`.

#### Phase 16d: Report Handoff Section

- Completed: Markdown target reports include a bounded Content UX Developer Handoff section when dedicated advisory handoff output exists.
- Completed: the report section references advisory IDs, severity, selectors, and recommendations without copying source values or full page text.

#### Phase 16e: Schema, Docs, and Manifests

- Completed: review schema registry and packaged review schema files include the additive content UX handoff properties.
- Completed: requirements, specification, implementation plan, task tracker, handoff, security, verification, README, changelog, and test manifest documentation are synchronized with the Phase 16 contract.

#### Phase 16f: Regression Coverage and Boundary Preservation

- Completed: no-browser tests cover dedicated content UX findings/action/readiness generation, advisory status, source-value non-disclosure, and unchanged advisory-only gates.
- Completed: browser smoke tests cover opt-in top-level `content_ux_*` output, disabled-output absence, Markdown handoff output, and unchanged review findings, metrics, existing action plans, and release readiness.
- Completed: architecture tests continue to guard against target-specific runtime literals, profile reuse, storage-state persistence, external listeners, arbitrary shell execution, unapproved upload paths, cleanup outside the configured artifact root, filesystem reads in the advisory helper, and model/API review.

### Phase 17: Practical Content UX Handoff

Phase 17 completes the six-step local implementation path for making content UX advisory more actionable while preserving all existing review outputs. It remains manifest-driven, local-only, advisory-only, and generic. It does not add external source loaders, model/API review, evidence upload, existing-profile reuse, HTTP/socket MCP transport, authentication automation, package publication, license changes, marketplace mutation, or target-specific runtime branches.

#### Phase 17a: Expanded Content UX Categories

- Completed: `content_ux_findings` now distinguish status clarity, action clarity, navigation clarity, information architecture, content contracts, source-data alignment, coverage contracts, and review scope while keeping legacy manifest category aliases accepted.
- Completed: category selection is derived from local advisory signal shape and manifest question text, not model output or target-specific runtime branches.

#### Phase 17b: Page-Level Developer Handoff

- Completed: target review emits top-level `content_ux_page_handoff` only when content UX advisory is enabled.
- Completed: page handoff groups advisory findings by manifest page with status, owner-review need, finding count, top categories, and bounded top findings.
- Completed: `content_ux_readiness` summarizes page-handoff counts without changing `quality_signals.release_readiness`.

#### Phase 17c: Manifest Authoring Guidance

- Completed: target review emits top-level `content_ux_manifest_authoring` only when content UX advisory is enabled.
- Completed: manifest-authoring suggestions cover missing audience or goal, missing inline source data, ignored external source references, missing page data bindings, missing user questions, inconclusive question evidence, inconclusive binding sources, next-action contracts, and navigation contracts.
- Completed: `target init` and reusable target templates expose the expanded local content UX check vocabulary while staying disabled by default.

#### Phase 17d: Report Triage Improvements

- Completed: Markdown target reports include page-level content UX finding summaries inside Content UX Developer Handoff.
- Completed: Markdown target reports include manifest-authoring suggestion counts and bounded suggestions, including zero-suggestion runs.

#### Phase 17e: Regression Tests

- Completed: no-browser tests cover expanded content UX categories, page handoff, manifest-authoring suggestions, source-value non-disclosure, and unchanged advisory-only gates.
- Completed: browser smoke tests cover disabled-output absence, enabled page handoff, enabled manifest-authoring output, report handoff output, and unchanged review findings, metrics, existing action plans, and release readiness.

#### Phase 17f: Documentation, Schema, and Evidence Sync

- Completed: review schema registry and packaged review schema files include additive `content_ux_page_handoff` and `content_ux_manifest_authoring` properties.
- Completed: requirements, specification, implementation plan, task tracker, handoff, security, verification, README, changelog, manifests, templates, and session memory are synchronized with the Phase 17 contract.

### Phase 18: Content UX Review Brief and Rubric Evaluation

Phase 18 completes the six-step local implementation path for making content UX advisory compare reviewed evidence with manifest-declared product communication intent. It remains manifest-driven, local-only, advisory-only, additive, and generic. It does not add external source loaders, model/API review, evidence upload, existing-profile reuse, HTTP/socket MCP transport, authentication automation, package publication, license changes, marketplace mutation, or target-specific runtime branches.

#### Phase 18a: Review Brief Manifest Contract

- Completed: `localContentUxAdvisory.reviewBrief` supports a bounded summary, user roles, and decision needs.
- Completed: manifest pages can declare a generic `role` such as workflow overview or triage detail.
- Completed: target init and reusable templates expose review brief scaffolding while keeping advisory opt-in disabled by default.

#### Phase 18b: Rubric Manifest Contract

- Completed: `localContentUxAdvisory.rubric[]` supports category, page, selector, criterion, expected evidence, match mode, text match, severity, and required fields.
- Completed: rubric categories remain generic and reusable across status dashboard and application review targets.
- Completed: expected evidence phrases are used only for local matching and are not copied into reports.

#### Phase 18c: Local Brief and Rubric Evaluation

- Completed: content UX advisory evaluates decision needs and rubric criteria against reviewed page text or selector-scoped element evidence.
- Completed: evaluation returns passed, owner-review, and inconclusive states with evidence counts and reviewed viewport summaries.
- Completed: evaluation remains pure local code without Playwright, filesystem reads, artifact reads, external transfer, or target-specific runtime branches.

#### Phase 18d: Additive Review Output and Reports

- Completed: target review emits additive `content_ux_review_brief` and `content_ux_rubric_evaluation` only when content UX advisory is enabled.
- Completed: Markdown target reports include a bounded Content UX Review Brief section.
- Completed: existing review `findings`, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness` remain unchanged.

#### Phase 18e: Tests and Boundary Preservation

- Completed: no-browser tests cover target manifest normalization, review brief output, rubric evaluation, source-value non-disclosure, and unchanged advisory-only gates.
- Completed: browser smoke tests cover disabled-output absence, enabled review brief output, enabled rubric evaluation, report output, and unchanged review findings, metrics, existing action plans, and release readiness.

#### Phase 18f: Documentation, Schema, and Evidence Sync

- Completed: review schema registry and packaged review schema files include additive `content_ux_review_brief` and `content_ux_rubric_evaluation` properties.
- Completed: requirements, specification, implementation plan, task tracker, handoff, security, verification, README, changelog, manifests, templates, and session memory are synchronized with the Phase 18 contract.

### Phase 19: Local Target Manifest Validation

Phase 19 completes the local no-browser manifest-authoring checkpoint for target review workflows. It remains generic, local-first, non-mutating, and additive. It does not add external source loaders, model/API review, evidence upload, existing-profile reuse, HTTP/socket MCP transport, authentication automation, package publication, license changes, marketplace mutation, target-specific runtime branches, or changes to existing review findings, metrics, action plans, or release readiness.

#### Phase 19a: CLI Parser and Runtime Contract

- Completed: `browser-debug target validate --target <manifest> --json` and `browser-debug target validate --input - --json` are parsed as explicit target subcommands.
- Completed: the runtime reuses the existing target manifest normalization contract and returns validation status, normalized counts, local authoring suggestions, review next commands, and local-first boundaries.
- Completed: validation does not launch a browser, mutate manifests, upload evidence, reuse profiles, read arbitrary source-data files or URLs, or expose sourceData values.

#### Phase 19b: MCP and API Reuse

- Completed: the local stdio MCP adapter exposes `browser_debug_target_validate` over the same CLI/core path.
- Completed: `runTargetValidate` is exported from the local package API next to target manifest creation.
- Completed: no HTTP/socket transport, shell tool, cleanup execution tool, marketplace mutation, external upload, or profile-reuse capability was added.

#### Phase 19c: Tests and Documentation

- Completed: no-browser tests cover successful validation, invalid manifest errors, source-value non-disclosure, explicit local boundaries, parser shape, and MCP tool coverage.
- Completed: product documents, workflow documents, README, changelog, security notes, test-plan manifest, and plugin-facing skill are synchronized with the target validation contract.

### Phase 20: Local Resource Status Preflight

Phase 20 adds a no-browser local resource status preflight for safer browser-heavy review planning. It remains generic, local-first, read-only, and additive. It does not add host cleanup, swap configuration, artifact deletion, arbitrary process control, external upload, existing-profile reuse, HTTP/socket MCP transport, model/API review, authentication automation, package publication, license changes, marketplace mutation, target-specific runtime branches, or changes to existing review findings, metrics, action plans, or release readiness.

#### Phase 20a: CLI Parser and Runtime Contract

- Completed: `browser-debug resource status --json` is parsed as an explicit resource subcommand.
- Completed: the runtime reports process-visible memory, swap, cgroup, pressure, and current Node.js process memory signals through the standard JSON envelope.
- Completed: output includes status classification, thresholds, recommendations, cache policy, and explicit local-first boundaries without launching a browser or writing artifacts.

#### Phase 20b: MCP and API Reuse

- Completed: the local stdio MCP adapter exposes `browser_debug_resource_status` over the same CLI/core path.
- Completed: `runResourceStatus`, `collectResourceStatus`, `parseMeminfoText`, and `parsePressureText` are exported from the local package API.
- Completed: no shell tool, cleanup execution tool, privileged helper, HTTP/socket transport, external upload, profile-reuse capability, or host mutation capability was added.

#### Phase 20c: Tests and Documentation

- Completed: no-browser tests cover parser shape, deterministic resource fixture output, cgroup and pressure parsing through injected readers, MCP tool wiring, and local safety boundaries.
- Completed: architecture tests verify the resource status module has no Playwright import, child process use, external listener, profile reuse, storage persistence, file deletion, or host mutation path.
- Completed: product documents, workflow documents, README, changelog, security notes, test-plan manifest, and plugin-facing skill are synchronized with the resource status preflight contract.

### Phase 21: Resource Guard Integration

Phase 21 integrates the Phase 20 resource status signal into browser-heavy review flows. It remains additive and local-first. Default advisory mode does not change review findings, `metrics.finding_count`, existing action plans, or release readiness.

#### Phase 21a: Review Preflight and Rechecks

- Completed: `review --resource-guard advisory|fail-critical|off` is parsed as an explicit review option.
- Completed: single-URL review runs a local resource preflight before browser launch and emits additive `data.resource_guard`.
- Completed: target review reuses single-URL review for route/viewport rechecks and aggregates resource guard checks into the target review output.
- Completed: `fail-critical` stops before browser launch or skips remaining target work only when resource status is critical.

#### Phase 21b: Heavy Artifact Warnings and Invariance

- Completed: screenshot and trace requests produce resource guard warnings because those artifacts can increase memory and local artifact pressure.
- Completed: resource guard output remains separate from review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.
- Completed: architecture tests verify the guard has no Playwright import, shell execution, external listener, profile reuse, host mutation, or file deletion path.

### Phase 22: Daemon Lifecycle Guard

Phase 22 adds optional local lifecycle bounds to the existing background daemon without changing the default daemon behavior.

- Completed: `daemon start --idle-timeout <duration>` records idle timeout metadata and stops the worker after local inactivity.
- Completed: `daemon start --max-lifetime <duration>` records lifetime metadata and stops the worker after the configured lifetime.
- Completed: daemon metadata includes `lifecycle.idle_timeout_ms`, `lifecycle.max_lifetime_ms`, `started_at`, `last_activity_at`, `expires_at`, and `stop_reason`.
- Completed: daemon control remains local process signal and metadata only; no HTTP/socket control channel, profile reuse, persistent storage, external upload, privileged helper, or arbitrary process control was added.

### Phase 23: Artifact Size Monitor and Cleanup Proposal

Phase 23 adds local artifact usage planning without deleting files.

- Completed: `resource artifacts plan --json` reports `.browser-debug/` usage, top-level directory totals, largest files, cleanup policy, and cleanup candidates.
- Completed: `resource artifacts cleanup --dry-run --json` returns the same proposal and confirms no files were deleted.
- Completed: MCP exposes only `browser_debug_resource_artifacts_plan`; cleanup execution is not exposed through MCP.
- Completed: package API exports artifact planning helpers.

### Phase 24: Explicit Artifact Cleanup

Phase 24 adds explicit local cleanup execution scoped to the configured Browser Debug CLI artifact root.

- Completed: `resource artifacts cleanup --execute --json` deletes only selected regular files under the configured artifact root and writes a local receipt under `.browser-debug/receipts/`.
- Completed: cleanup skips symbolic links, preserves receipts, uses the configured artifact root boundary, and does not mutate system cache, configure swap, execute shell commands, use privileged helpers, upload evidence, reuse profiles, or control arbitrary processes.
- Completed: no-browser tests cover parser shape, dry-run no-delete behavior, explicit execute receipt behavior, MCP plan-only wiring, and architecture boundaries.

### Phase 25: Local Agent Advisory Handoff

Phase 25 adds local agent advisory package, ingest, and report contracts for subscription-capable local agents and future API-provider boundaries. It remains local-first, advisory-only, provider-neutral, and additive. It does not add direct provider API calls, automatic upload, OAuth, credential storage, existing-profile reuse, HTTP/socket MCP transport, model output as deterministic findings, marketplace mutation, package publication, or changes to existing review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

#### Phase 25a: Surface Registry and Schemas

- Completed: `agent surfaces list --json` returns local subscription-agent surfaces and a generic API-provider boundary without contacting providers.
- Completed: machine-readable schemas define `agent_surface`, `agent_task_package`, `agent_advisory_result`, and `agent_disclosure_policy`.
- Completed: review schema accepts additive agent advisory fields while preserving existing review result requirements.

#### Phase 25b: Evidence Package and Subscription Handoff

- Completed: `agent package --review-index <path> --surface <id> --json` creates local `.browser-debug/agent-packages/<id>/packet.json`, prompt, and evidence-packet receipt artifacts from an existing review artifact index.
- Completed: packages include bounded triage, coverage, evidence class, rerun, and local artifact-reference metadata only. Raw screenshots, trace contents, raw DOM, console payloads, network payloads, report bodies, and sourceData values are not copied into the package.
- Completed: package output records included/excluded evidence classes, hashes, sensitive local artifact reference types, and `api_call_performed=false`.

#### Phase 25c: Advisory Ingest and Report

- Completed: `agent ingest --package <path> --input <json> --json` normalizes untrusted advisory JSON from inline input, stdin, or a workspace-relative `@file` into separate `agent_advisory`, `agent_advisory_findings`, `agent_advisory_action_plan`, `agent_advisory_readiness`, and `owner_decision_requests` output.
- Completed: advisory output is labeled untrusted, `gate_effect="none"`, `legacy_action_plan_unchanged=true`, and `legacy_release_readiness_unchanged=true`.
- Completed: `agent report --review-index <path> --agent-result <path> --json` renders a separate Markdown advisory report without mutating review artifacts.

#### Phase 25d: MCP and API Boundaries

- Completed: the local stdio MCP adapter allowlist is unchanged for agent advisory work; no MCP agent execution, provider API execution, artifact upload, cleanup execution, shell execution, or credential tool was added.
- Completed: API-provider support is represented only as a future approval-bound surface. No provider SDK, network request, endpoint selection, token handling, or external evidence transfer was implemented.
- Completed: package API exports the local agent advisory helpers for future dashboard integration.

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
- Current local runtime checks include command parser tests, JSON error tests, `doctor` schema/retention metadata tests, headed/devtools launch-mode tests, session/report/spec tests, daemon parser tests, redaction tests, architecture regressions for generic runtime boundaries, shared page evidence helpers, and local daemon boundaries, Playwright browser smoke tests with screenshots, traces, click/form/keyboard/scroll/wait actions, supervised ordered actions, daemon start/status/stop, local package dry-run verification, optional live application observation, and aggregate product-gate execution.
- Later release work should add real headed visual checks where a display is available, choose public package naming and license, and publish to npm after approval.
- Phase 7 review-platform checks should add no-browser tests for parser contracts, target manifest validation, route normalization, viewport matrix expansion, action risk classification, finding generation, issue deduplication, schema compatibility, and report shape.
- Phase 7 browser smoke checks should add fixture-based review runs for console errors, failed requests, empty render, horizontal overflow, clipped text, missing labels, screenshots, route coverage, viewport coverage, and artifact placement under ignored `.browser-debug/`.
- Phase 7 mock-comparison checks should prove exact fixture matches are within thresholds, shifted UI produces diff artifacts and metrics, masks suppress volatile regions, dimension mismatches are `inconclusive`, and stable fixtures produce stable findings across repeated runs.
- Phase 7 MCP adapter checks should prove stdio/local-only behavior, tool allowlists, no shell tools, no cleanup execution tools, no HTTP/socket listener, schema-compatible responses, and no external upload by default.
- Phase 8 checks cover target manifest generation, MCP target tools, plugin metadata validation, action plans, local review advisory, target Markdown reports, package dry-run file-set readiness, and local security boundaries.
- Phase 9 checks cover local quality signals, heading hierarchy evidence, image alt findings, contrast findings, overlap findings, mobile target sizing, developer handoff, local release readiness, report summaries, and disabled model-review boundaries.
- Phase 10 checks cover unlinked expected route execution, expected route coverage artifacts, route budget skip accounting, and target quality signal route-budget warnings.
- Phase 11 checks cover manifest page expectation normalization, page-specific viewport execution, expected text and selector checks, page-level mock metrics, local review artifact indexes, and page expectation quality signals.
- Phase 12 checks cover rendered-state evidence for broken images, lingering loading indicators, empty data containers, developer triage report summaries, manifest suggestions, and fixture-backed target review report output.
- Phase 13 checks cover loading-indicator precision for ready/progress business-state text and local dogfood rechecks against application pages without target-specific runtime branches.
- Phase 14 checks cover schema registry/file parity, manifest opt-in content UX advisory, bounded inline source data, source-to-screen text binding checks, source-value non-disclosure, report output, advisory purity, and unchanged review findings, metrics, action plans, and release readiness.
- Phase 15 checks cover selector-scoped content UX advisory bindings, attribute/state/risk targets, required user-question advisory checks, reusable status-dashboard manifest templates, source-value non-disclosure, and unchanged review findings, metrics, action plans, and release readiness.
- Phase 16 checks cover additive `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, Markdown Content UX Developer Handoff output, source-value non-disclosure, and unchanged review findings, metrics, existing action plans, and release readiness.
- Phase 17 checks cover expanded content UX categories, `content_ux_page_handoff`, `content_ux_manifest_authoring`, report page/authoring summaries, source-value non-disclosure, and unchanged review findings, metrics, existing action plans, and release readiness.
- Phase 18 checks cover additive `content_ux_review_brief`, additive `content_ux_rubric_evaluation`, report brief/rubric summaries, source-value non-disclosure, and unchanged review findings, metrics, existing action plans, and release readiness.
- Phase 19 checks cover `target validate` parser/runtime behavior, invalid manifest errors, manifest count output, source-value non-disclosure, MCP tool coverage, API export, and no-browser local-first boundaries.
- Phase 20 checks cover `resource status` parser/runtime behavior, deterministic memory/cgroup/pressure fixture output, MCP tool coverage, API export, warnings/recommendations, and read-only local-first boundaries without browser launch, artifact writes, cache mutation, swap mutation, file deletion, shell execution, or profile reuse.
- Phase 21 checks cover review resource guard parser/runtime behavior, critical fail-before-launch behavior, additive `resource_guard` output, and unchanged review findings, metrics, existing action plans, and release readiness.
- Phase 22 checks cover daemon lifecycle parser and metadata behavior plus local daemon boundary regressions.
- Phase 23 checks cover artifact usage planning, dry-run cleanup proposals, MCP plan-only wiring, and no-delete boundaries.
- Phase 24 checks cover explicit artifact-root-only cleanup receipts and architecture boundaries that prevent host cache/swap mutation, shell execution, privileged helpers, external upload, profile reuse, arbitrary process control, and MCP cleanup execution.
- Phase 25 checks cover agent surface listing, evidence package generation, prompt and receipt artifacts, advisory result ingest, advisory report generation, schema parity, API-boundary status, unchanged deterministic gate semantics, and architecture boundaries that prevent provider API calls, automatic upload, credential storage, external listeners, shell execution, profile reuse, MCP agent execution, and review artifact mutation.
- Security checks should be extended to guard against `launchPersistentContext`, `userDataDir`, storage-state persistence, external listener creation, arbitrary shell execution, unapproved upload paths, host cache/swap mutation, and cleanup outside the configured artifact root.

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
- Ask before external uploads, OAuth, webhooks, credential storage, cleanup outside the configured artifact root, automatic cleanup, host cleanup, or destructive cleanup not explicitly scoped to `.browser-debug/`.
- Ask before model/API review integration or any evidence leaves the local process.
- Ask before turning the generic API-provider boundary into direct provider API execution, adding provider SDKs, storing provider credentials, or exposing agent/API execution through MCP.
- Ask before HTTP/socket MCP server mode, remote control channels, persistent session storage, existing-browser-profile reuse, or authentication automation.
- Ask before public API stabilization, npm package file-set changes intended for publication, package naming, license changes, or packed release promotion.

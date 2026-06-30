# VERIFICATION.md

## Verification Scope

Current verification checks repository structure, document synchronization, security defaults, review/MCP/plugin local boundaries, Agentic Human Review plan/run/status/list boundaries, Agentic Human Review schema v2 human-review coverage/report-quality/provider payload boundaries, Agentic Human Review structured benchmark requirement coverage, human-baseline registry/overlay/draft/approval/claim-readiness diagnostics, evidence-set validation and summary, batch comparison, evaluator policy, xhigh round planning and simulation, longitudinal quality, claim policy/audit and claim-standard-gate boundaries, Agentic Human Review benchmark/calibration/provider capability/evidence-planning boundaries, Agentic Human Review AHR-25-40 Visual Evidence Package v2, Visible Text Reading, dogfood readiness/plan, maturity and longitudinal-quality diagnostics, direct-vs-TraceCue comparison, xhigh round-plan v2, Quality Evaluator v3, Human Report v3, transfer approval preview, provider failure diagnostics boundaries, and the loopback Agentic Human Review Responses adapter boundary, MCP profile gating, MCP-only file-input confinement, MCP read-only agent status tools, MCP safe HTTP transport boundaries, token-free installed-bin and local-checkout MCP client configuration output, read-only MCP capability policy output, packaged external-repository usage guidance, consumer runtime-readiness guidance, product identity alignment, local language settings/localization/translation readiness boundaries, read-only operation registry, operation roadmap, operation contracts, operation policy, operation admin readiness, operation provider readiness, release readiness, artifact-root readiness, legacy alias readiness, constrained shell readiness, and final hardening readiness boundaries, CI configuration, design-system placeholders, product operation mode, local MVP runtime behavior, review platform behavior, dogfood target workflow behavior, no-browser target manifest validation, no-browser local resource status preflight, review resource guard behavior, daemon lifecycle guards, artifact usage planning, explicit artifact-root cleanup receipts, cleanup plan hashes and candidate locks, local agent advisory package/request-status/request-detail/workflow/ingest/report behavior, local agent execution plan/run/status/list behavior, deterministic fake provider execution, configured local runner callback execution, env-only generic API adapter behavior, expected-route execution, route-budget coverage accounting, page expectation coverage, rendered-state findings, manifest suggestions, opt-in content UX advisory behavior, selector-scoped advisory contracts, required user-question advisory checks, dedicated content UX handoff output, page-level content UX handoff, manifest-authoring suggestions, review brief/rubric evaluation, local artifact indexes, local review-quality signals, browser smoke coverage, Phase 29 agent execution boundaries, Phase 30 packed install release-hardening boundaries, Phase 31 MCP profile boundaries, Phase 32 rename-readiness boundaries, Phase 33 MCP read-only agent status boundaries, Phase 34 safe HTTP MCP foundation boundaries, Phase 35/38 MCP integration-hardening boundaries, Phase 36 MCP capability policy boundaries, Phase 37 consumer usage boundaries, Phase 39 consumer runtime-readiness boundaries, Phase 41 visual evidence metadata boundaries, Phase 42 visual review provider policy boundaries, Phase 43 standalone image review boundaries, Phase 44 visual review result preparation boundaries, Phase 45 visual review execution boundaries, Phase 46 visual review dashboard boundaries, Phase 47 MCP execution gate boundaries, Phase 48 capture planning/readiness boundaries, Phase 49 capture handoff boundaries, Phase 50 desktop review provider-preparation planning boundaries, Slice 7-8 capture schema/readiness/fail-closed execution boundaries, Phase 59 language settings foundation boundaries, Slice 9-12 provider-free localization and translation readiness boundaries, Phase 60 operation registry foundation boundaries, Phase 60.1 operation roadmap boundary-contract boundaries, Phase 61-64 operation contract foundation boundaries, Phase 65-68 operation policy/readiness boundaries, Phase 69-70 operation admin readiness boundaries, Phase 71-78 provider MCP readiness/execution/status-list boundaries, and Phase 120-155 release/artifact/alias/shell/final readiness boundaries.

Owner-labeled human baseline registry, overlay, draft, approval, validation, comparison, and claim-readiness diagnostics are covered as read-only Agentic Human Review diagnostics; they compare workspace-confined owner labels to advisory result metadata, require approval metadata before owner-labeled evidence verifies, mechanically require target-specific must-not-miss criteria linked to evidence-backed owner labels before approval or validation can produce comparison-ready owner evidence, keep AI drafts non-proof, and do not call providers, write artifacts, expose MCP execution, or authorize equality/superiority claims. Owner-baseline contract propagation coverage verifies `--human-baseline` proposal/plan intake, fail-closed unapproved baseline rejection, plan-hash-bound path-free contract output, provider payload propagation, Responses adapter structured-finding repair for must-not-miss criterion ids and owner label ids, size-bounded provider instructions and compact provider payload contract views that avoid duplicating long owner-baseline arrays, direct comparison from supported validation wrappers after embedded-baseline revalidation, and human-baseline comparison matching from structured ids or evidence-backed coverage records while text-only matches remain insufficient. Adapter provider-payload compaction coverage verifies real-shaped owner-baseline requests stay under the configured request-size cap while preserving `required_benchmark_coverage`, `required_owner_baseline_findings`, `required_owner_baseline_coverage`, effective benchmark requirements, xhigh strict-output requirements, owner label ids, catalog-backed evidence refs, local path stripping, no credential disclosure, and non-secret request section byte diagnostics on overflow. Adapter owner-baseline repair hardening coverage verifies request-derived `required_owner_baseline_findings`, repair context templates with recommended evidence-reference ids, normalization of provider-authored role-level structured findings, conservative identifier aliases, and continued rejection of free-text-only owner-baseline discussion, unknown owner labels, and unknown evidence references. Effective owner-baseline coverage tests verify request-derived `required_benchmark_coverage` and `required_owner_baseline_coverage` templates, owner-baseline required mention/dimension/forbidden-claim evidence-reference catalog priority, repair prompts for missing coverage rows, effective benchmark coverage validation that combines benchmark and owner-baseline requirements, evidence-backed forbidden-claim absence rows, and no synthesis from prose or threshold relaxation. Proof-readiness hardening additionally requires no-browser coverage for request-aware adapter benchmark contracts, forbidden-claim presence-versus-absence semantics, repair/rejection of contradictory forbidden-claim records, structured findings with evidence-reference identifiers, safe alias normalization without fabricated coverage, supported CLI/API runtime-result wrapper aggregation, raw run-wrapper rejection as result evidence, explicit benchmark-case by effort matrices, blocker classification for missing results, mechanical incompleteness, failed calibration, missing comparisons, case-level `direct-vs-tracecue` gaps, and weak calibration claim-readiness blockers.

Agentic Human Review provider model-resolution coverage verifies that provider-neutral abstract model ids can remain in proposal/plan artifacts for configurable planning, but cannot reach live provider API dispatch as executable upstream model names. No-browser tests must cover unresolved abstract models failing before fetch with `AGENTIC_REVIEW_PROVIDER_MODEL_UNRESOLVED`, runtime model environment fallback producing a concrete provider payload model, non-secret `model_resolution` metadata in payloads/executions/receipts/results, Responses adapter rejection of abstract request models before provider fetch, and continued credential-value and raw-provider-response non-storage.

Proof-claim integrity and minimal rerun planning coverage requires focused no-browser tests for fail-closed `review_claims` normalization, placeholder and unsupported claim rejection, adapter repair retries for invalid review claims, strict claim-numerator exclusion through result proof eligibility, evidence-set `claim_integrity` propagation, claim-standard-gate claim-audit failures, forbidden-claim audit provenance that separates blocking affirmative or ambiguous matches from non-blocking evidence-backed absence checks, comparison `metric_diagnostics`, human-baseline diagnostics for missing owner labels and evidence-backed forbidden-claim absence, and claim-standard-gate `rerun_plan` output. The rerun plan is verification guidance only: it must emit command templates and target metadata without calling providers, writing artifacts, launching browsers, mutating release gates, or automatically rerunning failed cells. Evidence regeneration planning coverage must prove that `agentic review evidence-set regenerate plan` consumes workspace-confined evidence-set and claim-gate artifacts, rejects `--execute`, classifies missing calibration cells, resolves provider-rerun plan paths/hashes/transfer flags only after validating explicit registry rows or the result -> execution -> plan artifact chain, fails closed for missing or tampered approved-plan data, marks provider-result reruns as approval-required templates, emits downstream summary/claim-readiness/longitudinal/gate commands, exposes schema/API/package coverage, and still performs no provider execution, artifact writes, browser launch, MCP exposure, or gate mutation.

Manual proof-evidence regeneration should use the same generic sequence for every target artifact and benchmark case: produce or update owner-approved generic plus target-specific human-baseline criteria, run approved standard/deep/xhigh dogfood through the existing plan-hash and exact-transfer-flag path, regenerate calibration, direct-vs-TraceCue, human-baseline comparison, evidence-set summary, claim-readiness, longitudinal quality, and claim-standard-gate outputs, then inspect the gate `blockers` and `rerun_plan` before deciding whether another approved provider run is warranted. Human-equivalent and human-superior claims remain false unless a separately approved claim standard changes the active policy.

## Product-Local Commands

```bash
npm test
npm run test:rename-readiness
npm run test:browser
npm run test:pack
npm run test:pack-install
npm run release:check
./tools/check_product_structure.sh
./tools/check_product_docs.sh
./tools/check_product_security.sh
./tools/check_product_ci.sh
./tools/check_product_design_system.sh
./tools/test_product_repository.sh
./tools/product-gate
```

`./tools/test_product_repository.sh` and `./tools/product-gate` run structure, docs, security, CI manifest, design-system, product mode, `npm test`, `npm run test:rename-readiness`, `npm run test:pack`, and `npm run test:pack-install` when `package.json` is present. `npm run test:browser` is intentionally separate because it launches local Chromium. `npm run release:check` is a no-publish convenience wrapper for no-browser, rename-readiness, package dry-run, and packed install smoke checks.

## Lesson-Side Commands

From `/home/masahiro/projects/ai-driven-development-lesson`:

```bash
PRODUCT_REPO_ROOT="$(git -C /path/to/current-trace-cue-checkout rev-parse --show-toplevel)"
./tools/product-scaffold-check check --repo "$PRODUCT_REPO_ROOT" --context free-development --product-type all --git-optional --ci-optional
./tools/product-repository-authority status --repo "$PRODUCT_REPO_ROOT" --context free-development --product-type all --git-optional --ci-optional
./tools/check_workflow_pair_sync.sh --repo "$PRODUCT_REPO_ROOT"
```

## Current Runtime Checks

The current implementation includes command parser tests, deterministic JSON error tests, `doctor` tests for environment, schema-versioning, and artifact-retention metadata, resource status tests for deterministic memory/cgroup/pressure fixtures and read-only boundaries, resource guard fail-critical tests, artifact plan/dry-run/execute receipt tests, agent surfaces/package/request-status/request-detail/workflow/ingest/report tests, agent execution plan/run/status/list tests for fake provider, configured local runner, missing API configuration, injected API transport, normalized advisory results, and dashboard status/list aggregation, review parser tests, schema command tests, schema registry/file parity tests, target init tests, target validate tests, target manifest tests, opt-in content UX advisory tests, selector-scoped binding tests, required user-question tests, dedicated content UX handoff tests, page handoff tests, manifest-authoring suggestion tests, review brief/rubric tests, action risk classification tests, MCP adapter allowlist tests, MCP safe HTTP transport tests, shell-safe action input tests, headed/devtools launch-mode tests, session/report/spec tests, daemon parser and lifecycle option tests, redaction tests, architecture regressions for generic runtime boundaries, shared evidence helpers, local daemon boundaries, resource status read-only boundaries, resource guard and artifact cleanup boundaries, agent advisory local handoff/workflow boundaries, agent execution provider adapter boundaries, visual review result preparation boundaries, content UX advisory purity, review/MCP/plugin security boundaries, local package dry-run verification, packed install smoke verification, and Playwright smoke tests for local file observation, screenshot/trace artifacts, click actions, form controls, keyboard input, deterministic scroll, wait actions, reports, spec export, process-scoped supervision, daemon start/status/stop, deterministic review findings, action plans, local review advisory output, quality signals, rendered-state findings, mock metrics, target manifest review, target reports, manifest suggestions, content UX advisory opt-in invariance, selector-scoped content UX advisory, content UX Developer Handoff reports, content UX page handoff output, manifest-authoring output, content UX review brief/rubric output, route discovery, explicit expected-route execution, route-budget skip coverage, viewport execution, and coverage artifacts. Manual local checks can use:

Phase 11 adds no-browser coverage for optional manifest page normalization and browser smoke coverage for page expectation checks, page-specific mock metrics, review artifact indexes, `coverage.pages`, and `quality_signals.page_expectations`.

Phase 12 adds browser smoke coverage for broken visible images, lingering loading indicators, empty table/list/grid containers, `quality_signals.rendered_state`, Developer Triage report output, and target review `manifest_suggestions`.

Phase 14 adds no-browser coverage for schema parity, manifest content UX advisory normalization, and source-value non-disclosure. It also adds browser smoke coverage proving `localContentUxAdvisory.enabled=true` emits advisory output without changing findings, metrics, action plans, or release readiness.

Phase 15 adds no-browser and browser smoke coverage for selector-scoped `text`, `attribute`, `data-state`, `data-risk`, and required user-question advisory checks while preserving advisory-only gate behavior.

Phase 16 adds no-browser and browser smoke coverage for additive `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, Markdown Content UX Developer Handoff output, source-value non-disclosure, disabled-output absence, and unchanged review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.

Phase 17 adds no-browser and browser smoke coverage for expanded content UX categories, additive `content_ux_page_handoff`, additive `content_ux_manifest_authoring`, Markdown page/authoring summaries, source-value non-disclosure, disabled-output absence, and unchanged review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.

Phase 18 adds no-browser and browser smoke coverage for additive `content_ux_review_brief`, additive `content_ux_rubric_evaluation`, Markdown brief/rubric summaries, source-value non-disclosure, disabled-output absence, and unchanged review findings, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.

Phase 19 adds no-browser coverage for `target validate` parser/runtime behavior, invalid manifest errors, manifest count output, source-value non-disclosure, MCP validation wiring, and local-first boundaries without launching a browser.

Phase 20 adds no-browser coverage for `resource status` parser/runtime behavior, deterministic memory/cgroup/pressure fixture output, MCP resource status wiring, API export, warnings and recommendations, and read-only local-first boundaries without launching a browser, writing artifacts, mutating system cache, configuring swap, deleting files, executing shell commands, using privileged helpers, uploading evidence, reusing profiles, or controlling arbitrary processes.

Phase 21-24 add no-browser coverage for review resource guard parser/runtime behavior, critical fail-before-launch behavior, additive resource guard output, daemon lifecycle parser/metadata behavior, artifact usage planning, dry-run no-delete behavior, explicit artifact-root-only cleanup receipts, MCP artifact-plan-only wiring, and architecture boundaries that prevent host cache/swap mutation, shell execution, privileged helpers, external upload, profile reuse, arbitrary process control, cleanup outside `.browser-debug/`, and MCP cleanup execution.

Phase 25 adds no-browser coverage for agent surface listing, bounded evidence package generation, prompt and receipt artifacts, advisory result ingest, advisory report output, schema parity, API-boundary status, unchanged deterministic gate semantics, and architecture boundaries that prevent provider API calls, automatic upload, credential storage, external listeners, shell execution, profile reuse, MCP agent execution, and review artifact mutation.

Phase 26 adds no-browser coverage for `agent requests list`, pending/imported status transitions, single-package filtering, request status schema parity, API export, no browser launch, no provider API calls, no automatic upload, no credential storage, no MCP agent execution, and no review artifact mutation.
Phase 27 adds no-browser coverage for `agent requests show`, pending/imported detail output, selected-result matching, request detail schema parity, API export, no artifact writes, no browser launch, no provider API calls, no automatic upload, no credential storage, no MCP agent execution, and no review artifact mutation.
Phase 28 adds no-browser coverage for `agent workflow create/status/index/report`, local workflow manifests and receipts, post-ingest status recomputation, workflow index aggregation, workflow report output, workflow schema parity, API export, no browser launch, no provider API calls, no automatic upload, no credential storage, no MCP agent execution, no external evidence transfer, and no review artifact mutation.

Phase 29 adds no-browser coverage for `agent execution plan/run/status/list`, dry-run plan receipts, explicit `--execute` plus `--execution` enforcement, provider/model mismatch rejection, deterministic fake provider execution, configured local runner callback execution, env-only generic API provider execution, missing API configuration blocking, bounded disclosure, credential redaction, raw artifact non-transfer, raw provider response non-persistence, advisory normalization, execution schema parity, dashboard execution status/list fields, unchanged `agent_workflow` semantics, unchanged deterministic review gates, and MCP execution non-exposure.

Phase 30 adds packed install smoke coverage for the `npm pack` tarball from a temporary install layout. It verifies packaged CLI entrypoints, package API imports, MCP stdio `tools/list`, schema/template/plugin file presence, selected workflow security docs, `doctor`, `schema list`, and no-browser `target validate` without publication, registry install, package rename, license change, external upload, credential storage, or marketplace mutation.

Phase 31 adds no-browser coverage for MCP `safe`, `full`, and `admin` profile resolution, default/full compatibility, launch metadata, out-of-profile tool rejection, invalid profile rejection, packed-install profile API exports, and MCP-only workspace-confined `@file` input rejection. Browser smoke tests are not required for Phase 31 unless browser runtime behavior changes.

Phase 32 adds no-browser coverage for product identity metadata, package/plugin/MCP alignment, package API identity exports, identity-derived package dry-run paths, and packed-install smoke paths derived from package metadata rather than a hard-coded tarball filename. Browser smoke tests are not required for Phase 32 unless browser runtime behavior changes.

Phase 33 adds no-browser coverage for MCP read-only agent advisory/status tools, safe-profile availability, package/request/workflow/execution status calls, packed-install tool exposure, and continued non-exposure of execution run, cleanup execution, provider/API execution, shell, HTTP/socket transport, and artifact-writing advisory tools. Browser smoke tests are not required for Phase 33 unless browser runtime behavior changes.

Phase 34 adds no-browser coverage for explicit HTTP MCP metadata, safe-profile-only startup, loopback bind enforcement, bearer-token enforcement, Host and Origin validation, method rejection, request body-size limits, safe tool listing over HTTP, package API transport exports, and architecture/security isolation of the approved listener module. Browser smoke tests are not required for Phase 34 unless browser runtime behavior changes.

Phase 37 adds no-browser and packed-install coverage for packaged external-repository usage guidance. Browser smoke tests are not required for Phase 37 unless browser runtime behavior changes.

Phase 39 adds no-browser architecture coverage for packaged consumer runtime-readiness guidance. Browser smoke tests are not required for Phase 39 unless browser runtime behavior changes.

Agentic Human Review AHR-25-40 adds no-browser coverage for Visual Evidence Package v2, Visible Text Reading contracts, transfer approval preview, dogfood readiness, dogfood plan, direct-vs-TraceCue comparison mode, xhigh round-plan v2, Quality Evaluator v3, Human Report v3, provider failure diagnostics, schema/API/parser/CLI parity, packed-install schema resolution, and continued absence of provider calls, credential-value reads, raw provider response storage, raw pixel bytes in JSON, MCP AHR execution, deterministic review mutation, and release-gate mutation from readiness/calibration/planning surfaces. Browser smoke tests are not required unless browser runtime behavior changes.

Phase 44 adds no-browser coverage for `visual review prepare`, metadata-only visual evidence preparation, future `visual_review_result` contract exposure, no-provider/no-transfer/no-MCP-execution boundaries, schema registry parity, API exports, MCP non-exposure, capability-policy exclusion reporting, and packed-install file/API/schema coverage. Browser smoke tests are not required for Phase 44 unless browser runtime behavior changes.

Phase 46 adds no-browser coverage for `visual review dashboard`, read-only aggregation over preparation/execution/result metadata, API exports, schema parity, safe MCP tool exposure, architecture boundaries, and packed-install file/API/schema/MCP coverage. Browser smoke tests are not required for Phase 46 unless browser runtime behavior changes.

Phase 47 adds no-browser coverage for `mcp execution gates`, read-only future MCP planning/execution gate reporting, API exports, schema parity, safe MCP tool exposure, architecture boundaries, and packed-install file/API/schema/MCP coverage. Browser smoke tests are not required for Phase 47 unless browser runtime behavior changes.

Phase 48 and Slice 7-8 add no-browser coverage for `capture readiness`, `capture status`, `capture plan`, fail-closed `capture run --execute`, read-only screen/window/desktop app capture capability/privacy/planning, capture artifact and receipt schema contracts, API exports, schema parity, safe MCP readiness/plan exposure, MCP execute-argument rejection, operation registry/capability boundaries, architecture boundaries, and packed-install file/API/schema/MCP coverage. Browser smoke tests are not required unless browser runtime behavior changes.

Phase 49 adds no-browser coverage for `capture handoff`, workspace-confined existing-image metadata handoff, API exports, schema parity, MCP non-exposure, architecture boundaries, and packed-install file/API/schema coverage. Browser smoke tests are not required for Phase 49 unless browser runtime behavior changes.

Phase 50 adds no-browser coverage for `visual review plan --capture-handoff`, capture handoff metadata-only planning, API exports, schema parity, MCP non-exposure, capability/gate reporting, architecture boundaries, and packed-install file/API/schema coverage. Browser smoke tests are not required for Phase 50 unless browser runtime behavior changes.

Phase 59 and Slice 9-12 add no-browser coverage for `settings show`, `settings language`, `settings language policy`, `settings locale resources`, `settings report templates`, `translation readiness`, `translation dry-run`, fail-closed `translation run --execute`, locale alias normalization, dashboard display locale and artifact output language separation, UI/report locale fallback and RTL guards, raw-evidence/canonical-enum non-translation policy, schema parity, API exports, safe MCP read-only inspection, review/dashboard metadata, provider-free translation boundaries, local settings-file confinement, no credential reads, no network/provider calls, and no artifact writes. Browser smoke tests are not required unless browser runtime behavior changes.

Phase 60 adds no-browser coverage for `operation registry`, operation/group/risk selection, schema parity, API exports, safe MCP read-only inspection, registry-derived MCP capability exclusions, registry-derived MCP execution gate operation metadata, package smoke coverage, and architecture boundaries proving no provider execution, deletion, capture, translation execution, npm publication, artifact-root migration, legacy alias removal, shell execution, or MCP write/execute expansion. Browser smoke tests are not required for Phase 60 unless browser runtime behavior changes.

Phase 60.1 adds no-browser coverage for `operation roadmap`, phase/group/risk selection, phase A/B/C boundary contracts, schema parity, API exports, safe MCP read-only inspection, unsupported execution-option rejection, package smoke coverage, and architecture boundaries proving no draft-roadmap promotion, execution-token issuance, live execution, remote CI triggering, provider execution, deletion, capture, translation execution, npm publication, artifact-root migration, legacy alias removal, shell execution, or MCP write/execute expansion. Browser smoke tests are not required for Phase 60.1 unless browser runtime behavior changes.

Phase 61-64 adds no-browser coverage for `operation contracts`, scope/operation selection, risk taxonomy contracts, gate schema shapes, execute-token shape, receipt shape, schema parity, API exports, safe MCP read-only inspection, unsupported execution-option rejection, package smoke coverage, and architecture boundaries proving no token issuance, receipt writing, execution harness enablement, live execution, artifact writes, provider execution, deletion, capture, translation execution, package publication, artifact-root migration, legacy alias removal, shell execution, or MCP write/execute expansion. Browser smoke tests are not required for Phase 61-64 unless browser runtime behavior changes.

Phase 65-68 adds no-browser coverage for `operation policy`, repository-local admin policy config, scope/operation selection, CLI plan readiness, disabled harness readiness, safe MCP readiness inspection, schema parity, API exports, unsupported execution-option rejection, package smoke coverage, and architecture boundaries proving no policy mutation, token issuance, receipt writing, execution harness enablement, admin MCP execution, live execution, artifact writes, provider execution, deletion, capture, translation execution, package publication, artifact-root migration, legacy alias removal, shell execution, or MCP write/execute expansion. Browser smoke tests are not required for Phase 65-68 unless browser runtime behavior changes.

Phase 69-70 adds no-browser coverage for `operation admin-readiness`, MCP admin execute-token flow readiness, MCP admin harness bridge readiness, scope/operation selection, admin policy requirement propagation, safe MCP readiness inspection, schema parity, API exports, unsupported execution-option rejection, package smoke coverage, and architecture boundaries proving no token issuance, token storage, receipt writing, execution harness enablement, admin MCP execution, live execution, artifact writes, provider execution, deletion, capture, translation execution, package publication, artifact-root migration, legacy alias removal, shell execution, or MCP write/execute expansion. Browser smoke tests are not required for Phase 69-70 unless browser runtime behavior changes.

Agentic Human Review roadmap Slice 34-42 adds no-browser coverage for `agentic review propose`, `agentic review plan --proposal`, `agentic review provider-readiness`, approved generic API provider execution through `agentic review run`, `agentic review report-quality`, proposal-hash validation, package-hash validation, exact transfer-flag validation for every externally transferable evidence class, role/claim/critique/rebuttal/integration/dogfood/report-quality metadata, provider adapter isolation, credential sentinel non-disclosure, schema registry/file parity, API exports, operation registry/capability exclusions, MCP tool non-exposure, architecture boundaries, product security checks, and packed-install file/API/schema/MCP coverage. Slice 26-33 coverage remains in place for `agentic review plan/run/status/list`, effort-mode role orchestration, plan-hash validation, tampered-plan rejection, fake provider advisory normalization, injected runner redaction, and generic `agent execution` bypass rejection. AHR-01-12 strengthening adds no-browser coverage for `human_review_schema_version` v2 fields, explicit human-review dimensions, provider instruction contracts, review-quality benchmark contracts, technical evidence and mechanical review summaries, reader-experience review, mechanical-versus-human comparison, human-review coverage/actionability scores, plan validation in provider readiness, result/execution validation in report-quality, conflicting proposal input rejection, provider payload path minimization, and non-loopback HTTP endpoint rejection. Browser smoke tests are not required unless browser runtime behavior changes.

AHR-13-24 adds no-browser coverage for provider capability snapshots and drift rejection, endpoint URL credential/query/redirect hardening, evidence plans that separate visual references from raw pixel bytes, page-type rubric profiles, benchmark case list/show, fixture-aware calibration diagnostics, direct-vs-TraceCue comparison, orchestration v2 contracts, role instruction contracts, consensus/dissent analysis, review-quality evaluator v2, privacy/disclosure audit metadata, provider payload allowlist checks, schema registry/file parity, API exports, packed-install coverage, and continued MCP non-exposure. Live provider dogfood remains manual and env-only; CI uses fake/injected provider seams.

Phase 71-78 add no-browser coverage for `operation provider-readiness`, provider MCP planning, bounded disclosure contracts, env credential guard names, admin-only fake/local/API agent execution exposure, safe MCP status/list contract metadata, scope/operation selection, operation capability-id alias canonicalization, safe MCP readiness inspection, schema parity, API exports, unsupported execution/provider-option rejection, credential sentinel non-disclosure, package smoke coverage, and architecture boundaries. Phase 74-76 coverage proves stdio admin MCP can run fake, local-runner, and injected-fetch API execution through the existing Phase 29 plan/run path while safe/full/HTTP remain non-execution, unknown credential arguments are rejected, idempotency keys are hashed, workspace realpath escape is blocked, credential values are not emitted, and raw provider responses are not stored. Browser smoke tests are not required unless browser runtime behavior changes.

Agentic Human Review Responses adapter coverage adds no-browser tests for request conversion, provider `store: false`, provider tools disabled, adapter token/provider credential separation, local path stripping, raw pixel rejection, non-loopback Host rejection, missing bearer rejection, unsafe provider endpoint rejection, provider output-text parsing, invalid output rejection, benchmark record schema constraints, forbidden-claim absence normalization, unknown evidence-reference rejection, API exports, pack-install file coverage, architecture isolation, and product security allowlisting. Generic API provider timeout override coverage verifies env-only positive-integer configuration, provider-readiness disclosure, capability-hash drift rejection, and unchanged credential/raw-response/MCP boundaries. Live upstream calls remain manual-only and are not part of CI.

Agentic Human Review quality-gate foundation coverage adds no-browser tests for structured benchmark requirement coverage in provider instructions and normalized advisory results, strict calibration scoring from evidence-backed requirement records, deterministic fake-provider structured findings with local evidence references, synthetic baseline non-verification, text-only owner-label match rejection, owner-baseline contract propagation through proposal/plan/provider payload/adapter validation/comparison, `risk_and_misleading_content` dimension coverage, report-quality benchmark and evaluator-policy warnings, evidence-set validation/summary, evidence-set alias inputs, supported CLI runtime-result wrapper inputs for calibration/comparison/human-baseline artifacts, evidence-set origin and claim-numerator eligibility metadata, owner-labeled human baseline registry/overlay/draft/approval/validation/comparison/claim-readiness, batch comparison, xhigh round planning and simulation, longitudinal quality rollups, claim policy/audit diagnostics, claim-standard-gate pass/fail state, incomplete evidence blockers, permissive-policy rejection, unsupported-option rejection, workspace confinement, read-only `--execute` rejection, schema registry/file parity, API exports, packed-install schema resolution, and continued no-provider-call, no-credential-value-read, no-artifact-write, no-MCP-exposure, no-deterministic-review-mutation, no-release-gate-mutation boundaries.

Phase 120-125 add no-browser coverage for `release readiness`, package metadata/provenance/2FA/publication boundary reporting, package smoke coverage, and fail-closed no-publish boundaries. Phase 126-133 add no-browser coverage for artifact-root policy/status/migration planning, dual-root compatibility, future-root metadata, fixture-confined migration boundaries, schema parity, API exports, safe MCP status inspection, and no real migration. Phase 134-139 add no-browser coverage for `identity aliases`, `identity aliases removal-readiness`, fail-closed `identity aliases remove --execute`, legacy alias compatibility retention, schema/API/MCP exposure, and no alias removal.

Phase 140-148 add no-browser coverage for `shell readiness`, `shell plan`, fail-closed `shell run --execute`, use-case/threat/schema/readiness metadata, safe MCP readiness inspection, and architecture boundaries that prevent child-process imports, shell interpreters, environment value reads, credential reads, file mutation, network access, and MCP shell execution. Phase 149-155 add no-browser coverage for `final readiness`, cross-feature regression matrix metadata, local gate-plan metadata with `executed_by_report=false`, safe MCP readiness inspection, and no browser launch, no remote CI, no Git mutation, no publication, no provider call, no artifact migration, no alias removal, no shell execution, and no product-doc promotion.

```bash
node ./bin/trace-cue.js settings language --json
node ./bin/trace-cue.js settings language policy --json
node ./bin/trace-cue.js operation registry --json
node ./bin/trace-cue.js operation roadmap --json
node ./bin/trace-cue.js operation contracts --json
node ./bin/trace-cue.js operation policy --json
node ./bin/trace-cue.js operation admin-readiness --json
node ./bin/trace-cue.js operation provider-readiness --json
node ./bin/trace-cue.js release readiness --json
node ./bin/trace-cue.js artifact-root status --json
node ./bin/trace-cue.js artifact-root migration plan --json
node ./bin/trace-cue.js identity aliases --json
node ./bin/trace-cue.js identity aliases removal-readiness --json
node ./bin/trace-cue.js shell readiness --json
node ./bin/trace-cue.js shell plan --json
node ./bin/trace-cue.js final readiness --json
node ./bin/trace-cue.js resource status --json
node ./bin/trace-cue.js resource artifacts plan --json
node ./bin/trace-cue.js resource artifacts cleanup --dry-run --json
node ./bin/trace-cue.js agent surfaces list --json
node ./bin/trace-cue.js agent package --review-index .browser-debug/review-artifacts/<id>.json --json
node ./bin/trace-cue.js agent requests list --json
node ./bin/trace-cue.js agent requests show --package .browser-debug/agent-packages/<id>/packet.json --json
node ./bin/trace-cue.js agent workflow create --package .browser-debug/agent-packages/<id>/packet.json --json
node ./bin/trace-cue.js agent workflow status --workflow .browser-debug/agent-workflows/<id>/workflow.json --json
node ./bin/trace-cue.js agent workflow index --json
node ./bin/trace-cue.js agent workflow report --workflow .browser-debug/agent-workflows/<id>/workflow.json --json
node ./bin/trace-cue.js agent execution plan --package .browser-debug/agent-packages/<id>/packet.json --surface local-subscription-agent --provider fake-agent --model fake-model --json
node ./bin/trace-cue.js agent execution run --execution .browser-debug/agent-executions/<id>/execution.json --package .browser-debug/agent-packages/<id>/packet.json --surface local-subscription-agent --provider fake-agent --model fake-model --execute --json
node ./bin/trace-cue.js agent execution status --execution .browser-debug/agent-executions/<id>/execution.json --json
node ./bin/trace-cue.js agent execution list --json
node ./bin/trace-cue.js agentic review propose --brief "Review first impression, UI/UX, content comprehension, trust, and likely viewer feeling." --review-index .browser-debug/review-artifacts/<id>.json --effort standard --json
node ./bin/trace-cue.js agentic review plan --proposal .browser-debug/agentic-human-review-proposals/<id>/proposal.json --json
node ./bin/trace-cue.js agentic review provider-readiness --plan .browser-debug/agentic-human-review-plans/<id>/plan.json --json
node ./bin/trace-cue.js agentic review run --plan .browser-debug/agentic-human-review-plans/<id>/plan.json --plan-hash <sha256> --allow-raw-pixels --allow-page-text --execute --json
node ./bin/trace-cue.js agentic review report-quality --result .browser-debug/agentic-human-review-results/<id>/result.json --json
node ./bin/trace-cue.js agentic review evidence-set validate --input <agentic-evidence-set> --json
node ./bin/trace-cue.js agentic review evidence-set summarize --input <agentic-evidence-set> --json
node ./bin/trace-cue.js agentic review evidence-set regenerate plan --evidence-set <agentic-evidence-set> --claim-gate <claim-standard-gate> --json
node ./bin/trace-cue.js agentic review human-baseline registry --json
node ./bin/trace-cue.js agentic review human-baseline overlay --case <benchmark-case-id> --json
node ./bin/trace-cue.js agentic review human-baseline draft --overlay <case-overlay-json> --json
node ./bin/trace-cue.js agentic review human-baseline approval --draft <baseline-draft-json> --decision approved --approver <owner-id> --approved-at <iso8601> --edit-diff <summary> --json
node ./bin/trace-cue.js agentic review human-baseline validate --input <owner-labeled-human-baseline> --json
node ./bin/trace-cue.js agentic review human-baseline compare --baseline <owner-labeled-human-baseline> --result .browser-debug/agentic-human-review-results/<id>/result.json --json
node ./bin/trace-cue.js agentic review human-baseline claim-readiness --evidence-set <agentic-evidence-set> --json
node ./bin/trace-cue.js agentic review status --execution .browser-debug/agentic-human-review-results/<id>/execution.json --json
node ./bin/trace-cue.js agentic review list --json
npm run ahr:responses-adapter -- --json
node ./bin/trace-cue.js visual review prepare --review-index .browser-debug/review-artifacts/<id>.json --json
node ./bin/trace-cue.js visual review dashboard --json
node ./bin/trace-cue.js agent ingest --package .browser-debug/agent-packages/<id>/packet.json --input @agent-advisory-result.json --json
node ./bin/trace-cue.js agent report --review-index .browser-debug/review-artifacts/<id>.json --agent-result .browser-debug/agent-results/<id>.json --json
node ./bin/trace-cue.js observe --url http://127.0.0.1:3000/ --screenshot --trace --timeout 15000 --json
node ./bin/trace-cue.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --timeout 15000 --json
node ./bin/trace-cue.js daemon start --url http://127.0.0.1:3000/ --timeout 15000 --json
node ./bin/trace-cue.js daemon status --daemon <id> --json
node ./bin/trace-cue.js daemon stop --daemon <id> --json
node ./bin/trace-cue.js target init --url http://127.0.0.1:3000/ --json
node ./bin/trace-cue.js target validate --target .browser-debug/targets/<id>.json --json
node ./bin/trace-cue.js review --url http://127.0.0.1:3000/ --viewport mobile --screenshot --report --timeout 15000 --json
node ./bin/trace-cue.js review --url http://127.0.0.1:3000/ --resource-guard fail-critical --timeout 15000 --json
node ./bin/trace-cue.js review --target .browser-debug/targets/<id>.json --report --timeout 15000 --json
node ./bin/trace-cue.js schema list --json
node ./bin/trace-cue.js schema get --name review --json
node ./bin/trace-cue.js mcp serve --profile safe --json
node ./bin/trace-cue.js mcp serve --transport http --profile safe --host 127.0.0.1 --port 0 --json
node ./bin/trace-cue.js mcp config --profile safe --json
node ./bin/trace-cue.js mcp config --transport http --profile safe --host 127.0.0.1 --port 8765 --json
node ./bin/trace-cue.js mcp capabilities --profile admin --scope excluded --json
node ./bin/trace-cue.js mcp execution gates --json
node ./bin/trace-cue.js capture plan --json
node ./bin/trace-cue.js capture readiness --json
node ./bin/trace-cue.js capture handoff --image <workspace-image> --source screen --json
node ./bin/trace-cue.js visual review plan --capture-handoff <capture-handoff-json> --json
node ./bin/trace-cue-mcp.js --profile safe
TRACE_CUE_MCP_HTTP_TOKEN=<token> node ./bin/trace-cue-mcp.js --transport http --profile safe --host 127.0.0.1 --port 8765
```

Optional acceptance checks against local application control surfaces should run only when their local URLs are provided and listening.

## Planned Review Platform Checks

Phase 7 review-platform implementation includes focused checks before any release claim:

- Parser tests for `review --url`, `review --target`, `schema list`, `schema get`, and MCP adapter entrypoints.
- Schema tests for envelopes, artifacts, findings, target manifests, review results, and MCP tool metadata.
- No-browser unit tests for target manifest validation, viewport matrix expansion, action risk classification, redaction, shell-safe action input, and MCP tool output shape.
- Architecture tests that prevent application-specific runtime literals, persistent browser profile reuse, storage-state persistence, unapproved listeners, arbitrary shell execution, unapproved upload paths, and cleanup outside the configured artifact root.
- Browser smoke fixture tests for console errors, empty renders, horizontal overflow, clipped text, missing accessible names, nonblank screenshots, route coverage, viewport coverage, and local artifact placement.
- Mock comparison tests for local metrics and dimension mismatch `inconclusive` behavior.
- MCP adapter tests for stdio compatibility behavior, safe HTTP loopback/token boundaries, tool allowlists, schema-compatible responses, no shell tool, no cleanup execution tool, and no external upload by default.
- Resource status tests for no-browser local memory, swap, cgroup, pressure, process memory, warning/recommendation output, MCP wiring, and read-only host boundaries.
- Resource guard and artifact safety tests for advisory/fail-critical review output, daemon lifecycle metadata, artifact usage planning, explicit cleanup receipts, no MCP cleanup execution, and `.browser-debug/`-scoped deletion only.

Optional acceptance checks against local application servers may run only when those servers are listening. Those checks should use target manifests or fixtures and should not introduce product-specific branches into the runtime.

## Phase 8 Dogfood and Plugin Checks

- No-browser tests cover `target init`, generated manifest shape, MCP target tools, and plugin metadata boundaries.
- Browser smoke tests cover enriched findings, `action_plan`, `review_advisory`, target review reports, and route/viewport coverage artifacts.
- Architecture tests verify `.codex-plugin/plugin.json`, `.mcp.json`, and `skills/browser-debug-review/SKILL.md` stay local and keep the packaged MCP config stdio-based.
- Plugin validation should pass with the local plugin validator before publication or marketplace work is proposed.
- Package dry-run verification must include plugin metadata, the plugin-facing skill, and the reusable target manifest template without publishing.

## Phase 9 Review Quality Checks

- Browser smoke tests cover `quality_signals` in single-URL and target review output.
- Browser smoke tests cover image alt text findings, low contrast findings, visible overlap findings, local release readiness, and disabled model-review boundaries.
- Markdown report smoke coverage verifies that the Quality Signals section is present.
- Architecture tests continue to block target-specific runtime branches, existing-profile reuse, storage-state persistence, unapproved listeners, arbitrary shell execution, unapproved upload paths, and cleanup outside the configured artifact root.

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
- Architecture tests verify the advisory module has no Playwright import, filesystem import, target-specific literals, external control channel, arbitrary shell execution, upload path, or cleanup path.
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

## Phase 20 Resource Status Checks

- No-browser tests cover `resource status` parser/runtime behavior with injected local memory, cgroup, and pressure fixtures.
- No-browser tests cover MCP `browser_debug_resource_status` wiring and local API exports.
- Architecture tests verify the resource status module has no Playwright import, no child process use, no external listener, no profile reuse, no storage persistence, no file deletion path, and explicit host-mutation false boundaries.
- `resource status` output is advisory preflight data only; it does not change review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

## Phase 21-24 Resource Safety Checks

- No-browser tests cover `review --resource-guard fail-critical` stopping before browser launch when resource status is critical.
- No-browser tests cover `resource artifacts plan`, `resource artifacts cleanup --dry-run`, and `resource artifacts cleanup --execute` with local receipts.
- No-browser tests cover MCP `browser_debug_resource_artifacts_plan` while preserving the no-cleanup-tool MCP boundary.
- No-browser tests cover cleanup plan hashes, candidate content-hash locks, optional CLI plan-hash mismatch rejection, pre-delete lock enforcement, no directory deletion, MCP execute-argument rejection, and symlink/root realpath confinement.
- Architecture tests verify resource guard and resource artifacts helpers avoid Playwright imports, shell execution, external listeners, profile reuse, host cache/swap mutation, external upload, privileged helpers, arbitrary process control, and cleanup outside the configured artifact root.
- Resource guard output is additive and does not change review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

## Phase 25 Agent Advisory Handoff Checks

- No-browser tests cover `agent surfaces list`, `agent package`, `agent ingest`, and `agent report` parser/runtime behavior.
- Schema parity tests cover `agent_surface`, `agent_task_package`, `agent_request_status`, `agent_request_detail`, `agent_workflow`, `agent_advisory_result`, and `agent_disclosure_policy`.
- No-browser tests verify packages include only bounded metadata and local artifact references by default, with raw artifact content excluded.
- No-browser tests verify imported agent advisory output stays separate from review `findings`, `metrics.finding_count`, existing `action_plan`, and `quality_signals.release_readiness`.
- Architecture tests verify the agent advisory module has no Playwright import, provider API call, external listener, shell execution, profile reuse, storage-state persistence, automatic upload, credential storage, MCP agent execution, or review artifact mutation path.

## Phase 29 Agent Execution Checks

- Parser tests cover `agent execution plan`, `agent execution run`, `agent execution status`, `agent execution list`, required package/surface/provider/model options, missing `--execute`, unknown provider/model values, and conflict handling.
- Schema parity tests cover a new `agent_execution` schema without breaking existing `agent_workflow`, `agent_advisory_result`, review, resource, daemon, or artifact cleanup schemas.
- No-browser tests cover dry-run plans, local receipts, execution status/list aggregation, missing package behavior, parser-level `--execute` enforcement, required `--execution`, deterministic fake provider success, configured local runner success, API missing-configuration blocking, injected API transport success, advisory-result normalization, and dashboard status/list fields.
- Credential tests verify provider credentials are read only from named environment variables and are never accepted through CLI args, stored in package artifacts, copied into workflow files, printed in JSON, written to reports, written to receipts, or loaded from `.env` automatically.
- Boundary tests verify raw screenshots, traces, DOM, console payloads, network payloads, sourceData values, report bodies, existing browser profile data, and raw provider responses are not transferred or stored by default.
- Invariance tests verify agent execution output does not change review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, `resource_guard`, artifact cleanup behavior, or existing `agent_workflow` status meanings.
- Architecture tests verify provider calls live only in the dedicated provider adapter boundary and are reachable from MCP only through the approved stdio `admin` agent execution adapter path, never from review, resource, daemon, cleanup, or Playwright runtime modules.
- MCP tests verify safe/full/HTTP profiles do not expose `agent execution run`, stdio `admin` exposes only the approved plan/run tools, unknown MCP execution arguments are rejected, `execute: true` is required, idempotency keys are bounded, and package/execution/prompt reads remain workspace-confined.

## Phase 30 Packed Install Checks

- `npm run test:pack-install` creates a temporary install layout from the packed tarball under `/tmp`.
- The check verifies packaged `trace-cue`/`trace-cue-mcp` entrypoints, legacy `browser-debug`/`browser-debug-mcp` aliases, public package API imports, schema files, templates, plugin metadata, plugin skill, and selected workflow security docs.
- The check runs `doctor`, `schema list`, `target validate`, API import, and MCP `tools/list` from the packed layout.
- The check is local-only and does not publish, install from registry, change package naming, change license, upload evidence, store credentials, or mutate marketplace state.

## Phase 34 Safe HTTP MCP Checks

- No-browser tests cover `browser-debug mcp serve --transport http --profile safe --json` metadata without starting a listener.
- No-browser tests start the HTTP transport on a loopback ephemeral port with an injected bearer token and verify `tools/list` exposes only the safe profile.
- HTTP transport tests reject missing bearer tokens, non-loopback origins, non-POST methods, oversized bodies, non-safe profiles, and non-loopback bind hosts.
- Architecture tests verify `node:http`, `createServer`, and `listen` stay isolated to `src/mcp-http-transport.js`.
- Security checks allow only the approved safe HTTP transport module to create a listener and continue to block unapproved listeners elsewhere.
- Packed install smoke checks verify the HTTP transport files and package API transport exports are present without changing publication, package naming, license, marketplace, or external evidence boundaries.

## Phase 35 HTTP MCP Integration Checks

- No-browser tests cover `browser-debug mcp config --json` and `browser-debug mcp config --transport http --profile safe --json` output without starting a listener.
- No-browser tests verify generated config defaults to safe profile, emits no token values, provides reusable installed-bin and local-checkout stdio/safe HTTP metadata, and rejects HTTP `full` or `admin`.
- Packed install smoke creates the installed package API safe HTTP handler and completes an authenticated `initialize` request without binding a port.
- Packed install smoke verifies local-checkout MCP metadata resolves to the installed package entrypoint without requiring npm publication or registry install.
- Architecture tests verify MCP client configuration helpers do not import `node:http`, call `createServer`, or call `listen`.

## Phase 36 MCP Capability Policy Checks

- No-browser tests cover `browser-debug mcp capabilities --profile admin --scope excluded --json` and verify the report distinguishes approved stdio `admin` agent execution plan/run exposure from cleanup execution, unrelated provider/API execution, shell, daemon/session, and HTTP `full` or `admin` boundaries that remain false.
- No-browser tests verify `browser-debug mcp capabilities --profile safe --scope profiles --json` reports the safe profile without exposing browser-launching review tools.
- MCP adapter tests expose `browser_debug_mcp_capabilities` through the safe profile and confirm the tool returns the same read-only policy report.
- Architecture tests verify the capability policy helper does not import `node:http`, call `createServer`, or call `listen`.
- Packed install smoke verifies the source file, package API exports, CLI command, and MCP tool remain available from the installed package layout without publishing.

## Phase 51-52 Desktop Image Review Checks

- No-browser tests cover `capture handoff --image`, `review --image --capture-handoff`, path mismatch errors, hash mismatch errors, and provenance propagation into visual evidence metadata.
- No-browser tests verify `visual review prepare` preserves `desktop_app_capture` source kind from reviewed image evidence.
- Parser tests verify `--capture-handoff` and `--source` are accepted only with `review --image`.
- Boundary tests verify desktop image review does not perform OS capture, enumerate windows or processes, call providers, embed raw pixels in JSON, transfer evidence, expose MCP execution, or mutate browser review behavior.

## Phase 53-55 Visual Review Aggregation Checks

- No-browser tests cover `visual review aggregate --preparation`, source-attributed aggregation findings, corroborated findings, severity conflicts, owner decision requests, source effects, malformed artifact warnings, parser conflicts, and package API parity.
- Architecture tests verify `src/visual-review-aggregation.js` is read-only, provider-free, raw-pixel-free, Playwright-free, shell-free, listener-free, and MCP-free.
- Schema parity tests cover `visual_review_aggregation`.
- MCP tests verify no `browser_debug_visual_review_aggregate` tool is exposed through safe/full/admin profiles.
- MCP capability and execution gate tests report `visual_review_aggregation` as currently excluded and gated by no-artifact-write, no-provider-call, no-raw-pixel, untrusted-output-bounding, and source-attribution requirements.
- Packed install smoke verifies the aggregation module, schema, package API exports, schema resolution, and MCP non-exposure from the installed layout.

## Agentic Human Review AHR-41-44 Checks

- No-browser tests cover `xhigh` mechanical effort contracts in provider capability snapshots, approved plans, provider payloads, advisory normalization, report-quality output, and schema registry output.
- Responses adapter tests cover native effort binding for compatible providers, strict structured-output validation, placeholder-output rejection, missing role/round/synthesis rejection, structured benchmark coverage requirements, catalog-backed evidence references, forbidden-claim absence semantics, and local evidence-reference preservation before advisory normalization.
- Evidence-set, human-baseline comparison, claim-readiness, calibration, and longitudinal-quality tests cover strict claim-numerator exclusion when an `xhigh` result lacks mechanical completion, evidence-reference-backed benchmark records, supported CLI/API runtime-result wrapper aggregation, raw run-wrapper result rejection, or case/effort-aligned comparison coverage.
- No-browser tests cover Responses adapter benchmark-enabled output contracts, exact benchmark coverage record guidance, structured advisory findings, evidence-reference identifiers, unknown evidence-reference rejection, provider alias normalization, and continued no-credential/no-local-path/no-raw-response boundaries.
- Evidence-set and claim-readiness tests cover explicit required benchmark-case by effort matrix reporting, duplicate-result insufficiency, missing result blockers, mechanical-incomplete blockers, failed-calibration blockers, missing comparison blockers, missing case-level `direct-vs-tracecue` comparison diagnostics, weak calibration blocking, and text-only owner-label matches remaining insufficient evidence.
- Claim-standard-gate tests cover incomplete evidence-set exit status, owner claim-review ready pass state, human-equivalent and human-superior claim states remaining false, permissive raw policy rejection, unsupported-option rejection, workspace confinement, schema parity, API export, packed-install schema resolution, and MCP non-exposure.
- No-browser CLI tests cover live dogfood opt-in rejection before provider fetch, unknown benchmark-case rejection, visible-text provenance in packages, and transfer-flag masking for plan-level and package-level provider payload sections.
- No-browser CLI tests cover fake-provider complete `xhigh` output and injected-runner incomplete `xhigh` output with missing role/round/critique/synthesis diagnostics.
- Report-quality, benchmark list/show, calibration, execution, result, and package artifacts expose benchmark-completion readiness without mutating deterministic findings, metrics, release gates, MCP exposure, credential storage, or raw provider response storage.
- Report-quality exposes `human_review_maturity` and `longitudinal_quality_evaluation`, including missing standard/deep/xhigh evidence, missing benchmark cases, comparison/history requirements, and explicit false human-equivalent/human-superior claim flags.
- Dogfood readiness and dogfood plan expose a standard/deep/xhigh maturity plan and benchmark-case matrix without executing providers, writing artifacts, reading credentials, or authorizing external transfer.
- Provider readiness and dogfood readiness remain non-executing; real provider dogfood still runs only through `agentic review run` with matching plan hash, package hash validation, provider capability hash, exact transfer flags, explicit `--execute`, and manual live dogfood opt-in when benchmark/dogfood provider API execution is requested.

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

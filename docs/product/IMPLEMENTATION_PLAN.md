# IMPLEMENTATION_PLAN.md

## Preconditions

- Work stays in the current TraceCue repository root confirmed with `pwd` and `git rev-parse --show-toplevel`; the local checkout directory is `trace-cue` after the approved physical rename flow.
- The lesson repository remains the parent workflow source.
- Phase 0 is documentation and scaffold only.
- Runtime browser automation starts only after the scaffold and initial documents are verified.

## Phase Plan

### Agentic Human Review Responses Adapter: Local Responses-Compatible Live Dogfood Bridge

Purpose: close the manual live-provider dogfood gap without weakening the existing Agentic Human Review owner-layer. The adapter lets the existing `generic-api-provider` endpoint target a loopback local HTTP bridge, while the bridge performs the upstream Responses-compatible request conversion, provider credential loading, JSON advisory parsing, and normalized advisory return.

Implemented scope: add `src/agentic-human-review-responses-adapter.js`, `bin/trace-cue-ahr-responses-adapter.js`, and `npm run ahr:responses-adapter`; enforce loopback host, exact path, POST-only, bearer-token, Host/Origin, request-size, provider-response-size, no-raw-pixel, no-local-path, no-provider-tool, and provider-side no-store boundaries; read provider credentials from environment variables only; keep inbound adapter tokens separate from upstream provider credentials; parse provider `output_text` or output content text into advisory JSON; return normalized advisory data only; export API helpers; add CLI, architecture, pack-install, product-security, and documentation coverage. Non-scope: MCP exposure, generic `agent execution` routing, direct deterministic review mutation, release-gate mutation, provider SDK dependency, persistent credential storage, raw provider response storage, raw pixel transfer, browser capture, or CI-default live provider calls.

Implementation order: preserve the current Agentic Human Review plan/run gate; add the isolated adapter module; add the startup bin and package script; export pure adapter helpers; add injected-fetch tests for conversion, credential non-disclosure, local path stripping, unsafe request rejection, and provider output parsing; add architecture and pack-install coverage; update product/security/verification/README/session-memory docs; then run no-browser, package, security, docs, release, and product gates.

Recovery: this slice is additive and local. Existing review, content UX, visual review, agent execution, Agentic Human Review proposal/plan/run/report-quality, safe HTTP MCP, stdio MCP, release readiness, artifact-root policy, alias compatibility, deterministic findings, and release gates remain compatible. Rollback is a standard Git revert of the adapter changes; no artifact migration, publication, credential persistence, raw response persistence, release gate change, or MCP permission expansion is involved.

### Agentic Human Review Roadmap AHR-13-24: Provider Dogfood, Benchmark Calibration, And Orchestration Quality

Purpose: make Agentic Human Review quality measurable and safely improvable after the AHR-01-12 schema v2 foundation. This slice adds provider capability contracts, evidence planning, page-type rubric profiles, benchmark fixtures, calibration comparisons, xhigh orchestration diagnostics, direct-vs-TraceCue comparison metadata, privacy/disclosure audit output, and live-provider dogfood readiness while preserving the existing plan-hash, exact-transfer-flag, advisory-only, no-MCP-execution boundary.

Implemented scope: add provider capability snapshots and run-time capability-drift rejection; add evidence plans that separate visual references from raw pixel bytes; add page-type rubric profiles; add benchmark case and calibration result contracts; add read-only benchmark list/show, calibrate, and compare CLI/API surfaces; extend plans, packages, advisory results, report-quality output, and Markdown reports with orchestration v2, role instruction, consensus/dissent analysis, review-quality evaluation, calibration metadata, and privacy/disclosure audit data; keep live provider dogfood manual and env-only; and add no-browser fake/injected benchmark coverage. Non-scope: MCP Agentic Human Review execution, raw pixel byte transfer, credential persistence, raw provider response storage, deterministic review mutation, release gate mutation, external repository changes, package publication, or CI-default live provider calls.

Implementation order: synchronize product plan and security boundaries; add provider capability and endpoint hardening; add evidence planner, rubric profile, benchmark registry, calibration, comparison, and privacy audit helpers; wire additive plan/package/result/report-quality fields; add read-only CLI/API/schema/registry entries; extend tests for capability drift, evidence planning, benchmark calibration, payload/privacy audit, and MCP non-exposure; update workflow/security/verification/session memory; then run no-browser and product gates.

Recovery: this slice is additive and local. Existing AHR-01-12/Slice 26-42 artifacts remain readable. Existing review, content UX, visual review, agent execution, MCP profiles, safe HTTP MCP, release readiness, artifact-root policy, alias compatibility, deterministic findings, and release gates remain compatible. Rollback is a standard Git revert of the AHR-13-24 changes; no artifact migration, publication, credential storage, raw response persistence, release gate change, or MCP permission expansion is involved.

### Agentic Human Review Roadmap AHR-01-12: Human-Like Review Schema, Provider Contract, And Quality Enforcement

Purpose: close the practical gap between mechanical UI inspection and human-like review. This slice strengthens Agentic Human Review so TraceCue can preserve deterministic technical findings while also producing advisory review output that reads the page, interprets content, estimates reader feeling, judges trust, compares mechanical findings with human perception, and prioritizes improvements in non-engineer-readable language.

Implemented scope: add Agentic Human Review schema v2 contracts across proposals, plans, packages, rubrics, advisory results, and report-quality output; make first impression, reader emotion, content comprehension, trust and credibility, visual UX, accessibility comprehension, and improvement priority explicit dimensions; add provider instruction and benchmark contracts to plans; add technical evidence and mechanical review summaries to packages; normalize reader-experience and mechanical-versus-human sections in advisory results; add human-review coverage and actionability scoring; validate plan artifacts before provider readiness; validate advisory result and optional execution pairing in report-quality; reject conflicting proposal inputs; sanitize provider payload metadata so plan/execution paths and deterministic review paths are not transferred; and reject credential-bearing non-loopback HTTP API endpoints.

Implementation order: schema constants and contracts, plan/package/rubric enrichment, advisory normalization and Markdown reporting, report-quality scoring, provider-readiness/report-quality validation, parser conflict rejection, provider endpoint and payload hardening, schema registry parity, CLI/API/architecture/packed-install coverage, product/workflow/security/verification document synchronization, then no-browser and product checks.

Recovery: this slice is additive and local. Existing review, content UX, visual review, agent execution, Agentic Human Review Slice 26-42 commands, MCP profiles, safe HTTP MCP, release readiness, artifact-root policy, alias compatibility, and deterministic gates remain compatible. Rollback is a standard Git revert of the AHR-01-12 strengthening changes; no artifact migration, publication, credential storage, raw provider response persistence, deterministic review mutation, release gate change, or MCP permission expansion is involved.

### Agentic Human Review Roadmap Slice 34-42: Conversational Proposal, Provider Readiness, API Provider, And Quality Verification

Purpose: extend Agentic Human Review from a plan/run-only owner layer into a more usable human-equivalent review workflow. The feature lets developers ask for a review in normal language, have TraceCue produce a non-executing proposal, convert that proposal into the existing hash-approved plan/run path, verify provider readiness without calls, run an environment-configured generic API provider only through the approved plan gate, and evaluate advisory report quality.

Implemented scope: add `agentic review propose`, `agentic review plan --proposal`, `agentic review provider-readiness`, generic API provider execution through `agentic review run`, and `agentic review report-quality`; add proposal/provider-readiness/report-quality schemas; isolate provider API I/O in `src/agentic-human-review-providers.js`; record role execution, claims, round records, critique, rebuttal, integration, dogfood metadata, and report-quality metadata in advisory output; keep proposal/readiness/report-quality outside execution authority; and keep all Agentic Human Review operations excluded from MCP profiles. Non-scope: MCP agentic review execution, browser or OS capture expansion, raw provider response storage, credential persistence, deterministic review mutation, release gate mutation, package publication, parent-repository changes, consumer-repository changes, or automatic approval of provider execution.

Implementation order: add provider adapter isolation, proposal artifacts and proposal hash validation, proposal-to-plan defaults, provider readiness, generic API provider execution behind existing plan-hash and exact-transfer-flag gates, report-quality calculation, parser/CLI/API/schema/operation/MCP capability updates, no-browser CLI/API/architecture/security tests, packed-install coverage, product structure/security gates, and product/workflow document synchronization.

Recovery: this slice is additive and local. Existing review, agent advisory, agent execution, visual review, capture, language, release, artifact-root, alias, shell, MCP profile, safe HTTP, and Slice 26-33 Agentic Human Review behavior remain compatible. Rollback is a standard Git revert of the Slice 34-42 changes; no artifact migration, deletion, publication, credential storage, raw provider response persistence, remote mutation, or MCP permission expansion is involved.

### Agentic Human Review Roadmap Slice 26-33: Human-Like Visual, UX, Content, And Subjective Review

Purpose: implement the requested Slice 26-33 continuation as a dedicated owner-layer Agentic Human Review feature. The feature lets TraceCue use AI-agent judgment for human-like visual perception, UI/UX review, screen-text comprehension, copy/content critique, subjective audience reaction, trust/risk assessment, and improvement advice from existing local review artifact indexes.

Proposal scope: add `agentic review plan`, `agentic review run`, `agentic review status`, and `agentic review list`; define quick/standard/deep/xhigh review effort orchestration; create local agentic review packages, plan receipts, approval receipts, run receipts, advisory results, and Markdown reports; register schemas; report operation/capability boundaries; block generic `agent execution` from running agentic review packages; and prove MCP profiles expose no Agentic Human Review tools. Non-scope: browser capture, OS capture, raw-pixel transfer without exact plan-approved flags, MCP execution, SaaS web UI automation, generic shell execution, credential persistence, raw provider response storage, deterministic review mutation, release gate mutation, parent-repository changes, consumer-repository changes, package publication, or marketplace registration.

Implementation order: add `src/agentic-human-review.js`, artifact directory support, parser/CLI/API exports, schema files and schema registry entries, operation registry/capability exclusions, MCP capability non-exposure flags, generic agent execution bypass guards, CLI/API/schema/MCP/architecture/packed-install/security tests, product structure/security gates, and product/workflow document and manifest synchronization. Execution must validate stored plan hash, supplied plan hash, exact command preview, provider/model/surface match, explicit `--execute`, and exact transfer flags before writing advisory-only output.

Recovery: this slice is additive and local. Existing review, agent advisory, agent execution, visual review, capture, language, release, artifact-root, alias, shell, MCP profile, and safe HTTP behaviors remain unchanged. Rollback is a standard Git revert of the Agentic Human Review slice; no artifact migration, deletion, publication, remote mutation, credential storage, raw provider response persistence, or MCP permission expansion is involved.

### Phase 60: Operation Registry and Roadmap Risk Taxonomy Foundation

Purpose: promote the draft roadmap groups 1-8 into a safe read-only operation governance foundation before any risky execution expansion. This phase records the xhigh pre-implementation review conclusion: the product needs a shared operation registry, risk taxonomy, and gate source of truth before provider MCP execution, cleanup execution, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, constrained shell, or final release hardening are implemented.

Proposal scope: centralize risky operation metadata across operation governance, provider MCP, cleanup MCP, capture, localization/translation, release identity, constrained shell, and final hardening. Expose the registry through CLI/API/MCP-safe inspection, keep capability and execution-gate reports aligned with the registry, and prove the new surface is read-only. Non-scope: execution tokens, MCP admin execution, provider/API execution through MCP, cleanup deletion through MCP, OS capture, translation provider calls, npm publish, artifact-root migration, legacy alias removal, shell execution, remote sync, CI triggering, marketplace mutation, or any existing-feature tradeoff.

Implementation order: add `src/operation-registry.js` and `schemas/operation-registry.schema.json`, derive MCP capability exclusions and MCP execution-gate operation entries from the registry, wire `operation registry --json`, expose package API helpers, add safe MCP inspection as `browser_debug_operation_registry`, synchronize product/security/verification/package manifests, fix schema parity drift discovered during xhigh review, update release/repository-index notes, then run no-browser, package, structure, document, security, release, and product checks.

Recovery: this phase is additive and read-only. Existing browser review, image review, target review, visual review, language settings, resource cleanup CLI behavior, provider adapters, MCP profile permissions, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the Phase 60 slice; no artifact migration, deletion, publication, provider dispatch, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Phase 60.1: Operation Roadmap Boundary Contracts

Purpose: satisfy the requested Phase 60-155 continuation as a safe local governance implementation, not as approval to run side-effectful operations or promote the remaining draft roadmap into formal product-plan entries. This phase adds a machine-readable `operation roadmap` report that records each draft phase's A proposal, B implementation-plan, and C local boundary implementation contract.

Proposal scope: expose phase, group, risk, sequence, proposal, plan, implementation status, related registry operations, and fail-closed approval status through CLI/API/MCP-safe inspection. Non-scope: execution tokens, execution harness enablement, provider/API execution through MCP, cleanup deletion through MCP, OS capture, translation provider calls, package publication, artifact-root migration, legacy alias removal, shell execution, remote CI triggering, parent-repository changes, consumer-repository changes, or treating Phase 61-155 as release commitments.

Implementation order: add `src/operation-roadmap.js` and `schemas/operation-roadmap.schema.json`, wire `operation roadmap --json`, expose package API helpers, add safe MCP inspection as `browser_debug_operation_roadmap`, reject unsupported execution options, add schema/API/MCP/package/architecture tests, synchronize security/verification/manifests, then run no-browser and product checks.

Recovery: this phase is additive and read-only. Existing review flows, operation registry output, language settings, visual review, resource cleanup behavior, provider adapters, MCP profile permissions, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the roadmap contract slice; no artifact migration, deletion, publication, provider dispatch, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Phase 61-64: Operation Contract Foundation

Purpose: implement Slice 1 as the shared local contract foundation for operation risk taxonomy, gate schema, execute-token shape, and receipt shape before any family-specific execution path is expanded. This phase keeps the Phase 61-155 roadmap boundary intact: only Phase 61-64 contract inspection is promoted, and later roadmap entries remain draft memory until their own approved slice.

Proposal scope: add a read-only `operation contracts` report that derives selected operation context from the operation registry, records the Phase 61-64 contract set, exposes risk/gate/token/receipt contract shapes through CLI/API/MCP-safe inspection, and proves token issuance, receipt writing, harness enablement, live execution, artifact writes, and MCP write/execute exposure remain disabled. Non-scope: admin policy file changes, CLI execution harnesses, MCP admin token flows, provider/API execution through MCP, cleanup deletion through MCP, OS capture, translation provider calls, package publication, artifact-root migration, legacy alias removal, shell execution, remote sync, CI triggering, marketplace mutation, or any existing-feature tradeoff.

Implementation order: add `src/operation-contracts.js` and `schemas/operation-contracts.schema.json`, wire `operation contracts --json`, expose package API helpers, add safe MCP inspection as `browser_debug_operation_contracts`, reject unsupported execution options, add schema/API/MCP/package/architecture tests, synchronize product/security/verification/package manifests, then run no-browser and product checks.

Recovery: this phase is additive and read-only. Existing review flows, operation registry and roadmap output, language settings, visual review, resource cleanup behavior, provider adapters, MCP profile permissions, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the contract foundation slice; no token issuance, receipt writing, artifact migration, deletion, publication, provider dispatch, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Phase 65-68: Operation Policy and Readiness Foundation

Purpose: implement Slice 2 as the local policy/readiness foundation for admin policy defaults, CLI operation plan inspection, disabled harness readiness, and safe MCP readiness before MCP admin token flow or any operation-specific side effect exists. This phase keeps Phase 69-155 as draft memory only.

Proposal scope: add repository-local admin policy config, a read-only `operation policy` report, CLI/API/MCP-safe inspection, selected registry operation context, contract references, policy/readiness schema coverage, and fail-closed unsupported execution options. Non-scope: changing policy config from the CLI, token issuance, receipt writing, enabling a harness, MCP admin token flow, provider/API execution through MCP, cleanup deletion through MCP, OS capture, translation provider calls, package publication, artifact-root migration, legacy alias removal, shell execution, remote sync, CI triggering, marketplace mutation, or any existing-feature tradeoff.

Implementation order: add `ops/OPERATION_POLICY.json`, `src/operation-policy.js`, and `schemas/operation-policy.schema.json`, wire `operation policy --json`, expose package API helpers, add safe MCP inspection as `browser_debug_operation_policy`, reject unsupported execution options, add schema/API/MCP/package/architecture tests, synchronize product/security/verification/package manifests, then run no-browser and product checks.

Recovery: this phase is additive and read-only. Existing review flows, operation registry/roadmap/contracts output, language settings, visual review, resource cleanup behavior, provider adapters, MCP profile permissions, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the policy/readiness slice; no token issuance, receipt writing, artifact migration, deletion, publication, provider dispatch, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Phase 69-70: Operation Admin Readiness Foundation

Purpose: implement Slice 3 as a read-only MCP admin readiness foundation for the future execute-token flow and MCP-to-harness bridge while keeping live token issuance, token storage, admin MCP execution, harness dispatch, and operation side effects approval-bound. This phase keeps Phase 71-155 as draft memory only.

Proposal scope: add a read-only `operation admin-readiness` report that derives selected operation context and admin policy requirements from the prior operation policy foundation, records Phase 69-70 readiness checks, exposes MCP admin token-flow and harness bridge prerequisites through CLI/API/MCP-safe inspection, and proves token issuance, token storage, harness enablement, live execution, artifact writes, and MCP write/execute exposure remain disabled. Non-scope: issuing execute tokens, storing tokens, changing policy config, writing receipts, enabling a harness, exposing MCP admin execution tools, provider/API execution through MCP, cleanup deletion through MCP, OS capture, translation provider calls, package publication, artifact-root migration, legacy alias removal, shell execution, remote sync, CI triggering, marketplace mutation, or any existing-feature tradeoff.

Implementation order: add `src/operation-admin-readiness.js` and `schemas/operation-admin-readiness.schema.json`, wire `operation admin-readiness --json`, expose package API helpers, add safe MCP inspection as `browser_debug_operation_admin_readiness`, reject unsupported execution options, add schema/API/MCP/package/architecture tests, synchronize product/security/verification/package manifests, then run no-browser and product checks.

Recovery: this phase is additive and read-only. Existing review flows, operation registry/roadmap/contracts/policy output, language settings, visual review, resource cleanup behavior, provider adapters, MCP profile permissions, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the admin-readiness slice; no token issuance, token storage, harness dispatch, artifact migration, deletion, publication, provider dispatch, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Phase 71-73: Operation Provider Readiness Foundation

Purpose: implement Slice 4 as a read-only provider readiness foundation for provider MCP planning, bounded disclosure contracts, and env credential guard names before provider/API execution through MCP exists. This phase keeps Phase 74-155 as draft memory only.

Proposal scope: add a read-only `operation provider-readiness` report that derives selected operation context from the prior admin-readiness foundation, records Phase 71-73 readiness checks, exposes provider catalog metadata, disclosure defaults, and credential environment variable names through CLI/API/MCP-safe inspection, and proves provider calls, credential value reads, external evidence transfer, live execution, artifact writes, and MCP write/execute exposure remain disabled. Non-scope: provider/API execution through MCP, local runner execution through MCP, issuing execute tokens, storing tokens, changing policy config, writing receipts, enabling a harness, exposing MCP admin execution tools, reading credential values, transferring evidence, raw artifact transfer, cleanup deletion through MCP, OS capture, translation provider calls, package publication, artifact-root migration, legacy alias removal, shell execution, remote sync, CI triggering, marketplace mutation, or any existing-feature tradeoff.

Implementation order: add `src/operation-provider-readiness.js` and `schemas/operation-provider-readiness.schema.json`, wire `operation provider-readiness --json`, expose package API helpers, add safe MCP inspection as `browser_debug_operation_provider_readiness`, reject unsupported execution/provider options, add schema/API/MCP/package/architecture tests including credential sentinel non-disclosure, synchronize product/security/verification/package manifests, then run no-browser and product checks.

Recovery: this phase is additive and read-only. Existing review flows, operation registry/roadmap/contracts/policy/admin-readiness output, language settings, visual review, resource cleanup behavior, provider adapters, MCP profile permissions, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the provider-readiness slice; no provider call, credential read, external transfer, token issuance, token storage, harness dispatch, artifact migration, deletion, publication, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Slice 5 / Phase 74-78: Provider MCP Execution And Status/List Hardening

Purpose: implement the approved Slice 5 provider MCP execution and status/list hardening path. Phase 74-76 exposes the existing Phase 29 agent execution plan/run flow through stdio MCP `admin` only for deterministic fake providers, configured local runner callbacks, and env-only generic API providers. Phase 77-78 preserves safe MCP status/list inspection and synchronizes docs, security, and verification.

Proposal scope: add admin-only MCP tools for `agent execution plan` and `agent execution run --execute`, require an idempotency key and explicit `execute: true`, reject unknown MCP arguments, preserve env-only credentials, reuse plan-match validation and local receipts, add realpath confinement for package/execution/prompt reads, extend `operation provider-readiness` with fake/local/API execution readiness plus safe MCP status/list contracts, add semantic MCP tool purpose tags, canonicalize operation capability-id aliases to registry operation ids, and prove safe/full/HTTP profiles remain non-execution surfaces. Non-scope: execute tokens, token storage, generic execution harness dispatch, cleanup execution through MCP, capture execution, translation execution, package publication, artifact-root migration, legacy alias removal, shell execution, HTTP `full` or `admin`, remote listeners, parent-repository changes, consumer-repository changes, or additional MCP write/execute expansion.

Implementation order: split admin MCP tools from full profile tools, add argument validation and idempotency mapping, reuse existing CLI/core execution runners, update MCP capability/gate/operation readiness reports, harden workspace realpath checks, extend CLI/API/MCP/package/architecture tests for fake/local/API execution and secret non-disclosure, synchronize product/security/verification/package manifests, then run no-browser and product checks.

Recovery: this slice is additive and constrained to admin MCP agent execution. Existing review flows, cleanup behavior, capture behavior, visual review execution, translation behavior, safe/full MCP profiles, safe HTTP transport, identity aliases, artifact roots, package privacy, release gates, and consumer workflows remain unchanged. Rollback is a standard Git revert of the Slice 5 changes; no token issuance, token storage, generic harness dispatch, artifact migration, deletion, publication, capture, alias removal, shell execution, remote mutation, or CI triggering is involved.

### Phase 59: Local Language Settings Foundation

Purpose: add TraceCue-local language settings that separate dashboard display locale from artifact output language. This phase follows the multi-agent pre-implementation review and implementation plan for a local, read-only foundation: 14-locale support, alias normalization, source/UI/explicit output modes, translation-mode policy, CLI/API/MCP inspection, schema parity, review/dashboard metadata, and document sync without touching the parent lesson repository or consumer repositories.

Implementation order: add locale policy and language settings helpers, add `ops/DASHBOARD_SETTINGS.json` and `schemas/language-settings.schema.json`, wire `settings show`, `settings language`, and `settings language policy`, expose package API helpers, add a safe read-only MCP inspection tool, attach bounded `language_settings` metadata to review and visual review dashboard outputs, update package/scaffold/security/test manifests, synchronize requirements, specification, implementation plan, security, verification, README, changelog, task tracker, handoff, and AGENTS state, then run no-browser, package, release, product, and documentation scans.

Recovery: language settings are additive and read-only. Existing browser review, image review, target review, visual review, MCP profiles, identity aliases, artifact roots, agent execution, cleanup, provider behavior, release gates, and consumer workflows remain unchanged. If rollback is required, revert the Phase 59 slice; no artifact migration, repository rename, npm publication, marketplace mutation, provider execution, translation execution, or external repository mutation is involved.

### Phase 58: Remote Repository Rename Completion

Purpose: complete the GitHub repository rename to `xxxMasahiro/trace-cue` after the local checkout rename is stable. This phase updates local `origin`, product identity metadata, plugin metadata, docs, and tests so the canonical repository URL is current while the legacy GitHub URL remains recorded as compatibility history.

Implementation order: verify the legacy GitHub repository exists and the target repository name is unused, rename the remote repository with `gh repo rename`, update local `origin`, update `src/product-identity.js`, plugin metadata, README, workflow docs, release docs, memory, tests, and manifests, then rerun identity audit, rename-readiness, no-browser tests, package checks, release checks, product gates, Japanese-doc scan, and fixed-path scans.

Recovery: GitHub repository rename is remote state. GitHub normally redirects the legacy URL, but local callers should update their remotes to the canonical URL. This phase changes no package name, CLI alias, MCP alias, artifact root, npm publication state, marketplace state, license, MCP permissions, provider behavior, or external transfer policy.

### Phase 57: Physical Checkout Rename Completion

Purpose: complete the local workspace directory rename from the legacy checkout name to `trace-cue` after Phase 56 made the operation auditable. This phase keeps Git history, package names, CLI aliases, MCP aliases, artifact roots, and remotes unchanged while proving the moved checkout still passes identity and release checks.

Implementation order: run `identity audit --json` and `npm run test:rename-readiness` in the legacy checkout, move the repository directory to the canonical checkout name, rerun `pwd`, `git rev-parse --show-toplevel`, `identity audit --json`, rename-readiness, no-browser tests, package checks, release checks, product gates, docs scans, and fixed-path scans, then synchronize workflow state.

Recovery: the physical checkout rename is a local filesystem move only. If a caller still references the old path, update that caller-owned configuration or move the directory back. No Git commit, remote URL, package identity, artifact root, legacy alias, npm state, marketplace state, or license state is changed by the filesystem move itself.

### Phase 56: Rename Readiness Audit

Purpose: make physical checkout rename and later remote repository rename auditable before performing either rename. This phase adds read-only identity audit output, canonical/legacy repository URL separation, packaged MCP legacy server compatibility, filesystem-safe package temp names, packed legacy bin smoke coverage, and a local rename-readiness check.

Implementation order: add `identity audit --json`, `identity_audit` schema/API support, canonical/legacy repository identity fields, `.mcp.json` canonical plus legacy server entries, MCP identity text cleanup, rename-readiness tooling, CI/release/product-gate wiring, package smoke coverage for canonical and legacy bins, docs/manifests sync, then run no-browser, rename-readiness, package, release, and product gates.

Recovery: the audit is read-only and additive. Existing CLI, MCP tools, artifact roots, review flows, visual review flows, package privacy, release state, and legacy aliases remain unchanged; rollback is a standard Git revert of the Phase 56 slice.

### Phase 55: Multi-Agent Visual Review Aggregation Hardening

Purpose: harden local visual review aggregation before any MCP exposure. This phase keeps aggregation read-only while bounding result scans, malformed artifacts, oversized files, untrusted advisory text, source attribution, source-effect reporting, conflict reporting, and MCP non-exposure.

Implementation order: add architecture and CLI coverage for malformed local result artifacts, limit-bound scans, source-attributed findings, severity conflicts, no raw-pixel reads, no provider calls, no writes, no MCP tools, package API exports, schema parity, docs, manifests, and product gates.

Recovery: aggregation is read-only and additive. Existing review, preparation, execution, dashboard, MCP, and release behavior remain unchanged; rollback is a standard Git revert of the aggregation slice.

### Phase 54: MCP Visual Review Execution Exposure Reporting

Purpose: keep visual provider execution and aggregation out of MCP while making the boundary inspectable. This phase adds policy visibility for visual review aggregation and desktop image review handoff paths without adding MCP tools.

Implementation order: update `mcp capabilities` excluded operations and `mcp execution gates` with `visual_review_aggregation`, keep safe/full/admin tool lists unchanged, add no-browser and packed-install assertions, then run product checks.

Recovery: policy reporting is read-only and additive. Existing MCP profiles and transports remain unchanged.

### Phase 53: Multi-Agent Visual Review Aggregation

Purpose: let users combine multiple existing local visual review results for one preparation into deterministic advisory groups, conflicts, and owner decision requests without running providers or changing gates.

Implementation order: add `src/visual-review-aggregation.js`, wire `visual review aggregate --preparation <workspace-json> --json`, register `visual_review_aggregation`, export package API helpers, keep MCP tool exposure disabled, add CLI/API/schema/architecture/packed-install coverage, synchronize docs and manifests, then run package, release, browser smoke, and product gates.

Recovery: aggregation writes no artifacts and mutates no reviews. Existing visual review preparation/execution/dashboard artifacts remain valid.

### Phase 52: Desktop Review Provider Safety Bridge

Purpose: connect caller-declared capture handoff metadata to standalone image review and future visual review preparation without provider calls, raw-pixel transfer, OS capture, or MCP execution.

Implementation order: reuse capture handoff contract normalization, allow `review --image --capture-handoff <workspace-json|->`, verify source path and media hash, propagate source kind into visual evidence metadata and preparation references, keep direct image review compatibility, update bin stdin handling for `--capture-handoff -`, then test parser, CLI, API, schemas, and package smoke.

Recovery: the bridge is additive. Default `review --image <workspace-file>` remains `image_file`; handoff-specific provenance appears only when explicitly provided.

### Phase 51: Desktop Image Review Body

Purpose: make existing screenshots of screens, windows, and desktop app surfaces reviewable through the same image review, visual evidence, and visual preparation contracts used for browser screenshots and image files.

Implementation order: extend image review source metadata, validate capture handoff path/hash consistency, store caller-declared provenance without claiming TraceCue captured or verified OS surfaces, preserve no-provider/no-transfer/no-MCP boundaries, update tests/docs/manifests, then run product checks.

Recovery: standalone image review, URL review, target review, capture plan, capture handoff, visual preparation, visual execution, dashboard, MCP profiles, and release gates remain unchanged; rollback is a standard Git revert of Phase 51-52 additions.

### Phase 50: Desktop Review Provider-Preparation Planning

Purpose: let existing capture handoff metadata for screen, window, and desktop app images be reviewed before provider preparation artifacts or provider execution are created. This phase adds a read-only provider-preparation planning report from `capture handoff` JSON. It does not reread image bytes, call providers, write artifacts, expose MCP tools, execute capture, transfer evidence, or mutate existing reviews.

Implementation order: add a pure desktop review provider-preparation planning module, wire `visual review plan --capture-handoff <workspace-json|-> --json`, register the `desktop_review_provider_preparation_plan` schema, expose package API helpers, keep MCP tool exposure disabled while listing the operation in capability/gate policy reports, add no-browser/architecture/schema/packed-install coverage, synchronize docs and manifests, then run package, release, browser smoke, and product gates.

Recovery: the desktop provider-preparation plan is read-only and additive. Existing browser review, image review, capture handoff, capture plan, visual evidence, visual review preparation/execution/dashboard, MCP execution gates, schemas, and release gates remain unchanged; rollback is a standard Git revert of the Phase 50 slice.

### Phase 49: Existing Workspace Image Capture Metadata Handoff

Purpose: let existing workspace image files be represented as screen, window, or desktop app capture metadata without implementing OS capture. This phase adds a CLI/API/schema handoff for existing workspace image files only. It does not call OS capture APIs, enumerate windows or processes, write artifacts, expose MCP tools, call providers, transfer evidence, or embed raw pixels in JSON.

Implementation order: add a workspace-confined capture handoff module, wire `capture handoff --image <workspace-image> --source <screen|window|desktop-app> --json`, register the `capture_handoff` schema, expose package API helpers, keep MCP tool exposure disabled, add no-browser/architecture/schema/packed-install coverage, synchronize docs and manifests, then run package, release, browser smoke, and product gates.

Recovery: the existing-image handoff is CLI/API/schema-only and additive. Existing browser review, image review, capture plan, visual evidence, visual review preparation/execution/dashboard, MCP execution gates, schemas, and release gates remain unchanged; rollback is a standard Git revert of the Phase 49 slice.

### Phase 48: Screen and Window Capture Planning

Purpose: make screen, window, and desktop app capture reviewable before implementing OS capture execution. This phase adds a read-only capture planning report for screen, window, and desktop app evidence sources. It does not capture pixels, launch OS capture tools, enumerate processes, write artifacts, call providers, transfer evidence, expose capture execution through MCP, or change browser/image review behavior.

Implementation order: add a pure capture planning module, wire `capture plan --json`, register the `capture_plan` schema, expose package API helpers, expose a safe read-only MCP planning tool, keep capture execution excluded, add no-browser/architecture/schema/packed-install coverage, synchronize docs and manifests, then run package, release, browser smoke, and product gates.

Recovery: the plan report is read-only and additive. Existing browser review, image review, visual evidence, visual review preparation/execution/dashboard, MCP execution gates, schemas, and release gates remain unchanged; rollback is a standard Git revert of the Phase 48 slice.

### Phase 47: MCP Execution Gate Policy

Purpose: make future MCP write/execute expansion reviewable before it is implemented. This phase adds a read-only machine-readable gate report for visual review preparation, visual review execution, agent execution planning/run, and artifact cleanup execution. It does not expose any MCP write, delete, provider, credential, shell, daemon/session, or raw-pixel transfer tool.

Implementation order: add a pure MCP execution-gate policy module, wire `mcp execution gates --json`, register the `mcp_execution_gates` schema, expose package API helpers, expose a safe read-only MCP tool, keep all write/execute operations excluded, add no-browser/architecture/schema/packed-install coverage, synchronize docs and manifests, then run package, release, browser smoke, and product gates.

Recovery: the gate report is read-only and additive. Existing MCP profiles, safe HTTP transport, visual review dashboard, visual review execution, agent execution, cleanup, schemas, and release gates remain unchanged; rollback is a standard Git revert of the Phase 47 slice.

### Phase 46: Visual Review Dashboard Integration

Purpose: give control centers, humans, CLI users, and safe MCP clients a read-only dashboard view over local visual review preparation, execution, and result artifacts. The dashboard must not create artifacts, execute providers, read raw pixels, mutate existing reviews, or affect release gates.

Implementation order: add a no-write dashboard module, wire `visual review dashboard --json`, expose package API helpers, register the `visual_review_dashboard` schema, expose the safe MCP read-only tool, keep preparation/run/provider execution excluded from MCP, add CLI/API/MCP/schema/architecture/packed-install coverage, synchronize docs and manifests, then run no-browser, browser, package, release, and product gates.

Recovery: dashboard integration is additive and read-only. Existing URL review, target review, image review, visual review preparation/execution, agent execution, MCP profiles, artifact cleanup, and release gates remain unchanged; rollback is a standard Git revert of the dashboard slice.

### Phase 44: Local Visual Review Result Preparation

Purpose: prepare local, metadata-only visual review result contracts from existing review artifact indexes so future AI-assisted visual review can consume normalized evidence references without running providers, reading raw pixels, transferring evidence, exposing MCP execution, or changing deterministic review output.

Implementation order: add a no-browser preparation module, wire `visual review prepare --review-index <path>`, register `visual_review_result_preparation` and future `visual_review_result` schemas, export package API helpers, keep review-index and visual-evidence metadata reads workspace-confined and size-limited, keep MCP profiles unchanged while capability policy lists the operation as excluded, add no-browser architecture/CLI/schema tests and packed-install coverage, synchronize docs, then run package, release, and product gates.

Recovery: visual review result preparation is additive. Existing URL review, target review, standalone image review, agent package, agent execution run, MCP profiles, and review artifacts remain unchanged; rollback is a standard Git revert of the preparation slice.

### Phase 43: Standalone Image Review

Purpose: let users review an existing screenshot, generated mock image, or other workspace image file without launching a browser. This phase reuses the visual evidence core, writes metadata-only `image_review`, `review_artifact_index`, and `visual_evidence` artifacts, and keeps provider execution, raw pixel transfer, external upload, and MCP execution expansion out of scope.

Implementation order: add a no-browser image review module, wire `review --image <path>`, add schema/API exports, keep inputs workspace-confined and size-limited through the visual evidence core, add no-browser architecture/schema/CLI tests, add packed-install coverage, synchronize docs, then run browser smoke only to confirm existing browser review remains intact.

Recovery: standalone image review is additive. Existing URL review, target review, screenshot artifacts, agent workflows, and MCP profiles remain unchanged.

### Phase 42: Visual Review Provider Policy Planning

Purpose: add a planning-only disclosure policy for future AI-assisted visual review without creating a provider execution path, raw image transfer path, MCP execution tool, or deterministic review gate change. The policy is written into existing `agent execution plan` records so dashboards and agents can inspect visual-evidence disclosure readiness before any explicit execution phase is approved.

Implementation order: add a pure policy builder, register the machine-readable schema, export package API helpers, wire the policy into dry-run execution plans only, keep provider calls inside the existing provider adapter boundary, keep MCP execution excluded, update tests and packaged smoke checks, then run no-browser, browser, package, release, and product gates.

Recovery: because this is metadata-only and additive, rollback is a standard Git revert of the planning slice without artifact cleanup.

### Phase 41: Visual Evidence Metadata Core

Purpose: make screenshots, standalone image files, mock images, screen captures, window captures, and desktop app captures share one local visual evidence metadata contract. The contract records dimensions, format, byte size, hashes, labels, privacy flags, and artifact references while keeping raw pixels in local artifacts only.

Implementation order: add a reusable visual evidence module, schema, artifact directory, API exports, browser screenshot wiring, sensitive artifact package handling, and focused no-browser/browser/pack tests.

Recovery: existing screenshot artifacts remain unchanged, and visual evidence records are additive metadata under the ignored artifact root.

### Phase 40: TraceCue Identity Migration

Purpose: rename the canonical product identity from Browser Debug CLI to TraceCue without breaking existing local users. This phase changes package, bin, MCP server, plugin, product profile, consumer guidance, and release metadata through `src/product-identity.js`. It keeps `browser-debug`, `browser-debug-mcp`, existing `browser_debug_*` MCP tool names, and the current `.browser-debug/` artifact root as compatibility surfaces until a separate removal or artifact-root migration is approved.

Proposal summary from xhigh review: do not perform a scattered bulk rename; make identity canonical-plus-alias, keep legacy command/env/artifact compatibility, avoid MCP permission expansion, and require package/plugin/MCP/API identity tests plus packed-install verification.

Implementation order: update identity metadata, add canonical bin shims, update package/plugin/MCP manifests and product ops manifests, synchronize current docs, test legacy aliases, update security checks, then run `npm test`, package checks, product gate, and `git diff --check`.

Recovery: because legacy bins and artifact root remain, rollback is a standard Git revert of the identity slice without artifact cleanup.

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

- Confirm public OSS repository name and owner. Completed with the original repository and later renamed to `xxxMasahiro/trace-cue`.
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
- Completed: kept local dry-run package verification through `npm run test:pack` and added packed install smoke coverage through `npm run test:pack-install` without npm publication.
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

### Phase 26: Local Agent Request Status

Phase 26 adds a local read-only status index for agent advisory handoff automation. It preserves the Phase 25 package/ingest/report behavior and remains provider-neutral, local-first, advisory-only, and additive. It does not add direct provider API calls, automatic upload, credential storage, MCP agent execution, external listeners, browser launch, review artifact mutation, or changes to deterministic review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

- Completed: `agent requests list --json` reports local advisory packages as `waiting_for_agent` or `advisory_imported` by reading `.browser-debug/agent-packages/` and `.browser-debug/agent-results/` metadata.
- Completed: `agent requests list --package <path> --json` narrows status to one workspace-relative package path using the existing local path boundary.
- Completed: request status output includes package, prompt, receipt, source review index, surface, imported result paths, advisory counts, next-step text, and explicit boundary flags.
- Completed: machine-readable schema coverage includes `agent_request_status`, and package API exports `runAgentRequestsList`.
- Completed: no-browser tests cover pending/imported status transitions, schema parity, unchanged gate semantics, no provider API calls, no automatic upload, and no review artifact mutation.

### Phase 27: Local Agent Request Detail

Phase 27 adds a read-only detail command for one local agent advisory handoff package. It builds on the Phase 26 request-status index and preserves existing package, ingest, report, resource guard, daemon lifecycle, and artifact cleanup behavior. It remains provider-neutral, local-first, advisory-only, and additive. It does not add direct provider API calls, automatic upload, credential storage, MCP agent execution, external listeners, browser launch, review artifact mutation, artifact writing, or changes to deterministic review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

- Completed: `agent requests show --package <path> --json` returns package metadata, disclosure policy, source review index metadata, local artifact-reference summaries, selected/latest result paths, bounded advisory result summary, dashboard handoff hints, and explicit boundary flags.
- Completed: `agent requests show --package <path> --agent-result <path> --json` selects a matching workspace-relative imported result and rejects mismatched result/package pairs.
- Completed: machine-readable schema coverage includes `agent_request_detail`, and package API exports `runAgentRequestsShow`.
- Completed: no-browser tests cover pending/imported detail output, schema parity, unchanged gate semantics, no artifact writes, no provider API calls, no automatic upload, and no review artifact mutation.

### Phase 28: Local Agent Workflow Status

Phase 28 adds a local workflow manifest and read-only workflow status/index layer for dashboard and local automation handoff. It builds on the Phase 25-27 agent package, request status, request detail, ingest, and report contracts. It remains provider-neutral, local-first, advisory-only, and additive. It does not add direct provider API calls, automatic upload, credential storage, MCP agent execution, external listeners, browser launch, review artifact mutation, external evidence transfer, or changes to deterministic review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`.

- Completed: `agent workflow create --package <path> --json` writes a local `.browser-debug/agent-workflows/<id>/workflow.json` manifest and workflow receipt from an existing agent package.
- Completed: workflow manifests include package, prompt, request status/detail, dashboard handoff commands, step state, report-pending state, and explicit provider-boundary flags.
- Completed: `agent workflow status --workflow <path> --json` recomputes current workflow state from local package/result metadata and reports `waiting_for_agent`, `advisory_imported`, or `package_missing` without writing artifacts.
- Completed: `agent workflow index --json` aggregates local workflow manifests for dashboards and local automation, including waiting/imported/package-missing/report-pending counts and unchanged local boundary flags.
- Completed: `agent workflow report --workflow <path> --json` writes a bounded local Markdown workflow status summary without mutating review artifacts.
- Completed: machine-readable schema coverage includes `agent_workflow`, and package API exports `runAgentWorkflowCreate`, `runAgentWorkflowStatus`, `runAgentWorkflowIndex`, and `runAgentWorkflowReport`.
- Completed: no-browser tests cover workflow creation, post-ingest status recomputation, index aggregation, workflow report output, schema parity, unchanged gate semantics, no provider API calls, no automatic upload, and no review artifact mutation.
- Completed at the Phase 28 approval boundary: direct API/provider execution was represented only as disabled provider-boundary metadata. Phase 29 later added the dedicated bounded execution adapter described below.

### Phase 29: Agent Execution Integration

Phase 29 adds an explicit agent execution planning and execution layer above the existing local agent package, workflow, ingest, and report contract. It preserves every existing command and deterministic review output. It supports subscription-style local agents and API-style provider execution through the same local package/workflow/status/ingest/report user experience, while keeping raw review artifacts local by default and keeping provider output advisory-only.

The layer is additive. It must not change existing `agent_workflow` status meanings, review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, resource guard semantics, daemon behavior, artifact cleanup behavior, target manifest behavior, MCP cleanup boundaries, or MCP review/observe/schema behavior.

#### Phase 29a: Document, Security, and Schema Planning

- Completed: synchronized requirements, specification, implementation plan, security, verification, task tracker, handoff, README, and changelog for the first runtime slice.
- Completed: defined the `agent_execution` schema as a new contract instead of overloading `agent_workflow`.
- Completed: recorded the hard boundary fields: `api_call_performed`, `external_evidence_transfer`, `automatic_upload`, `credential_values_recorded`, `credential_storage`, `persistent_credential_storage`, `raw_response_stored`, `raw_provider_response_stored`, `existing_review_mutated`, `mcp_execution_exposed`, and `gate_effect`.
- Completed: preserved the existing `agent_workflow` schema as workflow status and dashboard handoff state only.

#### Phase 29b: Parser and Public API Surface

- Completed: added `agent execution plan --package <path> --surface <id> --json` for dry-run execution planning.
- Completed: added `agent execution run --execution <path> --package <path> --surface <id> --provider <id> --model <id> --execute --json` as an explicit execution surface that requires a prior dry-run plan and validates package/surface/provider/model consistency.
- Completed: added `agent execution status --execution <path> --json` and `agent execution list --json` for local dashboard and automation status.
- Completed: exported the same core functions from the package API without changing existing exports or command behavior.

#### Phase 29c: Core Execution Boundary Modules

- Completed: added `src/agent-execution.js` for dry-run plan, explicit run, status, list, result paths, and receipts.
- Completed: added `src/agent-execution-providers.js` for the provider registry, fake provider, local runner callback adapter, and env-only API adapter.
- Completed: kept provider calls out of `agent.js`, `review.js`, `mcp.js`, resource helpers, and Playwright runtime modules; architecture tests enforce this boundary.
- Completed: kept execution output separate from review artifacts and normalized provider responses into the existing `agent_advisory_result` shape.

#### Phase 29d: Dry-Run Execution Plan

- Completed: made `agent execution plan` the default, no-network operation for both subscription and API surfaces.
- Completed: included package metadata, prompt metadata, disclosure policy, provider/surface selection, artifact transfer policy, and exact next command hints; credential requirement naming remains for the provider adapter slice.
- Completed: wrote only local execution-plan metadata and receipts under `.browser-debug/`.
- Completed: set direct CLI dry-run boundary fields to `api_call_performed=false`, `external_evidence_transfer=false`, `automatic_upload=false`, `credential_values_recorded=false`, `raw_response_stored=false`, `raw_provider_response_stored=false`, `existing_review_mutated=false`, and `mcp_execution_exposed=false`. Phase 74-76 later records `mcp_execution_exposed=true` only for stdio admin MCP-created plans/runs.

#### Phase 29e: Provider Runner Abstraction and Fake Provider

- Completed: implemented provider-independent adapter interfaces before real provider execution.
- Completed: added deterministic `fake-agent` provider for no-browser tests, dashboard contract tests, failure path tests, and advisory-result normalization tests.
- Completed: proved provider output is advisory-only and cannot change deterministic review findings, metrics, existing action plans, or release readiness.
- Completed: reject unknown providers, unknown models, unsupported surfaces, missing packages, missing execution plans, and plan mismatches deterministically.

#### Phase 29f: Local Subscription-Agent Runner

- Completed: support subscription-style local agents through configured local runner callbacks, not through SaaS web UI automation.
- Completed: require a configured local runner identifier and avoid free-form shell input or arbitrary shell execution.
- Completed: keep prompts and packages in local files, keep raw browser artifacts local by default, and normalize returned advisory JSON through the same advisory-result contract.
- Completed: record execution receipts with runner identity, prompt/package paths, result path, and boundary fields without storing credential values.

#### Phase 29g: One-Shot API Provider Execution

- Completed: support API execution only through a dry-run plan followed by explicit `--execute`.
- Completed: read credentials only from named environment variables, never from CLI arguments, local config files, `.env` auto-loading, committed files, package artifacts, workflow files, reports, or receipts.
- Completed: send only bounded package/prompt content allowed by the disclosure policy; raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, report bodies, and existing browser profile data are not sent by the adapter.
- Completed: do not persist raw provider responses. Provider responses are normalized into `agent_advisory_result`, a local receipt is written, and `gate_effect="none"` is preserved.
- Completed: did not add provider SDK dependencies; the minimal adapter boundary is tested with injected transports.

#### Phase 29h: Dashboard Contract and Status Integration

- Completed: dashboard and automation flows are the same for subscription and API modes: package, execution plan/run, execution status/list, advisory result/report, workflow status/index/report.
- Completed: exposed only additive execution metadata to dashboards, including plan status, run status, provider/surface kind, receipt paths, advisory-result path, dashboard status fields, and boundary flags.
- Completed: kept dashboard-specific semantics in dashboard-owned manifests or fixtures, not Browser Debug CLI runtime branches.
- Completed: kept MCP execution out of scope for this phase; the MCP adapter does not expose `agent execution run`.

#### Phase 29 Verification Plan

- Parser tests cover new `agent execution` subcommands, required options, missing `--execute`, unknown providers, unknown models, and conflict handling.
- No-browser tests cover plan/run/status/list success and failure paths through the fake provider and injected transports.
- Schema parity tests cover `agent_execution` without changing existing `agent_workflow`, `agent_advisory_result`, or review schemas except for additive references.
- Credential tests prove token values are not accepted through CLI args, not stored in artifacts, not printed in JSON, and not copied into receipts.
- Boundary tests prove raw screenshots, traces, DOM, console payloads, network payloads, sourceData values, report bodies, and raw provider responses are not transferred or stored by default.
- Invariance tests prove execution output does not change review `findings`, `metrics.finding_count`, existing `action_plan`, `quality_signals.release_readiness`, resource guard output, or artifact cleanup behavior.
- Architecture tests prove provider calls are isolated to the provider adapter module and are not reachable through MCP execution, review, resource, daemon, or cleanup modules.
- Verification must include `npm test`, `npm run test:pack`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`. Browser smoke tests are required only if browser runtime behavior changes.

#### Phase 29 Stop Conditions

- Stop if an implementation path requires changing existing deterministic review outputs, existing `agent_workflow` status semantics, existing action-plan fields, or existing release-readiness semantics.
- Stop if raw artifacts, sourceData values, trace contents, report bodies, raw provider responses, credential values, browser profile data, cookies, storage state, or secrets would be stored, uploaded, printed, or committed.
- Stop if provider execution cannot be gated by a local dry-run plan, explicit `--execute`, env-only credentials, local receipts, and advisory-only normalization.
- Stop if implementation requires OAuth/login automation, SaaS web UI automation, existing-browser-profile reuse, persistent credential storage, external upload beyond the bounded package/prompt policy, HTTP/socket MCP transport, MCP agent execution, arbitrary shell execution, marketplace mutation, npm publication, package rename, or license changes.

### Phase 30: Release Hardening Without Publication

Phase 30 hardens the local package release path without publishing, renaming the package, changing the license, registering a plugin, adding external upload, adding provider SDK dependencies, or changing runtime behavior. It verifies that the packed tarball exposes the expected CLI, API, MCP, schema, template, plugin, and workflow-security surfaces from an installed package layout.

#### Phase 30a: Packed Install Smoke

- Completed: added `npm run test:pack-install` as a no-publish packed tarball smoke check.
- Completed: the smoke check creates a temporary install layout under `/tmp`, extracts the `npm pack` tarball, links existing local dependencies from the repository install, and avoids registry access, publication, postinstall hooks, external upload, credential handling, or marketplace mutation.
- Completed: the smoke check verifies the packaged `browser-debug` CLI, `browser-debug-mcp` stdio entrypoint, package API imports, schema files, reusable target templates, plugin metadata, plugin skill, and selected workflow security documentation.
- Completed: the smoke check verifies `doctor`, `schema list`, `target validate`, package API import, and MCP `tools/list` from the packed package layout.

#### Phase 30b: Release Gate Wiring

- Completed: wired `npm run test:pack-install` into `npm run release:check`, the product aggregate gate, local CI manifest validation, and the Node GitHub Actions job.
- Completed: updated product manifests, repository index, release notes, verification docs, task tracker, and handoff to treat packed install smoke as local release-hardening evidence.
- Completed as boundary: `npm publish`, package naming, license changes, npm token handling, plugin marketplace registration, model/API review outside the Phase 29 adapter boundary, HTTP/socket MCP, OAuth/login automation, existing profile reuse, and external upload remain approval-bound.

#### Phase 30 Verification Plan

- Verification must include `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are required only if browser runtime behavior changes; Phase 30 does not change Playwright runtime behavior.

### Phase 31: MCP Profile Gating

Phase 31 turns the local stdio MCP adapter from one fixed allowlist into a launch-selected profile surface. It preserves existing no-argument MCP behavior for compatibility, keeps the CLI/core contract as the source of truth, and adds explicit lower-risk and future-admin profiles without adding HTTP/socket transport, shell tools, cleanup execution, agent execution, external upload, credential handling, profile reuse, or provider SDK behavior.

#### Phase 31a: Profile Contract and Documentation

- Completed: documented three MCP profiles: `safe`, `full`, and `admin`.
- Completed: kept no-profile `browser-debug-mcp` and `.mcp.json` behavior compatible with the current adapter by resolving to the `full` profile.
- Completed: recommended `safe` for low-trust or discovery-only MCP clients because it exposes no-browser/no-delete/no-provider tools only.
- Completed: defined `admin` as an explicit reserved local-maintenance profile for this phase, without exposing cleanup execution, provider execution, daemon/session control, shell, HTTP/socket listeners, or arbitrary process control.
- Completed: recorded that profile selection happens at server launch or trusted adapter context, not per MCP request.

#### Phase 31b: Reusable MCP Profile Registry

- Completed: added a data-driven MCP profile registry that owns tool metadata, profile membership, CLI argument mapping, and conservative effect metadata.
- Completed: kept `MCP_TOOLS` exported as the compatibility `full` tool list while adding API helpers such as `MCP_PROFILES`, `resolveMcpProfile`, and `getMcpTools`.
- Completed: kept MCP tools thin over existing CLI commands and core functions instead of creating profile-specific runtime branches.

#### Phase 31c: Launch-Time Profile Selection and Input Confinement

- Completed: added `browser-debug-mcp --profile safe|full|admin` plus `BROWSER_DEBUG_MCP_PROFILE` context support.
- Completed: added `browser-debug mcp serve --profile <profile> --json` metadata so humans and agents can inspect the configured adapter surface without starting stdio.
- Completed: made `tools/list` and `tools/call` fail closed for invalid profiles and out-of-profile tools.
- Completed: enabled MCP-only workspace confinement for `@file` structured inputs, including rejecting absolute paths, parent traversal, symlink escapes, non-regular files, and oversized files. Normal CLI `@file` behavior remains unchanged.

#### Phase 31d: Verification and Packaging

- Completed: added no-browser tests for profile membership, profile rejection, out-of-profile calls, MCP metadata output, and MCP-only file input confinement.
- Completed: extended packed install smoke coverage so installed packages expose the profile helpers and enforce safe/full profile behavior.
- Completed: updated product manifests, repository index, plugin-facing skill, README, changelog, security, release, verification, task tracker, and handoff with the profile boundary.

#### Phase 31 Verification Plan

- Verification must include `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are required only if browser runtime behavior changes; Phase 31 changes MCP adapter gating and no-browser input confinement only.

### Phase 32: Rename Readiness Without Renaming

Phase 32 prepared the package, plugin, MCP, and test surfaces for a future repository or command rename without performing that rename. It preserved the then-current `browser-debug-cli`, `browser-debug`, `browser-debug-mcp`, Browser Debug CLI display name, private package state, license, MCP server name, plugin name, and GitHub repository URL. It made rename-sensitive values explicit, reusable, and checked so the later approved TraceCue rename could be made in small contract-driven slices instead of scattered ad hoc edits.

#### Phase 32a: Identity Contract and Documentation

- Completed: defined a single product identity helper for package name, display name, CLI bin name, MCP bin name, MCP server name, plugin name, repository URL, plugin skill path, package version, and temporary pack/cache names.
- Completed: documented that Phase 32 does not rename the package, repository, plugin, MCP server, CLI command, or display name.
- Completed: kept `ops/PRODUCT_PROFILE.json` as the display-name authority and kept `Browser Debug CLI` unchanged.
- Completed: kept package naming, public package naming, repository rename, license change, marketplace registration, and npm publication approval-bound.

#### Phase 32b: Runtime and Package Alignment

- Completed: used the identity helper for MCP server metadata, CLI MCP metadata, bin help text, package API exports, and tests that verify package/plugin/MCP alignment.
- Completed: replaced the package dry-run and packed-install smoke script's hard-coded temporary paths with product identity and package metadata derived from the current package name and version.
- Completed: kept existing command names and current `.mcp.json` behavior unchanged while making the expected names explicit.

#### Phase 32c: Verification and Manifests

- Completed: added no-browser architecture tests that prove package metadata, plugin metadata, `.mcp.json`, MCP server metadata, and package smoke expectations agree with the identity helper.
- Completed: extended packed-install smoke coverage to verify the packaged API exports the identity helper and that package import paths are derived from the current package name.
- Completed: updated product manifests, repository index, README, changelog, security, release, verification, task tracker, and handoff with the rename-readiness boundary.

#### Phase 32 Verification Plan

- Verification must include `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are required only if browser runtime behavior changes; Phase 32 changes metadata, package smoke wiring, and no-browser tests only.

### Phase 33: MCP Read-Only Agent Status Surface

Phase 33 expands the local stdio MCP adapter with read-only local advisory/status tools that already exist in the CLI. It keeps `safe` no-browser, no-delete, no-provider, no-shell, and no-external-listener. It does not expose agent execution run, provider/API execution, artifact cleanup execution, workflow creation, package generation, ingest, report writing, daemon/session control, HTTP/socket transport, external upload, credential handling, or arbitrary process control.

#### Phase 33a: Scope and Boundary Documentation

- Completed: documented that MCP can read local agent surfaces, request status/detail, workflow status/index, and execution status/list through the same CLI/core contracts.
- Completed: kept write-producing advisory commands such as package generation, ingest, reports, workflow creation, and execution planning out of the MCP read-only slice.
- Completed: kept `agent execution run`, cleanup execution, provider/API execution, shell tools, daemon/session control, and HTTP/socket transport out of every MCP profile.

#### Phase 33b: Reusable MCP Tool Mapping

- Completed: added MCP tool definitions for `agent surfaces list`, `agent requests list`, `agent requests show`, `agent workflow status`, `agent workflow index`, `agent execution status`, and `agent execution list`.
- Completed: exposed the new tools through `safe`, `full`, and `admin` because they do not launch browsers, delete files, call providers, upload evidence, execute shell commands, or open external listeners.
- Completed: kept each MCP tool as a thin adapter over existing CLI arguments, preserving workspace-confined `@file` input handling where file paths are accepted.

#### Phase 33c: Verification and Packaging

- Completed: added no-browser tests for tool membership, safe-profile availability, status/detail calls, and continued non-exposure of execution run, cleanup execution, shell, and provider tools.
- Completed: extended packed-install smoke coverage so installed packages expose the read-only MCP agent status tools.
- Completed: updated product manifests, README, changelog, security, release, verification, task tracker, handoff, and session memory with the MCP read-only agent status boundary.

#### Phase 33 Verification Plan

- Verification must include `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are required only if browser runtime behavior changes; Phase 33 changes MCP adapter mapping and no-browser tests only.

### Phase 34: Safe HTTP MCP Foundation and Integration Docs

Phase 34 adds a minimal HTTP MCP transport as a safe foundation for MCP clients that cannot use stdio. It preserves CLI-first behavior, packaged `.mcp.json` compatibility, existing stdio profile behavior, and every existing no-browser/browser/review/package contract. It does not add HTTP `full` or `admin`, socket transport, remote listeners, shell tools, cleanup execution, provider/API execution, `agent execution run`, package generation, ingest, report writing, workflow creation, execution planning, daemon/session control, external upload, profile reuse, credential storage, or marketplace mutation through MCP.

#### Phase 34a: Transport Policy Module

- Completed: added a reusable MCP transport policy that resolves `stdio` and `http` configs separately.
- Completed: kept `stdio` profile resolution compatible with existing `BROWSER_DEBUG_MCP_PROFILE`, no-profile `full`, and packaged `.mcp.json` behavior.
- Completed: limited HTTP transport to the `safe` profile, loopback bind hosts, an absolute endpoint path, bounded request bodies, and a bearer token read from `BROWSER_DEBUG_MCP_HTTP_TOKEN` by default.
- Completed: exposed token-free public metadata for CLI/API inspection.

#### Phase 34b: HTTP Transport Module

- Completed: added an isolated `node:http` transport module that calls the existing `handleMcpRequest` core.
- Completed: validated Host and Origin headers as loopback, rejected non-POST methods, rejected non-JSON bodies, rejected JSON-RPC batches in this phase, and returned JSON responses with `MCP-Protocol-Version: 2025-06-18`.
- Completed: kept listener creation out of MCP core, profiles, review, resource, agent, and agent execution modules.
- Completed: added process-safe listener shutdown support for embedding contexts that provide an abort signal.

#### Phase 34c: CLI, Bin, and Package API

- Completed: extended `browser-debug-mcp` with `--transport`, `--host`, `--port`, `--endpoint`, `--token-env`, and `--body-limit` options.
- Completed: extended `browser-debug mcp serve --json` metadata so stdio and HTTP launch settings can be inspected without starting the long-running server.
- Completed: exported HTTP transport and policy helpers from the package API for reusable embedding and tests.
- Completed: kept the packaged `.mcp.json` unchanged as stdio compatibility configuration.

#### Phase 34d: Docs, Plugin Skill, and Consumer Integration

- Completed: documented CLI, MCP stdio, HTTP MCP safe, and Codex plugin usage as connection modes over the same core, not different feature tiers.
- Completed: documented that consumer repositories should keep target manifests, reduced summaries, and consumer-specific policy in the consumer repository while raw `.browser-debug/` artifacts stay local and ignored.
- Completed: documented a future rename/identity migration path without renaming package, repository, CLI, MCP server, plugin, license, or publication state in this phase.

#### Phase 34e: Verification

- Completed: added no-browser coverage for HTTP metadata, safe-profile-only startup, loopback host enforcement, token enforcement, Origin enforcement, method rejection, body-size limits, and safe tool listing.
- Completed: added packed-install coverage for HTTP transport files and package API exports.
- Completed: updated architecture and security checks so only the approved HTTP transport module may create the local listener.

#### Phase 34 Verification Plan

- Verification must include `node --check` on changed runtime and test files, `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are not required for Phase 34 unless browser runtime behavior changes; Phase 34 changes MCP transport, no-browser tests, package smoke checks, and documentation only.

### Phase 35: HTTP MCP Integration Hardening

Phase 35 makes the safe HTTP MCP foundation easier to adopt from external repositories and MCP clients. It is complete as a local-first integration-hardening slice and does not expand the MCP tool surface.

- Add `browser-debug mcp config --json` as a no-side-effect configuration helper for reusable client setup.
- Emit stdio MCP configuration that can be copied into MCP clients without inspecting repository internals.
- Emit explicit safe HTTP MCP launch and client-connection metadata without printing token values.
- Default HTTP configuration examples to a fixed local client port while preserving the server runtime default of port `0`.
- Add focused CLI/API tests for configuration output, profile defaults, token redaction, and HTTP full/admin rejection.
- Add packed-install smoke coverage that creates the safe HTTP MCP handler from the installed package API and completes an authenticated `initialize` request without binding a port.
- Update README, plugin skill guidance, security, verification, package, and workflow docs with the new client configuration path.
- Keep HTTP `full` or `admin`, socket transport, remote HTTP listeners, shell tools, cleanup execution, provider/API execution, `agent execution run`, package generation, ingest, report writing, workflow creation, execution planning, credential handling, external upload, and profile reuse out of scope.

### Phase 36: MCP Capability Policy Report

Phase 36 implements a read-only MCP capability policy report so users and agents can inspect the current safe/full/admin profile boundaries without reverse-engineering the repository. It does not approve any write or execute operation for MCP.

#### Phase 36a: Policy Report Core

- Completed: added `src/mcp-capabilities.js` as a pure no-side-effect report builder over the existing MCP profile, transport, and product identity contracts.
- Completed: added `browser-debug mcp capabilities --json` with `--profile safe|full|admin|all` and `--scope all|profiles|excluded` filtering.
- Completed: recorded explicit excluded operations for cleanup execution, package/ingest/report writing, workflow creation/report writing, daemon/session control, arbitrary shell, socket transport, remote HTTP listeners, and HTTP `full` or `admin`, while Phase 74-76 later exposes agent execution plan/run through stdio admin only.
- Completed: recorded the original `admin` equivalence boundary. Phase 74-76 later makes `admin` distinct from `full` only for the approved agent execution plan/run tools.

#### Phase 36b: MCP, API, and Package Reuse

- Completed: exposed `browser_debug_mcp_capabilities` through safe/full/admin MCP profiles because the tool is read-only and does not launch browsers, write artifacts, delete files, call providers, upload evidence, execute shell commands, or open listeners.
- Completed: exported the capability report helper and policy version through the package API.
- Completed: extended packed-install smoke coverage so installed packages expose the source file, API helper, CLI command, and MCP tool.

#### Phase 36c: Documentation and Boundaries

- Completed: synchronized requirements, specification, implementation plan, security, verification, release, README, plugin skill, manifests, task tracker, handoff, AGENTS, changelog, and session memory with the read-only capability policy boundary.
- Completed: kept cleanup execution, shell tools, daemon/session control, credential handling, HTTP `full` or `admin`, socket transport, remote listeners, and then-unapproved provider/API or `agent execution run` surfaces out of MCP; the later Slice 5 section records the approved stdio `admin` agent execution bridge.

#### Phase 36 Verification Plan

- Verification must include `node --check` on changed runtime and test files, `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are not required for Phase 36 unless browser runtime behavior changes; Phase 36 changes no-browser MCP policy reporting, package smoke checks, and documentation only.

### Phase 37: External Repository Usage Quickstart

Phase 37 makes Browser Debug CLI easier to use from external repositories without broadening runtime permissions. It keeps the CLI as the source of truth and treats MCP stdio, safe HTTP MCP, and the Codex plugin as connection modes over the same core.

#### Phase 37a: Post-Merge Workflow Sync

- Completed: updated workflow state after Phase 36 PR CI, main CI, and local/remote synchronization completed.
- Completed: kept Phase 36 scope limited to read-only MCP capability policy reporting.

#### Phase 37b: Candidate Selection

- Completed: selected external-repository usage quickstart as the next low-risk improvement because it improves ecosystem usability without exposing MCP execution, cleanup, shell, provider/API, remote HTTP, socket, or credential-bearing tools.
- Completed: kept future transport expansion, MCP execution exposure, public package naming, license changes, npm publication, and marketplace registration approval-bound.

#### Phase 37c: Packaged Usage Guide

- Completed: added `docs/workflow/CONSUMER_USAGE.md` with CLI, MCP stdio, safe HTTP MCP, and Codex plugin connection guidance for consumer repositories.
- Completed: documented capability boundaries for CLI, MCP `safe`, MCP `full`, MCP `admin`, safe HTTP MCP, and the Codex plugin.
- Completed: documented that consumer target manifests, acceptance notes, and consumer-specific policy should live in the consumer repository while raw `.browser-debug/` artifacts remain local and ignored.
- Completed: updated README and plugin-facing skill guidance to point agents to `mcp config`, `mcp capabilities`, and the packaged consumer guide instead of source inspection.
- Completed: included the guide in the package file set and packed-install smoke coverage without npm publication.

#### Phase 37 Verification Plan

- Verification must include `node --check` on changed test files, `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are not required for Phase 37 unless browser runtime behavior changes; Phase 37 changes documentation, package metadata, manifests, and no-browser package smoke coverage only.

#### Phase 38: Local Checkout MCP Config Dogfood Hardening

- Completed: dogfooded external-repository CLI and MCP discovery from a temporary consumer repository without launching a browser.
- Completed: identified that generated MCP config was still package-bin/PATH oriented, which made unpublished local checkout use less self-explanatory for other agents.
- Completed: added `local_checkout` metadata to stdio MCP config output with absolute `bin/browser-debug-mcp.js` and `node` command launch data derived from the current package location.
- Completed: added `local_checkout.launch` to safe HTTP MCP config output with the same token-free placeholder policy and loopback safe-profile connection metadata.
- Completed: preserved existing installed-bin `launch`, `client_connection`, and `mcpServers` shapes for compatibility.
- Completed: added no-browser and packed-install smoke assertions for the local-checkout metadata without expanding MCP permissions, starting listeners, writing config files, reading credentials, or exposing token values.

#### Phase 38 Verification Plan

- Verification must include `node --check` on changed runtime/test files, focused external-repository dogfood for `mcp config`, `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are not required for Phase 38 unless browser runtime behavior changes; Phase 38 changes no-browser MCP configuration metadata, documentation, and package smoke coverage only.

### Phase 39: Consumer Runtime Readiness Guidance

Phase 39 records the external-repository dogfood lesson that Browser Debug CLI can connect correctly while the target application is missing its own local API/backend runtime. It keeps Browser Debug CLI generic and moves app-specific startup prerequisites to the consumer repository.

#### Phase 39a: Packaged Guide Update

- Completed: added a target runtime readiness section to the packaged consumer guide.
- Completed: documented that frontend-only dev servers can produce valid `needs_attention` or browser-health findings when required API/backend endpoints are absent.
- Completed: documented that app-specific startup commands, API base environment variables, degraded-mode expectations, and acceptance notes belong in the consumer repository.

#### Phase 39b: Skill, README, and Product Sync

- Completed: updated README and the plugin-facing review skill so agents check the target app's full local runtime before interpreting review findings as connection failures.
- Completed: synchronized requirements, specification, implementation plan, security, verification, task tracker, handoff, AGENTS, changelog, and memory with the consumer runtime-readiness boundary.
- Completed: kept the change documentation-only and did not expand runtime commands, MCP permissions, transports, publication state, marketplace state, or identity names.

#### Phase 39 Verification Plan

- Verification must include `node --check` on changed test files, `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, `./tools/product-gate`, and `git diff --check`.
- Browser smoke tests are not required for Phase 39 unless browser runtime behavior changes; Phase 39 changes documentation and no-browser architecture coverage only.

## Verification Method

- `./tools/product-gate`
- `./tools/check_product_ci.sh`
- `npm test`
- `npm run test:browser`
- `npm run test:pack`
- `npm run test:pack-install`
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
- Phase 26 checks cover local agent request status listing, pending/imported transitions, single-package filtering, request status schema parity, no browser launch, no provider API calls, no automatic upload, no credential storage, no MCP agent execution, and no review artifact mutation.
- Phase 27 checks cover local agent request detail output, selected-result matching, request detail schema parity, no artifact writes, no browser launch, no provider API calls, no automatic upload, no credential storage, no MCP agent execution, and no review artifact mutation.
- Phase 28 checks cover local agent workflow creation, workflow status recomputation, workflow index aggregation, workflow report output, workflow schema parity, local workflow receipts, no browser launch, no provider API calls, no automatic upload, no credential storage, no MCP agent execution, no external evidence transfer, and no review artifact mutation.
- Phase 30 checks cover the packed tarball install layout, packaged CLI entrypoints, package API imports, MCP stdio tool listing, schema/template/plugin file presence, selected workflow security docs, and no-publish local release boundaries.
- Phase 31 checks cover MCP profile registry behavior, safe/full/admin launch selection, out-of-profile tool rejection, compatibility `MCP_TOOLS` exports, packed-install API profile helpers, and MCP-only workspace-confined `@file` handling without changing normal CLI behavior.
- Phase 32 checks cover product identity metadata, package/plugin/MCP name alignment, identity-derived package dry-run paths, derived packed-install tarball paths, package API identity exports, and unchanged current names before any approved rename.
- Phase 33 checks cover MCP read-only agent surfaces, request status/detail, workflow status/index, execution status/list, safe-profile availability, packed-install exposure, and continued non-exposure of execution run, cleanup execution, provider/API execution, shell tools, HTTP/socket transport, and write-producing advisory tools.
- Phase 34 checks cover HTTP MCP safe transport policy, loopback bind enforcement, bearer-token enforcement, Host and Origin validation, body-size limits, safe-profile-only tools, CLI metadata, packed-install API exports, and architecture/security isolation for the approved listener module.
- Phase 35/38 checks cover token-free MCP client configuration output, installed-bin and local-checkout stdio and safe HTTP client setup metadata, safe-profile defaulting, HTTP full/admin rejection, packed-install HTTP MCP initialize smoke coverage, and unchanged non-exposure of execution, cleanup, provider/API, shell, socket, remote HTTP, and credential-bearing tools.
- Phase 39 checks cover packaged consumer runtime-readiness guidance, frontend-only dev-server/API prerequisite wording, and continued absence of consumer-specific product names or local user paths.
- Security checks should be extended to guard against `launchPersistentContext`, `userDataDir`, storage-state persistence, unapproved external listener creation, arbitrary shell execution, unapproved upload paths, host cache/swap mutation, and cleanup outside the configured artifact root.

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
- Ask before model/API review integration outside the Phase 29 agent execution adapter boundary or any evidence transfer beyond the bounded package/prompt disclosure policy.
- Ask before extending the generic API-provider boundary beyond Phase 29 dry-run planning, explicit `--execute`, env-only credentials, local receipts, bounded disclosure, advisory-only normalization, and no raw provider response storage.
- Ask before adding provider SDKs, storing provider credentials, or exposing agent/API execution through MCP.
- Ask before socket MCP server mode, remote HTTP MCP listeners, HTTP `full` or `admin` MCP profiles, remote control channels, persistent session storage, existing-browser-profile reuse, or authentication automation.
- Ask before public API stabilization, npm package file-set changes intended for publication, package naming, license changes, or packed release promotion.

## Phase 41 Visual Evidence Core

- Step 2 adds a reusable local visual evidence core for browser screenshots, standalone images, future screen/window captures, and future desktop-app captures. Existing browser screenshot commands also emit additive metadata-only `visual_evidence` artifacts while preserving their existing `screenshot` artifacts.
- The implementation must write metadata-only `visual_evidence` records under the existing ignored `.browser-debug/visual-evidence/` artifact root.
- Visual evidence records include media hashes, dimensions when detectable, source kind, artifact paths, privacy flags, and explicit boundaries.
- Visual evidence records must not embed raw pixels, call providers, upload evidence, mutate deterministic review results, expose MCP execution, or remove any legacy Browser Debug CLI aliases.
- Verification must include schema parity, no-browser unit coverage, architecture boundary checks, package smoke checks, release checks, product gate, and `git diff --check`.

## Agentic Human Review AHR-25-40 Completion Readiness

- AHR-25-27 add real-provider dogfood readiness contracts without adding a second execution path. `agentic review dogfood readiness` reports provider, env-name, manual opt-in, and dogfood-set readiness while performing no provider calls, no credential-value reads, no artifact writes, and no evidence transfer. Real provider execution remains exclusively behind `agentic review run` with matching plan hash, package hash validation, provider capability hash, exact transfer flags, and `--execute`.
- AHR-28-31 add Visual Evidence Package v2, Visible Text Reading contracts, a content-comprehension article benchmark case, and `agentic review compare --comparison-kind direct-vs-tracecue`. V2 packages preserve raw-byte exclusions and make visible text review and OCR boundaries explicit.
- AHR-32-35 add xhigh round-plan v2, Quality Evaluator v3, and Human Report v3. Results now expose human likeness, visual specificity, content reading, sensibility, specific-fix, safety-boundary scores, and non-engineer-facing report sections for reader story, what works, what gets lost, and priority fix.
- AHR-36-40 add transfer approval preview, provider failure diagnostics, dogfood plan schemas, product manifest/schema/API/CLI/parser/test coverage, and production-readiness documentation sync.
- Verification must include `node --check` for changed runtime files, `npm test`, `npm run test:pack`, `npm run test:pack-install`, `npm run release:check`, product security/docs checks, product gate, and `git diff --check`.

## Agentic Human Review AHR-41-44 Completion Enforcement

- AHR-41 enforces real-provider dogfood execution opt-in at run validation time. Provider-API benchmark/dogfood runs are rejected before fetch unless the manual live dogfood environment flag is enabled; ordinary non-dogfood API runs keep the existing approval path.
- AHR-42 adds bounded visible-text provenance and screen-text understanding contracts to packages and API payloads. The implementation records DOM-visible text summaries, headings, action text, deterministic-review text, and OCR non-execution without embedding raw DOM, raw report bodies, raw pixels, credentials, or raw provider responses.
- AHR-43 completes benchmark-readiness metadata for plans, packages, benchmark list/show, calibration, report-quality, and advisory results. The readiness contract records fixture coverage, active case requirements, thresholds, manual-live-provider policy, and release-gate non-mutation without changing deterministic gates.
- AHR-44 makes `xhigh` completion mechanical by distinguishing real provider role output from synthesized placeholders. Missing planned roles, incomplete rounds, missing critic/verifier output, and missing synthesis keep `xhigh_multi_round_review.status` incomplete and prevent calibration-ready multi-round satisfaction.
- Verification must include focused Agentic Human Review CLI coverage for live dogfood blocking, plan/package/API visible-text transfer filtering, unknown benchmark rejection, fake-provider complete `xhigh`, injected-runner incomplete `xhigh`, and full local release checks.

## Agentic Human Review Maturity And Longitudinal Quality Foundation

- Add read-only maturity diagnostics to `agentic review report-quality`. The output records the current result effort, benchmark case, live-provider dogfood evidence, single-result maturity score, longitudinal evidence score, missing standard/deep/xhigh effort evidence, missing benchmark cases, comparison/history requirements, and explicit no-claim flags for human-equivalent or human-superior judgment.
- Add a standard/deep/xhigh maturity plan and benchmark-case matrix to `agentic review dogfood readiness` and `agentic review dogfood plan`. The matrix gives proposal, plan, run, report-quality, and calibrate command shapes for each required effort without executing providers or writing artifacts.
- Keep this slice advisory-only and read-only. It does not run live dogfood, call providers, read credentials, transfer evidence, write artifacts from readiness/planning, mutate deterministic findings or release gates, expose Agentic Human Review through MCP, or authorize human-equivalent/human-superior claims.
- Verification must include focused no-browser CLI coverage, schema registry/file parity, docs sync, product security/docs checks, product gate, and `git diff --check`.

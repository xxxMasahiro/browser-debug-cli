# RELEASE.md

## Current Status

Agentic Human Review Slice 34-42 now adds CLI-only `agentic review propose`, `agentic review plan --proposal`, `agentic review provider-readiness`, approved generic API provider execution through `agentic review run`, and `agentic review report-quality` coverage for conversational human-like visual, UX, content, comprehension, subjective review orchestration, provider readiness, and report-quality verification with proposal/plan hash gates, package-hash validation, exact evidence-transfer flags, advisory-only output, schema/API/package coverage, provider adapter isolation, generic agent-execution bypass prevention, and no MCP exposure or release-gate mutation.

TraceCue is not released. The repository has local MVP runtime coverage, persistent browser session coverage for bounded full-profile supervise, retained local sessions, manual checkpoints, admin-only storageState opt-in, admin-only MCP session tools, Phase 7 review-platform coverage, Phase 8 dogfood/plugin-readiness coverage, Phase 9 local review-quality coverage, Phase 10 route-readiness coverage, Phase 11 page-expectation and artifact-index coverage, Phase 12 rendered-state dogfood hardening coverage, Phase 14 content UX advisory coverage, Phase 15 content UX heuristic coverage, Phase 16 content UX handoff coverage, Phase 17 content UX practical handoff coverage, Phase 18 content UX review brief/rubric coverage, Phase 19 no-browser target manifest validation coverage, Phase 20 no-browser local resource status preflight coverage, Phase 21-24 local resource safety coverage, Phase 25 local agent advisory handoff coverage, Phase 26 local agent request status coverage, Phase 27 local agent request detail coverage, Phase 28 local agent workflow status coverage, Phase 29 agent execution adapter coverage, Phase 30 packed install smoke coverage, Phase 31 MCP profile-gating coverage, Phase 32 rename-readiness coverage, Phase 33 MCP read-only agent status coverage, Phase 34 safe HTTP MCP foundation coverage, Phase 35 HTTP MCP integration-hardening coverage, Phase 36 MCP capability policy coverage, Phase 37 packaged external-repository usage coverage, Phase 38 local-checkout MCP config coverage, Phase 39 consumer runtime-readiness guidance coverage, Phase 56 identity audit and rename-readiness coverage, Phase 57 physical checkout rename coverage, Phase 58 remote repository rename coverage, Phase 59 local language settings coverage, Phase 60 read-only operation registry and roadmap risk taxonomy coverage, Phase 60.1 read-only operation roadmap boundary-contract coverage, Phase 61-64 read-only operation contract coverage, Phase 65-68 read-only operation policy/readiness coverage, Phase 69-70 read-only operation admin readiness coverage, Phase 71-78 provider readiness plus admin-only MCP agent execution coverage, Phase 79-119 cleanup/capture/localization/translation readiness coverage, Phase 120-155 release/artifact-root/alias/shell/final readiness coverage, a public GitHub repository, remote `main` synchronization, passing GitHub Actions `main` CI, CI manifest validation, local package dry-run verification, and no-publish packed install verification.

## Local Release Readiness Checks

Run these checks before any public release work is proposed:

```bash
npm test
npm run test:rename-readiness
npm run test:browser
npm run test:pack
npm run test:pack-install
npm run release:check
./tools/check_product_ci.sh
./tools/product-gate
```

The package dry-run uses a `/tmp` npm cache and must not publish:

```bash
npm pack --dry-run --json --cache /tmp/trace-cue-npm-cache
```

The packed install smoke uses a temporary install layout under `/tmp` and must not publish or install from the registry:

```bash
npm run test:pack-install
```

## Release Blockers

- Confirm the public npm package name and optional scope.
- Choose a release license and replace `UNLICENSED` only after approval.
- Confirm npm account, token handling, and publication method only after approval.
- Decide whether and where to register the local Codex plugin bundle.
- Treat `quality_signals.release_readiness` as a local review gate only; it does not authorize package publication or marketplace registration.
- Treat `quality_signals.content_ux`, `local_content_ux_advisory`, `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, `content_ux_page_handoff`, and `content_ux_manifest_authoring` as advisory-only target review output; they do not authorize package publication, marketplace registration, external evidence transfer, or automatic manifest mutation.
- Treat `artifact_index` as local artifact inventory and rerun guidance only; it does not authorize evidence transfer.
- Treat `agent package`, `agent requests list`, `agent requests show`, `agent workflow create`, `agent workflow status`, `agent workflow index`, `agent workflow report`, `agent ingest`, and `agent report` as local advisory handoff tooling only; they do not authorize direct provider API calls, external upload, credential storage, MCP agent execution, browser launch, review artifact mutation, artifact writing from status/detail reads, or release-gate changes.
- Treat Phase 29 `agent execution` as a separate additive layer that requires dry-run planning, explicit `--execute`, env-only credentials, bounded disclosure, local receipts, no raw provider response storage, advisory-only normalization, and no MCP execution.
- Treat Agentic Human Review Slice 26-33 as a separate CLI-only owner layer for human-like visual, UX, content, comprehension, and subjective review orchestration. It requires a stored plan, matching plan hash, explicit `--execute`, exact transfer flags, bounded local receipts, raw response redaction, and advisory-only normalization; it does not authorize MCP exposure, generic agent-execution routing, deterministic review mutation, release-gate changes, credential storage, or evidence transfer without matching plan permissions.
- Treat Phase 30 packed install smoke as local release evidence only; it does not authorize npm publication, package rename, license change, npm token handling, marketplace registration, or external evidence transfer.
- Treat Phase 31 MCP profiles as local stdio adapter selection only. `safe` lowers the MCP surface, `full` preserves compatibility, and `admin` is explicit. After Phase 74-76, `admin` authorizes only agent execution plan/run through stdio; it does not authorize cleanup execution, HTTP `full` or `admin`, socket transport, shell tools, external upload, profile reuse, provider credentials, or arbitrary process control.
- Treat Phase 32 rename readiness as alignment and verification only. It does not authorize package rename, repository rename, plugin rename, MCP server rename, public package naming, license change, marketplace registration, npm publication, or external evidence transfer.
- Treat Phase 56 identity audit and rename-readiness as local inspection only. Treat Phase 57 physical checkout rename as a local filesystem move only. Treat Phase 58 remote repository rename as GitHub repository identity synchronization only. These phases do not authorize artifact-root migration, legacy alias removal, public package naming, license change, marketplace registration, npm publication, or external evidence transfer.
- Treat Phase 33 MCP read-only agent status tools as local inspection only. They do not authorize package generation, ingest, report writing, workflow creation, cleanup execution, unrelated provider/API execution, shell tools, external upload, socket transport, remote HTTP listener, HTTP `full` or `admin`, credential handling, or publication; execution planning/run exposure is limited to the later approved Phase 74-76 stdio `admin` bridge.
- Treat Phase 34 safe HTTP MCP as a local transport foundation only. It does not authorize HTTP `full` or `admin`, socket transport, remote HTTP listeners, cleanup execution, provider/API execution through HTTP, `agent execution run` through safe/full/HTTP, shell tools, external upload, profile reuse, credential storage, publication, or marketplace registration.
- Treat Phase 35/38 MCP client configuration as token-free setup metadata and smoke coverage only. Local-checkout metadata helps unpublished checkouts connect without source inspection; it does not authorize credential storage, config-file mutation, server launch automation, HTTP `full` or `admin`, socket transport, remote HTTP listeners, cleanup execution, provider/API execution outside the approved stdio `admin` agent execution bridge, shell tools, external upload, profile reuse, publication, or marketplace registration.
- Treat Phase 36 MCP capability policy as read-only inspection only. After approved later slices it reports admin-only agent execution plan/run exposure and admin-only persistent session exposure, but it does not authorize cleanup execution, visual review execution, capture execution, translation execution, shell tools, non-admin persistent session control, credential handling, HTTP `full` or `admin`, socket transport, remote HTTP listeners, publication, or marketplace registration.
- Treat Phase 37 consumer usage guidance as documentation and packaging only. It does not authorize package publication, plugin marketplace registration, remote listeners, HTTP `full` or `admin`, socket transport, cleanup execution, provider/API execution outside the approved stdio `admin` agent execution bridge, shell tools, credential handling, or external evidence transfer.
- Treat Phase 39 consumer runtime-readiness guidance as documentation and packaging only. It does not authorize app-specific runtime branches, target manifest mutation, broader MCP permissions, package publication, plugin marketplace registration, remote listeners, HTTP `full` or `admin`, socket transport, cleanup execution, provider/API execution, shell tools, credential handling, or external evidence transfer.
- Treat Phase 59 language settings as local inspection and metadata only. It does not authorize provider translation execution, repository-document localization, parent or consumer repository contact, settings mutation from read commands, broader MCP permissions, package publication, artifact-root migration, or legacy alias removal.
- Treat Phase 60 operation registry and Phase 60.1 operation roadmap as read-only policy/governance inspection only. They do not authorize provider/API execution through MCP, cleanup execution through MCP, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, constrained shell execution, HTTP `full` or `admin`, socket transport, remote listeners, credential handling, external upload, remote CI triggering, draft-roadmap product-plan promotion, or MCP write/execute expansion.
- Treat Phase 61-64 operation contracts as read-only contract inspection only. They do not authorize token issuance, receipt writing, execution harness enablement, provider/API execution through MCP, cleanup execution through MCP, capture execution, translation execution, package publication, artifact-root migration, legacy alias removal, constrained shell execution, HTTP `full` or `admin`, socket transport, remote listeners, credential handling, external upload, remote CI triggering, draft-roadmap product-plan promotion, or MCP write/execute expansion.
- Treat Phase 65-68 operation policy/readiness as read-only policy inspection only. It reports approved admin-only agent execution exposure after Phase 74-76, but it does not authorize policy mutation, token issuance, receipt writing outside agent execution, generic execution harness enablement, cleanup execution through MCP, capture execution, translation execution, package publication, artifact-root migration, legacy alias removal, constrained shell execution, HTTP `full` or `admin`, socket transport, remote listeners, credential handling, external upload outside bounded agent execution, remote CI triggering, draft-roadmap product-plan promotion, or unrelated MCP write/execute expansion.
- Treat Phase 69-70 operation admin readiness as read-only readiness inspection only. It reports approved admin-only agent execution bridge state after Phase 74-76, but it does not authorize token issuance, token storage, receipt writing outside agent execution, generic execution harness enablement, cleanup execution through MCP, capture execution, translation execution, package publication, artifact-root migration, legacy alias removal, constrained shell execution, HTTP `full` or `admin`, socket transport, remote listeners, credential handling, external upload outside bounded agent execution, remote CI triggering, draft-roadmap product-plan promotion, or unrelated MCP write/execute expansion.
- Treat Phase 71-78 operation provider readiness and provider MCP status/list as read-only readiness inspection only. They report approved admin-only fake/local/API execution exposure, but the report itself does not call providers, execute local runners, read credential values, transfer evidence, write receipts, or grant cleanup/capture/translation/package/migration/alias/shell/HTTP-admin/socket/remote-listener authority.
- Treat Phase 120-125 release readiness as local no-publish inspection only. It does not authorize npm publication, registry upload, npm token reads, package rename, license change, marketplace mutation, external upload, remote CI triggering, or publication credentials.
- Treat Phase 126-133 artifact-root policy/status/migration readiness as compatibility-preserving inspection and fixture-boundary work only. It does not authorize real migration of developer artifacts, compatibility removal, cleanup outside the configured artifact root, or MCP write/execute expansion.
- Treat Phase 134-139 legacy alias audit/removal readiness as compatibility-preserving inspection and fail-closed gating only. It does not authorize package bin removal, MCP alias removal, plugin alias removal, artifact-root compatibility removal, or product-doc promotion.
- Treat Phase 140-148 constrained shell readiness as plan-only and fail-closed. It does not authorize child-process use, shell interpreters, environment or credential value reads, file mutation, network access, free-form command text, or MCP shell execution.
- Treat Phase 149-155 final hardening readiness as report-only. It does not run browser smoke, MCP smoke execution, remote CI, Git mutation, publication, provider calls, artifact migration, alias removal, shell execution, or product-doc promotion.
- Treat `resource status` and `resource_guard` as local preflight signals only; they do not authorize host cleanup, system cache mutation, swap configuration, privileged helper use, external evidence transfer, or arbitrary process control.
- Treat `resource artifacts cleanup --execute` as a local artifact-root-only operation with receipts; it does not authorize automatic cleanup, host cache deletion, swap changes, cleanup outside `.browser-debug/`, or MCP cleanup execution.
- Do not upload traces, screenshots, session files, cookies, storage state, credentials, or `.browser-debug/` artifacts.
- Keep model/API execution outside the Phase 29 agent execution adapter boundary, evidence transfer beyond bounded package/prompt disclosure, socket MCP transport, remote HTTP MCP listeners, HTTP `full` or `admin`, OAuth/login automation, and external upload approval-bound.

## Non-Goals Before Approval

- No `npm publish`.
- No OAuth, login automation, webhook setup, external upload, or credential storage.
- No model/API execution outside the Phase 29 agent execution adapter boundary and no evidence upload beyond bounded package/prompt disclosure.
- No socket MCP transport, remote HTTP MCP listener, HTTP `full` or `admin`, MCP execution tool, or MCP shell tool.
- No plugin marketplace registration or installation-state mutation.
- No host memory-cache mutation, swap configuration, cleanup outside the configured artifact root, privileged helper execution, arbitrary process control, or MCP cleanup execution.

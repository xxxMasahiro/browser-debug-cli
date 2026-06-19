# RELEASE.md

## Current Status

Browser Debug CLI is not released. The repository has local MVP runtime coverage, Phase 7 review-platform coverage, Phase 8 dogfood/plugin-readiness coverage, Phase 9 local review-quality coverage, Phase 10 route-readiness coverage, Phase 11 page-expectation and artifact-index coverage, Phase 12 rendered-state dogfood hardening coverage, Phase 14 content UX advisory coverage, Phase 15 content UX heuristic coverage, Phase 16 content UX handoff coverage, Phase 17 content UX practical handoff coverage, Phase 18 content UX review brief/rubric coverage, Phase 19 no-browser target manifest validation coverage, Phase 20 no-browser local resource status preflight coverage, Phase 21-24 local resource safety coverage, Phase 25 local agent advisory handoff coverage, Phase 26 local agent request status coverage, Phase 27 local agent request detail coverage, Phase 28 local agent workflow status coverage, Phase 29 agent execution adapter coverage, Phase 30 packed install smoke coverage, Phase 31 MCP profile-gating coverage, Phase 32 rename-readiness coverage, Phase 33 MCP read-only agent status coverage, Phase 34 safe HTTP MCP foundation coverage, Phase 35 HTTP MCP integration-hardening coverage, Phase 36 MCP capability policy coverage, Phase 37 packaged external-repository usage coverage, Phase 38 local-checkout MCP config coverage, a public GitHub repository, remote `main` synchronization, passing GitHub Actions `main` CI, CI manifest validation, local package dry-run verification, and no-publish packed install verification.

## Local Release Readiness Checks

Run these checks before any public release work is proposed:

```bash
npm test
npm run test:browser
npm run test:pack
npm run test:pack-install
npm run release:check
./tools/check_product_ci.sh
./tools/product-gate
```

The package dry-run uses a `/tmp` npm cache and must not publish:

```bash
npm pack --dry-run --json --cache /tmp/browser-debug-cli-npm-cache
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
- Treat Phase 30 packed install smoke as local release evidence only; it does not authorize npm publication, package rename, license change, npm token handling, marketplace registration, or external evidence transfer.
- Treat Phase 31 MCP profiles as local stdio adapter selection only. `safe` lowers the MCP surface, `full` preserves compatibility, and `admin` is explicit but does not authorize cleanup execution, agent/API execution, HTTP `full` or `admin`, socket transport, shell tools, external upload, profile reuse, provider credentials, or arbitrary process control.
- Treat Phase 32 rename readiness as alignment and verification only. It does not authorize package rename, repository rename, plugin rename, MCP server rename, public package naming, license change, marketplace registration, npm publication, or external evidence transfer.
- Treat Phase 33 MCP read-only agent status tools as local inspection only. They do not authorize package generation, ingest, report writing, workflow creation, execution planning, `agent execution run`, cleanup execution, provider/API execution, shell tools, external upload, socket transport, remote HTTP listener, HTTP `full` or `admin`, credential handling, or publication.
- Treat Phase 34 safe HTTP MCP as a local transport foundation only. It does not authorize HTTP `full` or `admin`, socket transport, remote HTTP listeners, cleanup execution, provider/API execution, `agent execution run`, shell tools, external upload, profile reuse, credential storage, publication, or marketplace registration.
- Treat Phase 35/38 MCP client configuration as token-free setup metadata and smoke coverage only. Local-checkout metadata helps unpublished checkouts connect without source inspection; it does not authorize credential storage, config-file mutation, server launch automation, HTTP `full` or `admin`, socket transport, remote HTTP listeners, cleanup execution, provider/API execution, `agent execution run`, shell tools, external upload, profile reuse, publication, or marketplace registration.
- Treat Phase 36 MCP capability policy as read-only inspection only. It does not authorize cleanup execution, provider/API execution, `agent execution run`, shell tools, daemon/session control, credential handling, HTTP `full` or `admin`, socket transport, remote HTTP listeners, publication, or marketplace registration.
- Treat Phase 37 consumer usage guidance as documentation and packaging only. It does not authorize package publication, plugin marketplace registration, remote listeners, HTTP `full` or `admin`, socket transport, cleanup execution, provider/API execution, `agent execution run`, shell tools, credential handling, or external evidence transfer.
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

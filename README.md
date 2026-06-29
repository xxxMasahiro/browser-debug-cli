# TraceCue

TraceCue is an unreleased OSS command-line tool for AI-assisted browser debugging, UI/UX inspection, and local deterministic browser review.

The goal is to provide an agent-independent Playwright interface that can observe page state, suggest or execute browser actions, collect evidence, and generate reports without depending on Playwright MCP or any single AI agent runtime.

## Planned Use

- Debug web applications through structured page observations.
- Let an AI or human choose the next browser action from machine-readable candidates.
- Find UI/UX issues, functional defects, broken flows, missing states, and accessibility problems.
- Collect screenshots, traces, and notes for reproducible fixes.
- Use fast headless mode by default, with headed browser and DevTools support for visual quality checks.
- Run deterministic local review findings for browser health, layout integrity, interaction quality, accessibility basics, and conservative mock metrics.
- Generate target manifests for whole-app route and viewport review, including explicit `expectedRoutes` and optional page expectations.
- Validate edited target manifests before launching a browser, including route, page, content UX, and local boundary counts.
- Return action plans, implementation-focused fix candidates, local heuristic review advisory data, and structured quality signals for developer handoff.
- Flag rendered-state issues such as broken images, explicit lingering loading indicators, and empty data containers without empty-state copy.
- Suggest manifest improvements when a target review needs pinned routes, named page expectations, or a larger route budget.
- Opt into local content UX advisory from a target manifest to compare bounded inline source facts, selector-scoped UI state, and required user-question evidence without changing review gates.
- Emit separate `content_ux_findings`, `content_ux_action_plan`, and `content_ux_readiness` handoff data while preserving existing review findings, action plans, metrics, and release readiness.
- Review content UX findings by page, status clarity, action clarity, navigation clarity, information architecture, and manifest-authoring gaps.
- Evaluate manifest-declared content UX review briefs and rubric criteria with separate `content_ux_review_brief` and `content_ux_rubric_evaluation` outputs.
- Run a no-browser local resource status preflight before browser-heavy work, including memory, swap, cgroup, pressure, and process memory signals.
- Guard browser-heavy reviews with local resource preflight/recheck output, optional fail-critical stopping, and screenshot/trace pressure warnings without changing review findings or release gates.
- Monitor `.browser-debug/` artifact size and run explicit local artifact cleanup with receipts when the developer chooses `--execute`.
- Bound local background daemons with optional idle-timeout and max-lifetime lifecycle metadata.
- Package local review evidence for subscription or local AI agent handoff, track local agent workflows for dashboards and automation, import untrusted agent advisory JSON, and render advisory reports without changing deterministic review gates.
- Run bounded agent execution through dry-run plans, explicit execution gating, deterministic fake providers, configured local runner callbacks, env-only API adapters, bounded disclosure, local receipts, and advisory-only result boundaries.
- Use the same CLI/core contract from a local stdio MCP adapter when an MCP client is useful, with launch-selected `safe`, `full`, or `admin` profiles.
- Inspect the current MCP profile, transport, operation registry, operation roadmap boundary contracts, operation contract shapes, operation policy readiness, MCP admin token-flow/harness readiness, provider MCP readiness, release readiness, artifact-root readiness, legacy alias readiness, constrained shell readiness, final hardening readiness, and admin write/execute exclusion policy without starting a server or changing files.
- Follow a packaged external-repository quickstart so humans and agents can connect through CLI, MCP stdio, safe HTTP MCP, or the Codex plugin without inspecting source internals.
- Inspect TraceCue-local language settings for dashboard display locale and artifact output language without using parent-repository settings or running translation providers.
- Prepare metadata-only future visual review results from existing review artifact indexes without provider execution, raw pixel transfer, external upload, MCP exposure, or deterministic review mutation.
- Run explicit CLI-only visual review provider adapters from preparation artifacts and normalize untrusted advisory output without raw pixel transfer, existing review mutation, release gate changes, raw provider response storage, or MCP exposure.
- Review existing screen, window, and desktop app screenshots through caller-declared capture handoff metadata, with path and SHA-256 matching before provenance reaches visual evidence records.
- Aggregate multiple existing local visual review results into bounded, source-attributed advisory groups and conflicts without running providers, reading raw pixels, writing artifacts, or exposing MCP execution.
- Run a loopback-only Agentic Human Review Responses adapter so the existing generic provider contract can dogfood a live Responses-compatible model without sending credentials through CLI arguments, storing raw provider responses, exposing MCP execution, or changing deterministic gates.
- Evaluate Agentic Human Review dogfood quality with structured benchmark coverage, reusable human-baseline registry/overlay/draft/approval/claim-readiness diagnostics, owner-labeled human baseline comparison, evidence-set summaries, batch comparison, evaluator policy warnings, xhigh round planning, longitudinal rollups, claim audit diagnostics, and a fail-closed claim standard gate without calling providers, writing artifacts, exposing MCP execution, treating AI drafts or synthetic/fake/local fixtures as proof, or turning advisory output into release gates.

## Current Status

This repository has completed the Free Development scaffold, local Git initialization, Phase 2a package/runtime design, the local MVP runtime slice, the Phase 7 local review-platform slice, the Phase 8 local dogfood/plugin-readiness slice, the Phase 9 local review-quality slice, the Phase 10 manifest route-readiness slice, the Phase 11 page-expectation review slice, the Phase 12 rendered-state dogfood hardening slice, the Phase 13 dogfood signal refinement slice, the Phase 14 content UX advisory slice, the Phase 15 content UX heuristic strengthening slice, the Phase 16 content UX handoff output slice, the Phase 17 content UX practical handoff slice, the Phase 18 content UX review brief/rubric slice, the Phase 19 local target manifest validation slice, the Phase 20 local resource status preflight slice, the Phase 21-24 local resource safety slice, the Phase 25 local agent advisory handoff slice, the Phase 26 local agent request status slice, the Phase 27 local agent request detail slice, the Phase 28 local agent workflow status slice, the Phase 29 agent execution integration, the Phase 30 no-publish release-hardening slice with packed install smoke coverage, the Phase 31 MCP profile-gating slice, the Phase 32 rename-readiness slice, the Phase 33 MCP read-only agent status slice, the Phase 34 safe HTTP MCP foundation slice, the Phase 35 HTTP MCP integration-hardening slice, the Phase 36 MCP capability policy slice, the Phase 37 external-repository usage quickstart slice, the Phase 38 local-checkout MCP config dogfood-hardening slice, the Phase 41-55 visual evidence, image review, capture handoff, visual execution, desktop provenance, MCP gate-reporting, aggregation, and hardening slices, the Phase 56-58 rename-readiness, physical checkout rename, and remote repository rename slices, the Phase 59 local language settings foundation, the Phase 60 read-only operation registry and roadmap risk taxonomy foundation, the Phase 60.1 read-only operation roadmap boundary-contract slice, the Phase 61-64 read-only operation contract foundation, the Phase 65-68 read-only operation policy/readiness foundation, the Phase 69-70 read-only operation admin readiness foundation, and the Phase 71-73 read-only operation provider readiness foundation. The current CLI supports `doctor`, deterministic JSON errors, Playwright-backed one-shot `observe`, headed/devtools launch modes, local artifacts, session metadata, simple actions, process-scoped supervision, local background daemon start/status/stop with optional lifecycle guards, no-browser `resource status`, no-browser `resource artifacts plan`, explicit `.browser-debug/` cleanup receipts, screenshots/traces, reports, spec export, deterministic `review` with additive `resource_guard` output, target-manifest site review, target manifest initialization, target manifest validation, action plans, local heuristic review advisory data, local quality signals, rendered-state findings, manifest suggestions, opt-in content UX advisory, selector-scoped content/state/risk checks, required user-question checks, dedicated content UX findings/action/readiness handoff output, page-level content UX handoff, content UX manifest-authoring suggestions, content UX review brief/rubric evaluation, page expectation checks, local review artifact indexes, agent advisory package/request-status/request-detail/workflow/ingest/report commands, agent execution plan/run/status/list commands, visual review result preparation, visual review execution, visual review aggregation, identity audit, local language settings inspection, read-only operation registry inspection, read-only operation roadmap inspection, read-only operation contracts inspection, read-only operation policy inspection, read-only operation admin readiness inspection, read-only operation provider readiness inspection, schema commands, shell-safe structured input, reusable target manifest templates, packaged external-repository usage guidance, product identity metadata, token-free MCP client configuration output with installed-bin and local-checkout metadata, no-side-effect MCP capability policy output, a local stdio MCP adapter with profile-gated tool surfaces including read-only agent advisory/status inspection, and an explicit safe-profile HTTP MCP transport that is loopback-only and bearer-token gated.

Slice 5 / Phase 74-78 additionally exposes the existing agent execution plan/run flow through the stdio `admin` MCP profile for deterministic fake providers, configured local runner callbacks, and env-only generic API providers. Safe and full MCP profiles remain non-execution profiles, HTTP MCP remains safe-only, and provider readiness still reports status/list metadata without calling providers.

Slices 6-25 / Phase 79-155 add cleanup plan hardening, capture readiness, provider-free localization and translation readiness, local release readiness, artifact-root policy and migration readiness, legacy alias audit/removal readiness, constrained shell readiness, and final hardening readiness. These surfaces are local bounded reports, schemas, dry-run metadata, compatibility helpers, or fail-closed gates. They do not authorize npm publication, real artifact-root migration, legacy alias removal, constrained shell execution, capture execution, translation execution, remote CI triggering, `docs/product/` roadmap promotion, or MCP write/execute expansion beyond the approved stdio `admin` agent execution bridge.

Agentic Human Review now includes a local Responses-compatible adapter for manual live dogfood. Start it with `npm run ahr:responses-adapter`; point the generic provider endpoint at the loopback adapter URL, not directly at the upstream provider. The adapter reads the local bearer token and provider key from environment variables, converts the TraceCue AHR request into a bounded Responses request with `store: false`, and returns normalized advisory JSON only.

Agentic Human Review quality evaluation now also has read-only local commands for the dogfood phase after a manual run. Use human-baseline registry/overlay/draft/approval/validate/compare/claim-readiness, evidence-set validation/summary, batch comparison, evaluator policy, xhigh planning/simulation, longitudinal quality, claim policy/audit, and claim standard-gate commands to compare standard/deep/xhigh runs and benchmark cases before making any quality claim. AI drafts remain preparation only; approved baselines require owner approval metadata, synthetic or fixture-only markers do not verify as owner evidence, and owner-label comparison scoring requires structured findings with local evidence references. These commands read local result metadata only; they do not approve live provider execution and do not permit human-equivalent or human-superior claims by themselves. The claim standard gate returns a failed command status when owner claim-review readiness does not pass, but it remains advisory-only and does not mutate deterministic release gates. Proof-readiness diagnostics must show the full benchmark-case by effort matrix, missing case-level `direct-vs-tracecue` comparisons, weak calibration blockers, and adapter structured-output gaps instead of relying on total result counts.

## Integration Modes

| Mode | How to connect | Main use | Notes |
| --- | --- | --- | --- |
| CLI | Run `trace-cue` from a shell, human workflow, or any agent runtime that can execute commands. | Full local product workflow. | The CLI remains the source of truth and exposes the complete approved command surface. |
| MCP stdio | Run `trace-cue mcp config --profile safe --json`, then add the emitted `mcpServers` object to the MCP client. | MCP clients that prefer stdio tools. | Use top-level `mcpServers` when installed on PATH, or `local_checkout.mcpServers` when using an unpublished checkout. |
| HTTP MCP safe | Run `trace-cue mcp config --transport http --profile safe --port 8765 --json`, set the token env var, then launch with the emitted `launch` metadata. | MCP-compatible local tooling that needs an HTTP endpoint instead of stdio. | Safe-profile-only, loopback-only, bearer-token gated, and limited to one JSON-RPC request per POST; use `local_checkout.launch` for unpublished checkout use. |
| Codex plugin | Use the local plugin bundle under `.codex-plugin/`, `.mcp.json`, and `skills/`. | Codex discovery of the skill and MCP adapter. | The plugin is a wrapper around the same CLI/MCP surfaces; marketplace registration is not performed. |

Consumer repositories should treat TraceCue as optional advisory tooling. Keep target manifests, reduced summaries, and consumer-specific policy in the consumer repository. Keep raw `.browser-debug/` artifacts local and ignored, and do not make this tool a default release gate or runtime dependency unless the consumer repository explicitly chooses that policy.

## External Repository Quickstart

Use [docs/workflow/CONSUMER_USAGE.md](docs/workflow/CONSUMER_USAGE.md) when connecting TraceCue from another repository. The short path is:

```bash
cd /path/to/consumer-app
export TRACE_CUE_CLI=/path/to/trace-cue/bin/trace-cue.js
node "$TRACE_CUE_CLI" doctor --json
node "$TRACE_CUE_CLI" mcp config --profile safe --json
node "$TRACE_CUE_CLI" mcp capabilities --profile admin --scope excluded --json
```

For CLI review, run `target init`, edit the target manifest in the consumer repository, run `target validate`, then run `review --target`. For MCP clients, use `mcp config` output instead of inspecting package files; generated output includes both installed-bin metadata and `local_checkout` metadata for unpublished checkout use. For Codex, the local plugin bundle is a discovery wrapper around the same CLI/MCP surfaces.

Before browser review, run the target app's full local stack needed for the reviewed state. Frontend-only dev servers can correctly produce `needs_attention` or browser-health findings when required API/backend endpoints are not running.

## Local CLI

```bash
node ./bin/trace-cue.js doctor --json
node ./bin/trace-cue.js observe --url http://127.0.0.1:3000/ --screenshot --trace --json
node ./bin/trace-cue.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --json
node ./bin/trace-cue.js daemon start --url http://127.0.0.1:3000/ --idle-timeout 15m --max-lifetime 2h --json
node ./bin/trace-cue.js daemon status --daemon <id> --json
node ./bin/trace-cue.js daemon stop --daemon <id> --json
node ./bin/trace-cue.js resource status --json
node ./bin/trace-cue.js resource artifacts plan --json
node ./bin/trace-cue.js resource artifacts cleanup --dry-run --json
node ./bin/trace-cue.js resource artifacts cleanup --execute --json
node ./bin/trace-cue.js agent surfaces list --json
node ./bin/trace-cue.js agent package --review-index .browser-debug/review-artifacts/<id>.json --surface local-subscription-agent --json
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
node ./bin/trace-cue.js agentic review propose --brief "Review first impression, UI/UX, visible text, trust, and likely reader feeling." --review-index .browser-debug/review-artifacts/<id>.json --effort standard --json
node ./bin/trace-cue.js agentic review plan --proposal .browser-debug/agentic-human-review-proposals/<id>/proposal.json --json
node ./bin/trace-cue.js agentic review provider-readiness --plan .browser-debug/agentic-human-review-plans/<id>/plan.json --provider generic-api-provider --json
node ./bin/trace-cue.js agentic review run --plan .browser-debug/agentic-human-review-plans/<id>/plan.json --plan-hash <sha256> --allow-page-text --allow-url --allow-artifact-refs --allow-accessibility-summary --execute --json
AGENTIC_HUMAN_REVIEW_API_TOKEN=<tok> AGENTIC_HUMAN_REVIEW_API_TIMEOUT_MS=90000 AGENTIC_HUMAN_REVIEW_OPENAI_API_KEY=<key> AGENTIC_HUMAN_REVIEW_OPENAI_MODEL=<model> npm run ahr:responses-adapter -- --json
node ./bin/trace-cue.js agentic review human-baseline registry --json
node ./bin/trace-cue.js agentic review human-baseline overlay --case <benchmark-case-id> --json
node ./bin/trace-cue.js agentic review human-baseline draft --overlay <case-overlay-json> --json
node ./bin/trace-cue.js agentic review human-baseline approval --draft <baseline-draft-json> --decision approved --approver <owner-id> --approved-at <iso8601> --edit-diff <summary> --json
node ./bin/trace-cue.js agentic review human-baseline validate --input <owner-labeled-human-baseline> --json
node ./bin/trace-cue.js agentic review human-baseline compare --baseline <owner-labeled-human-baseline> --result .browser-debug/agentic-human-review-results/<id>/result.json --json
node ./bin/trace-cue.js agentic review human-baseline claim-readiness --evidence-set <agentic-evidence-set> --json
node ./bin/trace-cue.js agentic review claim standard-gate --evidence-set <agentic-evidence-set> --json
node ./bin/trace-cue.js visual review prepare --review-index .browser-debug/review-artifacts/<id>.json --json
node ./bin/trace-cue.js visual review run --preparation .browser-debug/visual-review-results/<id>/preparation.json --surface local-subscription-agent --provider fake-agent --model fake-model --execute --json
node ./bin/trace-cue.js visual review aggregate --preparation .browser-debug/visual-review-results/<id>/preparation.json --json
node ./bin/trace-cue.js capture handoff --image ./desktop.png --source desktop-app --json > capture-handoff.json
node ./bin/trace-cue.js review --image ./desktop.png --capture-handoff capture-handoff.json --json
node ./bin/trace-cue.js agent ingest --package .browser-debug/agent-packages/<id>/packet.json --input @agent-advisory-result.json --json
node ./bin/trace-cue.js agent report --review-index .browser-debug/review-artifacts/<id>.json --agent-result .browser-debug/agent-results/<id>.json --json
node ./bin/trace-cue.js target init --url http://127.0.0.1:3000/ --json
node ./bin/trace-cue.js target validate --target .browser-debug/targets/<id>.json --json
node ./bin/trace-cue.js review --url http://127.0.0.1:3000/ --viewport mobile --screenshot --report --json
node ./bin/trace-cue.js review --target ./trace-cue-target.json --json
node ./bin/trace-cue.js schema list --json
node ./bin/trace-cue.js schema get --name review --json
node ./bin/trace-cue.js mcp serve --json
node ./bin/trace-cue.js mcp serve --profile safe --json
node ./bin/trace-cue.js mcp serve --transport http --profile safe --host 127.0.0.1 --port 0 --json
node ./bin/trace-cue.js mcp config --profile safe --json
node ./bin/trace-cue.js mcp config --transport http --profile safe --host 127.0.0.1 --port 8765 --json
node ./bin/trace-cue.js mcp capabilities --profile admin --scope excluded --json
node ./bin/trace-cue.js identity audit --json
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
node ./bin/trace-cue-mcp.js --profile safe
node ./bin/trace-cue-mcp.js --profile full
node ./bin/trace-cue-mcp.js --profile admin
TRACE_CUE_MCP_HTTP_TOKEN=<token> node ./bin/trace-cue-mcp.js --transport http --profile safe --host 127.0.0.1 --port 8765
npm test
npm run test:rename-readiness
npm run test:browser
npm run test:pack
npm run test:pack-install
npm run release:check
```

MCP profiles are launch-time adapter profiles:

- `safe`: no-browser/no-delete/no-provider tool surface for discovery, schemas, target validation, resource status, artifact planning, read-only local agent advisory/status inspection, read-only visual review dashboard inspection, read-only capture planning, read-only release/artifact-root/alias/shell/final readiness inspection, read-only MCP execution gate inspection, and MCP capability policy inspection.
- `full`: current compatibility surface for local observe/review/target workflows. No-profile `trace-cue-mcp` and the packaged `.mcp.json` resolve to this profile.
- `admin`: explicit reserved local-maintenance profile. In this phase it exposes only the approved stdio `agent execution plan/run` bridge beyond `full`; it does not expose cleanup execution, unrelated provider/API execution, HTTP `full` or `admin`, socket transport, shell tools, external upload, profile reuse, provider credentials, or arbitrary process control.

The HTTP MCP transport is separate from the stdio compatibility default. It must be launched explicitly with `--transport http`, binds only to loopback hosts, requires a bearer token from `TRACE_CUE_MCP_HTTP_TOKEN` by default, and is limited to the `safe` profile in this phase. It does not change the packaged `.mcp.json`, does not expose `full` or `admin` over HTTP, and does not expose cleanup execution, provider/API execution, `agent execution run`, shell tools, external upload, profile reuse, or credential storage. Admin agent execution is stdio-only.

`trace-cue mcp config --json` is the normal discovery path for external repositories and MCP-capable agents. It emits token-free launch metadata and client connection examples for stdio or explicit safe HTTP, including `local_checkout` metadata for unpublished checkout use, without starting a server, writing configuration files, reading credentials, or exposing token values.

`trace-cue operation registry --json` reports the read-only operation registry, roadmap group mapping, risk taxonomy, required gates, current MCP exposure flags, and no-execution boundary metadata. It is a policy inspection surface only; registry entries do not authorize provider execution, cleanup execution, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, shell execution, or MCP write/execute expansion.

`trace-cue operation roadmap --json` reports draft phase A/B/C boundary contracts, phase order, group/risk classification, related registry operations, and approval-bound status without writing artifacts, issuing execution tokens, running live execution, triggering remote CI, or promoting Phase 61-155 into formal product-plan commitments.

`trace-cue operation contracts --json` reports Phase 61-64 risk taxonomy, gate schema, execute-token shape, receipt shape, and selected registry operation context without writing artifacts, issuing tokens, writing receipts, enabling a harness, running live execution, or promoting Phase 65-155 into formal product-plan commitments.

`trace-cue operation policy --json` reports Phase 65-68 admin policy defaults, CLI plan readiness, disabled harness readiness, safe MCP readiness, the approved admin-only agent execution exposure state, and selected registry operation context without mutating policy config, issuing tokens, writing receipts from the report, enabling a generic harness, running live execution from the report, or promoting Phase 79-155 into formal product-plan commitments.

`trace-cue operation admin-readiness --json` reports Phase 69-70 MCP admin execute-token flow readiness, MCP admin harness bridge readiness, and the approved admin-only agent execution bridge state without issuing tokens, storing tokens, dispatching the generic harness, running live execution from the report, or promoting Phase 79-155 into formal product-plan commitments.

`trace-cue operation provider-readiness --json` reports Phase 71-78 provider MCP plan, bounded disclosure, env credential guard, admin-only fake/local/API execution exposure, and safe MCP status/list readiness without calling providers, executing local runners, reading credential values, or transferring evidence from the readiness report.

`trace-cue release readiness --json`, `trace-cue artifact-root status --json`, `trace-cue identity aliases removal-readiness --json`, `trace-cue shell readiness --json`, and `trace-cue final readiness --json` report local release, artifact-root, alias-removal, constrained-shell, and final-hardening readiness only. The paired execute-style gates for publication, real artifact migration, alias removal, and shell execution fail closed until separately approved.

`trace-cue mcp capabilities --json` reports the current profile tool surfaces, supported transports, admin-only agent execution exposure, and registry-derived operations that are still excluded from MCP, including cleanup execution, visual review result preparation, visual review execution, visual review aggregation, desktop provider-preparation planning, raw-pixel visual provider execution, translation execution, npm publication, artifact-root migration, legacy alias removal, and constrained shell execution. Safe MCP includes read-only visual review dashboard, capture planning, operation registry, operation roadmap, operation contracts, operation policy, operation admin readiness, operation provider readiness, release readiness, artifact-root status, legacy alias audit/removal readiness, constrained shell readiness, final readiness, and MCP execution gate inspection only. It is read-only, does not start a server, and confirms that `agent execution plan/run` is available only in the stdio `admin` profile.

`docs/workflow/CONSUMER_USAGE.md` is packaged with the local tarball so installed or copied consumer workflows can find the CLI, MCP stdio, safe HTTP MCP, and Codex plugin connection paths without reverse-engineering this repository.

Product identity metadata is centralized in the package API and used by MCP metadata, CLI MCP metadata, identity audit, package dry-run checks, packed-install smoke checks, rename-readiness checks, and package/plugin/MCP alignment tests. The package name, CLI commands, MCP server name, plugin name, display name, repository URL, legacy repository URL, private package state, and license are explicit identity fields. The local checkout and GitHub repository now use `trace-cue`; artifact-root migration and legacy alias removal remain separate approval-bound work.

Artifacts are written under ignored `.browser-debug/` directories and are retained until the developer manually removes that local artifact root or explicitly runs `.browser-debug/`-scoped cleanup with `resource artifacts cleanup --execute`. `.trace-cue/` remains a future artifact-root migration target only. Trace artifacts can contain page content and must remain local. Review artifacts include local target manifests, review JSON, layout JSON, screenshots, mock metrics, coverage, review artifact indexes, action plans, local heuristic advisory data, local quality signals, optional content UX advisory, optional content UX handoff output, optional content UX review brief/rubric output, additive `resource_guard` output, and Markdown reports when requested. Agent advisory artifacts include local task packages, prompts, workflow manifests, request status/detail derived from local package/result artifacts, normalized advisory results, import receipts, workflow receipts, and Markdown advisory reports. Advisory package/request/workflow/ingest/report operations are local-only, do not run provider APIs, do not upload artifacts, do not store credentials, and do not change deterministic review findings, metrics, existing action plans, or release readiness. Visual review result preparation artifacts include metadata-only future result contracts and receipts under the local artifact root; they read review artifact indexes and visual evidence metadata only and do not read raw pixels, call providers, transfer evidence, expose MCP execution, or mutate existing reviews. Visual review execution artifacts include CLI-only execution status, normalized visual review results, and receipts; they run provider adapters from preparation metadata/local references only and do not read or transfer raw pixels, store raw provider responses or credential values, expose MCP execution, mutate existing reviews, or change release gates. `visual review aggregate --preparation <path> --json` reads existing local visual review result metadata for the selected preparation, groups untrusted advisory findings with source attribution, reports conflicts, writes no artifacts, runs no providers, reads no raw pixels, and remains out of MCP. `visual review dashboard --json` and the safe MCP dashboard tool read existing visual review preparation/execution/result metadata only; they write no artifacts, run no providers, read no raw pixels, and change no gates. `mcp execution gates --json` and the safe MCP gate tool report required gates for future MCP write/execute expansion only; they do not change MCP permissions, write artifacts, run providers, read credentials, read raw pixels, or change gates. `capture plan --json` and the safe MCP capture planning tool report screen, window, and desktop app capture gates only; they do not capture pixels, write artifacts, enumerate processes, call providers, transfer evidence, expose MCP execution, or change gates. `capture handoff --image <workspace-image> --source <screen|window|desktop-app> --json` summarizes an existing workspace image as caller-declared capture metadata only; it writes no artifacts, exposes no MCP tool, embeds no raw pixels in JSON, calls no providers, verifies no surface identity, and changes no gates. `review --image <workspace-image> --capture-handoff <workspace-json|-> --json` verifies that the handoff source path and media hash match the reviewed image before propagating screen, window, or desktop app provenance into visual evidence metadata; it still performs no OS capture, provider call, raw-pixel JSON embedding, external transfer, MCP execution, or human-equivalent judgment. Agent execution artifacts include dry-run execution plans, run receipts, dashboard status/list metadata, and normalized advisory results from provider adapters; execution requires a matching plan plus explicit `--execute`, keeps raw provider responses and credential values out of artifacts, and remains separate from review gates. `identity audit --json` reports current checkout name, current origin remote, repository rename state, legacy alias compatibility, and artifact-root migration boundaries without mutating Git, contacting remotes, launching browsers, or writing artifacts. `agent workflow create/status/index/report` lets dashboards track package-created, waiting-for-agent, imported-result, report-pending states, and local workflow summaries from local files only. `resource status` reads local memory, swap, cgroup, pressure, and process memory signals without launching a browser, writing artifacts, deleting caches, mutating swap, mutating system cache, uploading evidence, or reusing profiles. `resource artifacts plan` reports local artifact usage and cleanup candidates without deleting files; `resource artifacts cleanup --execute` deletes only selected regular files under the configured artifact root and writes a local receipt. `target validate` checks edited target manifests without launching a browser, mutating the manifest, uploading evidence, reusing profiles, or printing sourceData values. Quality signals summarize visual hierarchy, rendered state, responsive layout, interaction affordance, accessibility structure, evidence completeness, route budget coverage, page expectations, optional content UX advisory, local release readiness, developer handoff, and the disabled model-review boundary. `review --url` can flag broken visible images, explicit lingering loading UI, and empty table/list/grid states as local evidence-backed first-pass findings while avoiding normal ready/progress business-state text. `review --resource-guard fail-critical` can stop before browser launch when local resource status is critical; the default advisory mode reports resource pressure without changing review findings, `metrics.finding_count`, existing action plans, or release readiness. `review --target` visits manifest `expectedRoutes` within scope, can check optional `pages` expectations for visible text and selectors, can apply page-specific mock metrics, records route-budget-exceeded skips when `budgets.maxRoutes` prevents full coverage, emits manifest suggestions for better dogfood reruns, and can emit `local_content_ux_advisory`, `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, `content_ux_page_handoff`, `content_ux_manifest_authoring`, `content_ux_review_brief`, and `content_ux_rubric_evaluation` only when `localContentUxAdvisory.enabled=true` is declared in the target manifest. Content UX advisory uses bounded inline `sourceData`, page `expectations.dataBindings`, optional selectors, attribute/state/risk targets, `requiredUserQuestions`, optional `reviewBrief`, and optional `rubric`; it is advisory-only and does not change review findings, metrics, existing action plans, or release readiness. `supervise` keeps one ephemeral browser context alive only for that CLI process and closes it before exit. `daemon start` keeps a local ephemeral browser worker alive until `daemon stop`, optional idle timeout, or optional max lifetime, and controls it only through local process signals and metadata. The MCP stdio adapter exposes profile-gated local tools, read-only local agent surfaces, request status/detail, workflow status/index, execution status/list, read-only MCP capability policy inspection, and the approved stdio `admin` agent execution plan/run bridge. The HTTP MCP transport exposes only the `safe` profile over an explicit loopback bearer-token endpoint. MCP still excludes shell tools, cleanup execution tools, external upload, profile reuse, OAuth, credential handling, package generation, ingest, report writing, workflow creation, visual review aggregation, execution outside stdio `admin` agent execution plan/run, provider/API execution outside the approved agent execution adapter path, and `full`/`admin` HTTP tools. The repository also contains plugin metadata under `.codex-plugin/`, `.mcp.json`, and `skills/trace-cue-review/`; marketplace installation, license changes, and npm publication remain separate approval-bound release work. `npm test` runs deterministic no-browser tests; `npm run test:rename-readiness` checks identity and rename readiness; `npm run test:browser` launches local Chromium for smoke coverage; `npm run test:pack` runs a local dry-run package check without publishing; `npm run release:check` combines no-browser, rename-readiness, and package checks without publishing.

`visual review plan --capture-handoff <workspace-json|-> --json` creates a read-only desktop review provider-preparation plan from capture handoff metadata only. It rereads no image bytes, writes no artifacts, exposes no MCP tool, calls no providers, transfers no evidence, and changes no gates.

`npm run test:pack`, `npm run test:rename-readiness`, and `npm run test:pack-install` use identity-derived `/tmp` paths and local metadata checks. They validate the packed tarball and rename-readiness boundaries without publishing or registry install, and `npm run release:check` includes these checks alongside no-browser tests.

Phase 29 agent execution stays separate from the current advisory workflow. It adds dry-run execution plans, explicit `--execute` plus `--execution` run gating, isolated provider adapters, deterministic fake provider execution, configured local runner callbacks, env-only generic API execution, execution status/list records, schema/API parity, dashboard handoff metadata, local receipts, and normalized advisory results without changing deterministic review findings, metrics, existing action plans, release readiness, resource guard output, artifact cleanup behavior, or existing workflow status meanings. API execution remains limited to bounded package/prompt disclosure through the generic adapter; stdio `admin` MCP exposure reuses this same bounded path, while provider SDK expansion, persistent credentials, raw provider response storage, MCP execution beyond approved agent execution plan/run, and broader external evidence transfer remain approval-bound.

## Canonical Documents

- `docs/product/REQUIREMENTS.md`
- `docs/product/SPECIFICATION.md`
- `docs/product/IMPLEMENTATION_PLAN.md`
- `docs/workflow/TASK_TRACKER.md`
- `docs/workflow/HANDOFF.md`

## Local Checks

```bash
./tools/product-gate
./tools/check_product_ci.sh
```

GitHub Actions CI is defined in `.github/workflows/ci.yml`, validated by `ops/CI_MANIFEST.tsv`, and hosted at `https://github.com/xxxMasahiro/trace-cue`. Current branch synchronization and main CI verification are performed through the release workflow before publication.
Release status and publication blockers are tracked in `CHANGELOG.md` and `docs/workflow/RELEASE.md`.

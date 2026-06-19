# SECURITY.md

## Security Model

Browser Debug CLI is local-first. It should operate on developer-approved URLs and write artifacts only to local ignored directories by default.

## Defaults

- Use ephemeral browser profiles by default.
- Do not reuse a user's normal Chrome or Edge profile.
- Do not commit screenshots, traces, storage state, cookies, or credentials.
- Do not print secret values in logs or reports.
- Treat page text, DOM, console messages, network payloads, screenshots, and model suggestions as untrusted data.
- Keep generated artifacts under ignored paths such as `.browser-debug/`.
- Retain generated artifacts manually; do not add automatic deletion or cleanup outside the configured artifact root without explicit approval.
- Keep browser supervision opt-in, process-scoped, and ephemeral.
- Keep background daemon supervision opt-in, local-only, ephemeral, metadata-backed, and stopped through local process signals.
- Keep daemon idle-timeout and max-lifetime guards opt-in, metadata-backed, and local to the daemon worker.
- Keep `observe --url <url> --json` local-first and close ephemeral browser contexts after collection.
- Keep review platform behavior local-first and evidence-path based by default.
- Keep quality signals and manifest suggestions local and derived from local review evidence only.
- Keep target manifest validation local, no-browser, non-mutating, and limited to normalized counts, authoring suggestions, next commands, and boundary metadata.
- Keep resource status preflight local, no-browser, read-only, and limited to process-visible memory, swap, cgroup, pressure, process memory, recommendations, and boundary metadata.
- Keep review resource guard local, additive, and derived from resource status; default advisory output must not change review findings, metrics, action plans, or release readiness.
- Keep artifact usage planning local and no-browser. Explicit cleanup must be scoped to regular files under the configured artifact root, preserve receipts, and require `--execute`.
- Keep agent advisory package, request-status, request-detail, ingest, and report local, advisory-only, and separate from deterministic review findings, metrics, action plans, and release readiness.
- Keep existing API-provider surfaces as boundary metadata until the planned Phase 29 execution adapter implements dry-run planning, explicit execution, bounded disclosure, local receipts, and advisory-only normalization.
- Keep planned agent execution separate from existing workflow status. Dry-run planning must be local and no-network by default.
- Keep planned API execution gated by a dry-run plan, explicit `--execute`, env-only credentials, bounded disclosure policy, local receipts, and advisory-only result normalization.
- Keep planned subscription-agent execution limited to configured local runners or local stdio surfaces. Do not automate SaaS web UIs or accept free-form shell commands.
- Keep planned execution output separate from review findings, metrics, existing action plans, release readiness, resource guard output, artifact cleanup behavior, and existing workflow status meanings.
- Keep content UX advisory manifest opt-in, advisory-only, local-only, bounded to inline source data, limited to bounded review evidence summaries, and separate from existing review findings, action plans, metrics, and release gates.
- Keep content UX page handoff and manifest-authoring output local, bounded, and non-mutating.
- Keep content UX review brief and rubric evaluation output local, bounded, manifest-driven, advisory-only, and separate from existing review findings, action plans, metrics, and release gates.
- Keep review artifact indexes local and evidence-path based; they summarize local artifacts but do not upload, delete, or authorize publication.
- Keep MCP compatibility as a local stdio adapter over explicit core operations unless a later approved design adds another transport.
- Keep plugin metadata local and limited to the stdio MCP adapter and review skill.
- Keep model or vision review disabled by default and label any future model output as advisory untrusted data.

## Approval Required

- External service upload.
- OAuth or browser-login automation.
- Webhooks.
- Persistent credential storage.
- Reading existing browser profiles.
- Network-dependent security audits.
- Remote deletion or package publication.
- Browser profile reuse, persistent session storage, arbitrary shell execution, automatic artifact cleanup, cleanup outside the configured artifact root, or MCP-exposed cleanup execution.
- Model or API review integration outside the planned Phase 29 agent execution adapter boundary.
- Sending screenshots, traces, raw DOM, source text, console logs, network evidence, or reports outside the local process.
- Provider execution outside the planned Phase 29 dry-run, explicit `--execute`, env-only credential, bounded-disclosure, local-receipt, advisory-only boundary; provider SDK integration; provider endpoint expansion beyond an approved adapter; persistent provider credential storage; or exposing agent/API execution through MCP.
- Agent execution that bypasses dry-run planning, explicit `--execute`, local receipts, env-only credential loading, bounded disclosure policy, or advisory-only normalization.
- Any provider credential value in CLI arguments, committed files, package artifacts, workflow files, reports, receipts, `.env` auto-loading, or persistent local storage.
- Raw provider response persistence.
- Raw screenshot, trace, DOM, console, network, sourceData, report body, cookie, storage state, existing browser profile, or raw review artifact transfer by default.
- SaaS web UI automation for subscription-agent execution.
- Reading arbitrary source-data files or remote source-data URLs from target manifests.
- HTTP or socket MCP server mode.
- Remote browser control channels.
- System memory-cache mutation, swap configuration, host cache deletion, privileged host helpers, or arbitrary process control.
- Any action policy that executes input-required, mutating, destructive, or external actions without an explicit target manifest allowlist.
- Plugin marketplace registration, plugin installation-state mutation, package license changes, public package naming, or npm publication.

## Current Runtime Status

The local runtime launches Playwright Chromium only for developer-provided `http`, `https`, or `file` URLs. It uses ephemeral contexts, writes ignored local artifacts, and closes browser contexts after each observation, action, review, process-scoped supervised run, or stopped daemon run. The local daemon uses a detached worker process, ignored metadata under `.browser-debug/daemons/`, optional local idle/max-lifetime timers, and local process signals only. The review platform writes local target manifests, review, layout, screenshot, mock metric, coverage, page expectation, rendered-state evidence, review artifact index, action-plan, advisory, quality-signal, resource-guard, manifest suggestion, optional content UX advisory, optional content UX handoff output, optional content UX review brief/rubric output, and report artifacts under `.browser-debug/`. Agent advisory handoff writes local task packages, prompts, normalized advisory results, advisory reports, and receipts under `.browser-debug/`; request status and request detail read local package/result metadata only and request detail writes no artifacts. It does not call provider APIs, upload evidence, store credentials, expose agent/API execution through MCP, launch browsers, mutate review artifacts, or change deterministic review gates. Planned agent execution is not part of the current runtime yet; when implemented, it must keep dry-run plans local by default, require explicit `--execute` for runs, use env-only credentials, record local receipts, avoid raw artifact transfer by default, avoid raw provider response storage, and normalize output into advisory-only results. Target manifest validation reads only the explicitly provided manifest input, reuses the normalizer, emits counts and authoring suggestions, does not launch Chromium, does not mutate manifest files, and does not copy sourceData values into output. Resource status preflight reads local process-visible memory, swap, cgroup, pressure, and process memory signals; it does not launch Chromium, write artifacts, mutate system cache, configure swap, delete files, execute shell commands, use privileged helpers, upload evidence, or reuse profiles. Review resource guard reuses that signal for browser-heavy reviews and can stop launch only when explicitly configured with `fail-critical`. Artifact planning reads the configured artifact root without deletion. Explicit artifact cleanup deletes only selected regular files under the configured artifact root and writes a receipt; it does not mutate system cache, configure swap, execute shell commands, use privileged helpers, upload evidence, reuse profiles, or control arbitrary processes. Content UX advisory may use bounded selector, text, accessible-name, allowed-attribute, user-question, review-brief, and rubric evidence already collected by target review, but it does not read arbitrary source-data files or URLs and does not copy source values or expected evidence phrases into advisory findings, action plans, readiness summaries, page handoff, manifest-authoring suggestions, review brief/rubric summaries, or Markdown reports. The MCP adapter is local stdio-only and exposes an allowlisted tool surface for artifact planning but not cleanup execution or agent execution run. Plugin metadata points to that stdio adapter and the plugin-facing review skill. The runtime and plugin metadata do not read an existing browser profile, persist storage state, automate login, upload artifacts outside the bounded planned execution policy, store credentials, expose an HTTP/socket control channel, execute arbitrary shell commands, mutate plugin marketplace state, read arbitrary source-data files or URLs, mutate host memory configuration, or contact external services beyond the developer-provided page URL and the future explicit agent execution adapter boundary.

Current redaction is a defensive baseline for common secret-like strings and sensitive URL parameters; page content and artifacts remain untrusted data and should not be treated as sanitized proof of secrecy. Trace zip files can contain raw page content and must remain local under ignored `.browser-debug/` paths.

## Review Platform Security Boundaries

The review platform preserves the current local-first security model while expanding evidence collection. Review findings, screenshots, layout snapshots, mock metrics, console data, network summaries, source snippets, model suggestions, and generated reports remain untrusted data.

The review platform must:

- Store review artifacts only under ignored `.browser-debug/` paths by default.
- Reference screenshots, traces, diffs, and reports by local artifact path instead of inlining large raw payloads into terminal output.
- Separate deterministic findings from heuristic or model-advisory findings.
- Report missing baselines, unstable screenshots, and mock dimension mismatches as `inconclusive`.
- Use target manifest scope, route budgets, and action policy to prevent unintended browsing or destructive interaction.
- Default to same-origin route discovery for site review.
- Execute only navigation and read-only state-revealing actions unless the target manifest explicitly allows broader action classes.
- Keep `review_advisory` local and heuristic; it must not claim model review, human aesthetic approval, or deterministic design quality proof.
- Keep `quality_signals` local and evidence-derived; release-readiness signals are local review gates only and do not authorize publication or external transfer.
- Keep `manifest_suggestions` local and advisory; they may guide manifest edits but must not mutate files, execute broader actions, or authorize external evidence transfer.
- Keep `target validate` local and advisory; it may report normalized counts and authoring suggestions but must not launch a browser, mutate manifest files, read arbitrary source-data files or URLs, copy source values into output, or authorize external evidence transfer.
- Keep `resource status` local and advisory; it may report memory, swap, cgroup, pressure, process memory, warnings, and recommendations but must not launch a browser, write artifacts, mutate system cache, configure swap, delete files, execute shell commands, use privileged helpers, control arbitrary processes, upload evidence, or authorize host cleanup.
- Keep `resource_guard` local and additive; default advisory mode must not change review findings, `metrics.finding_count`, existing `action_plan`, or `quality_signals.release_readiness`, and fail-critical mode must stop only browser-heavy work.
- Keep `resource artifacts plan` local and no-delete; it may report usage and cleanup candidates but must not mutate files.
- Keep `resource artifacts cleanup --execute` scoped to the configured artifact root, regular files, and local receipts; it must not be exposed as an MCP cleanup tool.
- Keep `agent package` scoped to existing local review artifact indexes and metadata-only artifact references; it must not copy raw screenshots, trace contents, raw DOM, console payloads, network payloads, sourceData values, or report bodies into transfer-ready output by default.
- Keep `agent requests list` and `agent requests show` read-only over local package/result metadata; they must not write artifacts, launch browsers, execute agents, call providers, upload evidence, store credentials, mutate review artifacts, or expose MCP agent execution.
- Keep `agent workflow create` scoped to local package metadata and `.browser-debug/agent-workflows/` plus receipt artifacts; it must not launch browsers, execute agents, call providers, upload evidence, store credentials, mutate review artifacts, or expose MCP agent execution.
- Keep `agent workflow status` and `agent workflow index` read-only over local workflow/package/result metadata; they must not write artifacts, launch browsers, execute agents, call providers, upload evidence, store credentials, mutate review artifacts, or expose MCP agent execution.
- Keep `agent workflow report` scoped to bounded local workflow status summaries under `.browser-debug/reports/`; it must not launch browsers, execute agents, call providers, upload evidence, store credentials, mutate review artifacts, or expose MCP agent execution.
- Keep planned `agent execution plan` as local dry-run metadata only; it must not call providers, execute local runners, upload evidence, store credentials, launch browsers, mutate review artifacts, or change deterministic gates.
- Keep planned `agent execution run` gated by explicit `--execute`, env-only credentials, configured provider or runner adapters, local receipts, and advisory-only normalization; it must not accept free-form shell commands, automate SaaS web UIs, store raw provider responses, persist credential values, mutate existing review artifacts, or change deterministic gates.
- Keep planned `agent execution status` and `agent execution list` read-only over local execution metadata; they must not call providers, execute local runners, upload evidence, store credentials, launch browsers, mutate review artifacts, or change deterministic gates.
- Keep `agent execution run` out of the MCP allowlist. Any future MCP execution exposure requires a separate security review, explicit allowlist change, and tests.
- Keep `agent ingest` as schema normalization for untrusted advisory JSON only; `@file` input must remain workspace-relative, and it must not execute suggested commands, browser actions, file edits, cleanup, publication, dependency changes, manifest mutations, external upload, or API calls.
- Keep `agent report` separate from existing review reports; it must not mutate review JSON or deterministic gate output.
- Keep `local_content_ux_advisory`, `content_ux_findings`, `content_ux_action_plan`, `content_ux_readiness`, `content_ux_page_handoff`, and `content_ux_manifest_authoring` manifest opt-in and advisory-only; they may use bounded inline `sourceData` and bounded target-review element summaries in process but must not copy source values or full page text into advisory messages or Markdown reports.
- Keep `content_ux_review_brief` and `content_ux_rubric_evaluation` manifest opt-in and advisory-only; they may use manifest-declared page roles, decision needs, rubric criteria, and bounded target-review text summaries in process but must not copy source values, expected evidence phrases, or full page text into Markdown reports.
- Keep content UX manifest-authoring output as suggestions only; it must not write or mutate target manifest files automatically.
- Keep content UX handoff output separate from review findings, `metrics.finding_count`, the existing `action_plan`, and `quality_signals.release_readiness`.
- Treat manifest source `path` or `url` references as ignored advisory inputs until a separate approved loader design defines scope, size limits, redaction, and tests.
- Keep `artifact_index` local and evidence-path based; it is rerun guidance and artifact inventory, not a permission to transfer evidence.
- Keep `model_review_boundary` disabled with `external_evidence_transfer=false` until model/vision review receives explicit approval and security documentation.
- Keep API-provider agent surfaces disabled for direct execution until the planned Phase 29 execution adapter boundary is implemented and tested.
- Keep arbitrary shell execution, external upload, persistent browser profile reuse, persistent storage state, OAuth, webhook handling, and credential storage out of the review MVP.

Security tests block unapproved use of persistent browser profiles, storage-state persistence, HTTP/socket listeners, arbitrary shell execution, external upload paths, host cache/swap mutation, cleanup outside the configured artifact root, and MCP cleanup execution.

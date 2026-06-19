# DEVELOPER_MEMORY.md

## Pre-Implementation Proposal Record

This work was handled as the `proposal` phase of `repository-development-workflow`.
The local skill file, the parent `AGENTS.MD`, the product-local `AGENTS.MD`,
and the product requirements, specification, implementation plan, task tracker,
and handoff were reviewed. No files were changed during the proposal review.

Five xhigh sub-agents were used to review the proposal from separate angles:
architecture, visual review feasibility, security, full Control Center validation,
and ecosystem/API design.

## Coordinated Conclusion

The direction is valid. The correct framing is not to build Playwright itself.
The correct framing is to build a Playwright-powered review and evidence core
with a CLI adapter and an MCP adapter on top of the same core.

The goal should be defined as follows:

`browser-debug-cli` should become a CLI-first browser validation platform that
can also expose the same core through MCP. It should crawl all Control Center
pages, collect DOM, CSS, JavaScript, console, network, screenshot, trace, and
mock-difference evidence, then report issues and improvement suggestions to
developers.

The claim that the tool includes MCP with no disadvantages should be softened.
MCP's value is ecosystem compatibility. The strongest design is to keep the CLI
as the source of truth and make MCP a thin stdio adapter over the same core.

## Adopted Direction

- Build a shared core and keep CLI/MCP as adapters.
- Start with deterministic evidence collection and rule-based findings, not
  broad subjective AI judgment.
- Make `browser-debug review --target <manifest> --json` the central command.
- Avoid hard-coded branches for ports `5173` and `5174`; use target manifests.
- Give every finding separate `severity` and `confidence` values.
- Describe the product as an automated first-pass review partner rather than a
  full replacement for human product judgment.
- Keep model or vision review as a later explicit opt-in feature.

## Main Architecture

- `playwright-runtime`: owns browser, page, context, action, screenshot, and
  trace behavior.
- `evidence-model`: normalizes DOM, accessibility, bounding box, computed style,
  console, network, and viewport evidence.
- `review-engine`: detects overflow, clipping, overlap, missing labels, console
  errors, failed requests, mock differences, and related issues.
- `site-review`: owns route discovery, viewport matrix execution, action risk
  policy, and coverage.
- `reporter`: emits `issues.json`, `issues.md`, screenshots, diffs, and trace
  references.
- `schema`: defines JSON Schema for envelopes, findings, artifacts, target
  manifests, and MCP tool input/output.
- `cli-adapter`: exposes `browser-debug review`.
- `mcp-adapter`: exposes `browser-debug-mcp` or `browser-debug mcp serve`, with
  the initial adapter limited to stdio/local behavior.

## Implementation Roadmap

1. Specification and document sync.
   Update requirements, specification, implementation plan, security,
   verification, task tracker, and handoff to describe the review engine, target
   manifests, MCP adapter, schemas, and security boundaries.

2. Review MVP.
   Implement `browser-debug review --url ... --viewport ... --screenshot --json`
   for one URL. Detect console errors, failed requests, horizontal overflow,
   clipped text, missing labels, and empty renders as evidence-backed findings.

3. Target Manifest and Site Review.
   Add a manifest with `baseUrl`, seed routes, scope, viewport matrix, action
   policy, and budgets. Control Center targets should be example manifests, not
   runtime-specific code paths.

4. Route Discovery.
   Build a route graph from anchors, hash routes, history navigation, visible
   navigation, and optional app manifests. Report visited, skipped, failed, and
   expected-but-missing routes.

5. Mock Comparison.
   Add `--mock`, `--mask`, and `--region`. Produce pixel and region diffs.
   Dimension mismatches and unstable renders should return `inconclusive`.

6. MCP Adapter.
   Expose the same core through a thin local stdio adapter. Initial tools should
   focus on observe, review, run, report, and schema.

7. Model or Vision Review.
   Keep model review fully opt-in. Explicitly disclose which evidence classes
   would be sent outside the local process. Trace, raw DOM, screenshot, and
   source sharing remain approval-bound.

8. Agent Workflow and Execution Handoff.
   Keep agent workflows as local package/prompt/result/report state tracking for
   dashboards and local automation. Agent execution is a separate Phase 29 layer
   with dry-run plans, explicit `--execute`, bounded disclosure, local receipts,
   and advisory-only normalization; broader provider expansion remains
   approval-bound and must not replace the local workflow manifest, status,
   index, or report contract.

## Important Risks

- Model review is a data-exfiltration boundary. Screenshots, DOM, traces,
  console logs, and network evidence can contain secrets.
- MCP expands the control surface. HTTP or socket listeners should not be part
  of the initial adapter.
- The current `session act` behavior is closer to evidence history than a true
  persistent browser session; live review sessions need clearer semantics.
- Before npm publication, the package file set must avoid shipping internal
  workflow documents or one-off Control Center context.
- Inline JSON action input is fragile for shell usage. Add `--actions @file`
  and `--input -`.

## Acceptance Criteria

- CLI and MCP call the same core and return equivalent schemas.
- `review` findings include `category`, `severity`, `confidence`, `selector`,
  `rect`, `evidence`, `artifacts`, and `repro` data.
- Route, viewport, and action coverage are emitted as JSON and Markdown.
- Evidence remains under ignored `.browser-debug/` paths.
- Runtime code does not contain target-specific branches for the two Control
  Centers.
- Agent workflow status/index can track local advisory handoff state without
  provider API calls, external upload, credential storage, or review gate
  mutation.
- Model/API calls, profile reuse, OAuth, external upload, and destructive
  cleanup remain opt-in or approval-bound.

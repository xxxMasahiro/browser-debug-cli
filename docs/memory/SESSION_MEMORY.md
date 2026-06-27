# SESSION_MEMORY.md

## Reset Notice

The previous session memory was intentionally cleared at the developer's request on 2026-06-27.

This file now records only the pre-implementation draft roadmap for the TraceCue Agentic Human Review feature. This is a draft roadmap, not a formal product plan, release commitment, live execution permission, provider/API transfer approval, or MCP execution approval. Do not promote this roadmap into `docs/product/*` unless the developer explicitly approves that promotion.

## TraceCue Agentic Human Review Draft Roadmap

### Basic Concept

Add a review capability to TraceCue that is close to a substitute for a human reviewer. The target is not limited to UI/UX. It includes web pages, images, screenshots, text shown on the screen, information architecture, first impression, emotional reception, subjective user perception, and improvement suggestions.

AI agents should operate as multiple sub-agents, and the review depth should vary according to a user-selectable effort mode. The result must remain `advisory-only` and must not be mixed into existing deterministic findings or gate decisions.

### Slice 26: Human Review Boundary And Enforcement

Purpose:
- Define the scope of human-substitute review.
- Treat visual acuity, recognition ability, comprehension, reading ability, sensitivity, subjective review, and "how a person viewing this page would feel" as explicit review targets.
- Separate deterministic findings from agent advisory output.
- Mechanically enforce plan/run separation, plan hash validation, approval receipts, MCP execution prohibition, and advisory-only result writing.

Deliverables:
- Human review boundary contract.
- Advisory-only writer contract.
- Plan/run separation.
- Plan hash and approval receipt model.
- MCP transfer and execution exclusion for the initial stage.
- Regression tests proving that agent advisory output cannot mutate deterministic findings or gate status.

### Slice 27: Review Plan And Human Explanation

Purpose:
- Generate a review plan from a user's natural-language request.
- Explain, in non-engineer-readable language, what will be reviewed, from what perspective, with which sub-agents, at what effort level, and what information may be transferred.
- Require developer approval before any provider execution or deep review begins.

Deliverables:
- `agentic review plan` command.
- Human-readable review explanation.
- Exact command preview.
- Disclosure summary.
- Approval prompt metadata.
- Plan artifact with stable hash.
- No-execution guarantee for planning.

### Slice 28: Multimodal Review Package

Purpose:
- Build a structured package for the AI agents.
- Include visual evidence and content evidence together rather than sending only an image.
- Keep every transferable input controlled by explicit permission flags.

Deliverables:
- Review package schema.
- Image and screenshot references.
- Extracted screen text.
- DOM text summary.
- Accessibility or semantic structure summary.
- URL, route, viewport, target audience, expected impression, rubric, user questions, and existing evidence references.
- Transfer-scope metadata for raw pixels, page text, DOM summary, URL, and artifact references.

### Slice 29: Effort Mode And Sub-Agent Orchestration

Purpose:
- Implement flexible review effort selection.
- Separate the overall review effort from individual sub-agent effort.
- Allow role-specific effort overrides so the user or coordinating agent can tune review depth without manually composing complex commands.

Effort model:

```text
review_effort   = sub-agent count, roles, and review rounds
subagent_effort = reasoning depth for each sub-agent
```

Default modes:

| Mode | Default behavior |
| --- | --- |
| `quick` | 1 agent. Review first impression and obvious visual or text problems. |
| `standard` | 3 agents. Split Visual/UX, Content/Copy, and Accessibility/Comprehension. |
| `deep` | 5+ agents. Independently review visual quality, reading comprehension, sensitivity, flow, risk, and improvement suggestions. |
| `xhigh` | Multiple rounds. Include critic, verifier, and synthesis roles to re-check contradictions and missed issues. |

Sub-agent roles:
- Visual Reviewer.
- UX Reviewer.
- Content Reviewer.
- Audience Reviewer.
- Accessibility Reviewer.
- Risk Reviewer.
- Synthesis Agent.

Deliverables:
- `review_effort` schema.
- `default_subagent_effort` schema.
- `role_efforts` override schema.
- Provider effort mapping when supported.
- Fallback behavior when the provider does not support reasoning effort directly.
- Multi-agent result collation.

### Slice 30: CLI-Only Approved Execution

Purpose:
- Make the first executable implementation CLI-only.
- Let the agent decide an appropriate command during the CLI conversation, but require TraceCue owner-layer validation before execution.
- Reject execution unless the approved plan hash, `--execute`, and required transfer permission flags match.

Example planned command shape:

```bash
trace-cue agentic review run \
  --plan <approved-plan-path> \
  --allow-raw-pixels \
  --allow-page-text \
  --execute \
  --json
```

Boundaries:
- No automatic execution.
- No MCP image transfer.
- No MCP page-text transfer.
- No MCP agentic review execution in the initial stage.
- Provider credentials are env-only.
- Raw provider responses are not stored.
- Results are advisory-only.

Deliverables:
- `agentic review run` command.
- Owner-layer plan validation.
- Transfer permission validation.
- Provider capability validation.
- Receipt writing.
- Fake provider execution path.
- Injected transport test path.

### Slice 31: Human Review Rubric And Output Contract

Purpose:
- Avoid dependence on free-form prompts.
- Define the human-review criteria as schemas.
- Support subjective review, including "how a person viewing this page would feel", while keeping evidence, confidence, uncertainty, and disagreement explicit.

Rubric areas:
- First impression.
- Visual perception.
- UI/UX clarity.
- Readability.
- Meaning and comprehension.
- Copy and tone.
- Trust and credibility.
- Emotional reception.
- Information architecture.
- Flow and next action clarity.
- Accessibility and comprehension.
- Risk and misleading content.
- Strengths.
- Improvement suggestions.

Deliverables:
- Human review rubric schema.
- Prompt template contract.
- JSON-only output normalization.
- Malformed provider response handling.
- Confidence model.
- Evidence reference model.
- Uncertainty and dissent model.

### Slice 32: Advisory Result, Consensus, And Reports

Purpose:
- Integrate AI-agent review output into the existing advisory layer.
- Preserve each sub-agent's view while also producing a readable synthesis.
- Make the output useful to non-engineers without hiding evidence, uncertainty, or disagreement.

Deliverables:
- `agentic_human_review_advisory` result type.
- Per-sub-agent opinion records.
- Consensus summary.
- Dissent and contradiction summary.
- Subjective audience-reaction summary.
- Evidence references to image regions, text snippets, route, viewport, and package inputs.
- Confidence and severity.
- Suggested fixes.
- Report, dashboard, and aggregate compatibility.
- Mechanical separation from deterministic findings, `metrics.finding_count`, and gate status.

### Slice 33: Disclosure, Safety, And Product Gate

Purpose:
- Make the safety boundary mechanically enforceable rather than relying on protocol text.
- Synchronize workflow, security, verification, schemas, and package smoke coverage.
- Pass the product gate with explicit regression tests for the new boundaries.

Deliverables:
- Disclosure summary for images, screenshots, page text, DOM summary, URL, and artifact references.
- Pixel and content transfer receipt.
- Optional future region allowlist/blocklist and masking design.
- Secret and redaction regression tests.
- No credential persistence tests.
- No raw provider response storage tests.
- MCP transfer and execution exclusion tests.
- Advisory-only separation tests.
- Product gate coverage.

## Expected Flow

```text
Natural-language request
 -> trace-cue agentic review plan
 -> non-engineer-readable explanation of review scope
 -> developer approval
 -> plan hash and approval receipt
 -> trace-cue agentic review run --plan ... --execute
 -> owner-layer validation
 -> sub-agent review
 -> consensus report
```

## Mechanical Enforcement Requirements

- Planning must not execute providers.
- Provider execution must require an approved plan.
- The run command must reject a modified or mismatched plan hash.
- Raw pixels, page text, DOM summary, and other transferable inputs must require explicit permission flags.
- MCP-based image transfer, page-text transfer, and agentic review execution must remain unavailable in the initial implementation.
- AI-agent output must be written only to `agentic_human_review_advisory`.
- AI-agent output must not mutate deterministic findings, `metrics.finding_count`, release readiness, or gate status.
- Raw provider responses must not be stored.
- Credentials must be env-only and must never be written to artifacts, receipts, reports, tests, logs, or committed files.
- Product-local tests must prove every boundary above.

## Initial MVP Scope

The realistic first implementation scope is Slice 26-30:

- CLI-only.
- Fake provider plus injected transport.
- Natural-language plan generation with human-readable explanation.
- Developer approval before execution.
- Plan hash and receipt.
- `--execute` required.
- Raw pixels and page text individually permission-gated.
- MCP image and text transfer prohibited.
- Results remain advisory-only.
- Deterministic findings and gate decisions remain unchanged.

## Approval Boundaries

The following remain separately approval-bound:

- Raw pixel transfer through MCP.
- Page text or DOM transfer through MCP.
- Agentic review execution through MCP.
- External API transfer by default.
- Provider SDK additions.
- Persistent credential storage.
- Raw provider response storage.
- Automatic review execution.
- Promotion into deterministic findings.
- Promotion into release gates or product gates.
- Claims that the feature provides guaranteed human-equivalent or human-superior judgment.

## Follow-Up Draft Roadmap: Slices 34-42

This section extends the TraceCue Agentic Human Review draft roadmap after the Slice 26-33 foundation. It remains a draft roadmap, not a formal product plan, release commitment, provider/API transfer approval, MCP execution approval, or approval to weaken the safety boundaries already implemented.

Step 1 has been completed separately:
- The local Slice 26-33 implementation was pushed to `origin/main`.
- GitHub Actions `CI` completed successfully for commit `6498667`.
- The local working tree was clean and synchronized with `origin/main` after CI success.

### Slice 34: Conversational Review Request Intake

Purpose:
- Allow developers and non-engineers to request an agentic review without manually composing complex commands.
- Convert a natural-language review request into a structured review intent.
- Keep this step planning-only, with no provider execution, no external transfer, and no MCP exposure.

Deliverables:
- `agentic review propose` command.
- `--brief`, `--input`, and `@file` support.
- Structured review intent containing target, purpose, target audience, expected impression, requested review areas, and effort candidates.
- Non-engineer-readable explanation of what the review would inspect.
- No-execution guarantee for proposal generation.

Completion criteria:
- A natural-language request can produce a readable review proposal.
- The proposal does not execute `agentic review plan` or `agentic review run`.
- MCP exposure remains unavailable.

### Slice 35: Proposal-To-Plan Candidate Conversion

Purpose:
- Convert a conversational proposal into a candidate input for the existing `agentic review plan` flow.
- Explain required evidence-transfer permissions before a plan hash is finalized.
- Make approval content understandable before any execution can happen.

Deliverables:
- Effort-mode inference.
- Role-specific effort inference.
- Required transfer-flag explanation for raw pixels, page text, DOM summary, URL, and artifact references.
- Exact command preview for the next planning step.
- Human-readable safety and disclosure summary.

Completion criteria:
- The user can see what evidence would be used and why.
- The proposal identifies required transfer permissions in plain language.
- No plan/run approval gate is bypassed.

### Slice 36: Safe Bridge From Proposal To Existing Plan/Run

Purpose:
- Connect `agentic review propose` to the already implemented plan/run safety layer.
- Reuse the existing plan hash, `--execute`, transfer-flag, advisory-only, and MCP-exclusion mechanisms.
- Ensure a convenience flow cannot become a bypass path.

Deliverables:
- Agentic review proposal schema.
- Proposal receipt.
- `agentic review plan --proposal <path>` support.
- Proposal-to-plan provenance metadata.
- Regression tests proving that proposal output cannot run providers directly.

Completion criteria:
- A proposal can create a normal `agentic review plan`.
- The resulting plan still requires plan hash validation and exact run flags.
- Existing `agentic review plan/run` safety behavior remains unchanged.

### Slice 37: Real AI Provider Readiness

Purpose:
- Define real provider connection requirements before allowing provider calls.
- Keep the implementation readiness-focused before adding live transfer.
- Make provider capability, disclosure, credential, cost, timeout, and failure behavior explicit.

Deliverables:
- Provider capability registry.
- Env-only credential policy.
- Declared transferable evidence types per provider.
- Raw response non-storage policy.
- Cost, timeout, retry, and size-limit metadata.
- Provider readiness command or metadata surface.

Completion criteria:
- TraceCue can report what a provider is allowed to receive before execution.
- Credential values are not read, logged, stored, or committed.
- No real provider call is performed in this slice.

### Slice 38: Minimal Approved Real AI Provider Execution

Purpose:
- Add the first live provider adapter behind the existing approval gates.
- Execute only when the stored plan, supplied plan hash, `--execute`, provider selection, and transfer flags all match.
- Normalize provider output into advisory-only results without storing raw responses.

Deliverables:
- Provider adapter interface.
- Request builder.
- Response normalizer.
- Secret redaction.
- Failure receipt.
- Raw response non-storage regression coverage.

Completion criteria:
- Real provider execution is possible only through an approved plan.
- Output remains `agentic_human_review_advisory`.
- Credentials and raw provider responses are not stored.
- MCP exposure remains unavailable.

### Slice 39: Multi-Role Independent Review Execution

Purpose:
- Execute role-specific reviews independently for `standard`, `deep`, and `xhigh` modes.
- Preserve each role's perspective instead of collapsing results too early.
- Make effort selection meaningful across roles.

Default roles:
- Visual/UX.
- Content/Copy.
- Accessibility/Comprehension.
- Subjective Impression.
- Risk/Rebuttal.
- Integrator.

Deliverables:
- Role execution records.
- Role-specific prompts or instruction contracts.
- Role-specific effort application.
- Per-role evidence references.
- Per-role limitations and confidence.

Completion criteria:
- Each role writes an independent advisory record.
- Role effort affects the generated task metadata and execution behavior.
- The deterministic review layer remains unchanged.

### Slice 40: Critic, Rebuttal, And Integration Rounds

Purpose:
- Improve review quality in `xhigh` mode by adding review rounds beyond first-pass findings.
- Detect contradictions, unsupported claims, weak subjective impressions, and likely missed issues.
- Produce an integrated result without hiding dissent.

Deliverables:
- Critic round.
- Rebuttal round.
- Consistency check.
- Consensus extraction.
- Dissent and uncertainty extraction.
- Integrator summary.

Completion criteria:
- The final report separates consensus, dissent, and uncertainty.
- Subjective impressions include supporting rationale.
- Weak or unsupported claims can be downgraded or flagged.
- Output remains advisory-only.

### Slice 41: Real-Page Dogfood Foundation

Purpose:
- Create a repeatable way to test agentic review quality on real pages and screenshots.
- Use dogfood runs to evaluate whether reviews are useful to humans.
- Preserve review comparison metadata without turning advisory output into deterministic gates.

Deliverables:
- Dogfood target manifest.
- Repeatable review input set.
- Review quality rubric.
- Snapshot and comparison metadata.
- Fixture strategy for stable examples.

Completion criteria:
- The same target can be reviewed repeatedly and compared.
- Visual, text, content, and flow review quality can be evaluated on real pages.
- Dogfood evidence remains local and approval-bound.

### Slice 42: Report Quality And Human-Usability Tuning

Purpose:
- Make the final review report useful to both non-engineers and developers.
- Turn subjective impressions into actionable, evidence-backed feedback.
- Reduce vague comments, thin opinions, and ambiguous recommendations.

Deliverables:
- Non-engineer summary.
- Developer action plan.
- Priority, impact, and suggested-fix fields.
- Dedicated "how viewers may feel" section.
- Report quality checks for clarity, usefulness, evidence support, and actionability.

Completion criteria:
- Reports explain what users may feel, why, and what to improve.
- Findings are specific enough to guide product work.
- The report distinguishes subjective perception from objective evidence.
- Advisory-only and deterministic-gate separation remains intact.

## Recommended Implementation Order

Implement Slices 34-42 in this order:

```text
34 conversational intake
 -> 35 proposal-to-plan candidate conversion
 -> 36 safe bridge into existing plan/run
 -> 37 real provider readiness
 -> 38 minimal approved provider execution
 -> 39 multi-role independent review
 -> 40 critic/rebuttal/integration rounds
 -> 41 real-page dogfood foundation
 -> 42 report quality tuning
```

The key safety principle is that Slices 34-36 should be completed before live provider execution. That ensures every future provider-backed review still passes through a human-readable approval explanation, stored plan, plan hash, exact transfer flags, explicit `--execute`, local receipts, MCP exclusion, and advisory-only result handling.

## Implementation Sync: Slices 34-42

Status:
- Implemented in TraceCue as a CLI-only Agentic Human Review continuation.

Implemented capabilities:
- `agentic review propose` for non-executing conversational intake and proposal artifacts.
- `agentic review plan --proposal` with proposal-hash verification and fresh plan-hash generation.
- `agentic review provider-readiness` with provider catalog and environment-variable-name diagnostics only.
- Generic API provider execution through the existing approved `agentic review run` path.
- Package-hash validation and exact transfer flags for externally transferable evidence classes.
- `agentic review report-quality` for read-only advisory report quality diagnostics.
- Role execution records, review claims, round records, critique records, rebuttal records, integration records, dogfood metadata, and report-quality metadata in advisory output.
- Provider adapter isolation in `src/agentic-human-review-providers.js`.
- Proposal, provider-readiness, and report-quality schemas.

Preserved boundaries:
- Proposal and readiness do not authorize provider execution or evidence transfer.
- Agentic review execution still requires matching plan hash, explicit `--execute`, provider/model/surface match, package-hash validation, and exact transfer flags.
- Raw provider responses and credential values are not stored.
- Deterministic review findings, metrics, release gates, existing review artifacts, and MCP permissions remain unchanged.
- Agentic Human Review remains excluded from safe, full, and admin MCP profiles.

## Agentic Human Review Strengthening Roadmap

This roadmap is a draft continuation of the TraceCue Agentic Human Review direction. It is not a formal product plan, release commitment, live execution permission, provider/API transfer approval, or MCP execution approval unless the developer explicitly promotes it into the canonical product documents.

### Goal

TraceCue should not stop at mechanical browser inspection. It should be able to transform browser observations into a human-like review that reads, sees, understands, feels, compares, criticizes, and synthesizes the page in a way that can substitute for a skilled human reviewer.

The target flow is:

```text
Open the page
 -> collect screenshot, visible text, DOM summary, image metadata, and technical findings
 -> ask multiple AI review roles to see, read, and evaluate the page like humans
 -> integrate subjective impressions with deterministic technical findings
 -> produce a non-engineer-readable review report
```

For example, for a food blog page, TraceCue should be able to produce a judgment like:

```text
The page loses value through an old blog layout and technical quality issues, but the article itself is concrete and trustworthy. The photos, prices, waiting-time details, restaurant atmosphere, and temporary-closure context increase the reader's desire to visit. The priority is not to rewrite the core article, but to improve readability, information organization, accessibility, and surrounding UI noise.
```

### Roadmap

| Slice | Purpose | Implementation content |
| --- | --- | --- |
| AHR-01 | Fix the current capability gap | Define the difference between TraceCue's mechanical review and human review. Make UI/UX, content comprehension, reader emotion, trust, subjective impression, and improvement suggestions explicit review targets. |
| AHR-02 | Human Review Schema v2 | Add structured schema areas such as `first_impression`, `reader_emotion`, `content_comprehension`, `trust`, `visual_ux`, `accessibility`, and `improvement_priority`. |
| AHR-03 | Multimodal Evidence Package | Package screenshot, visible text, article/body text summary, DOM structure, image metadata, and TraceCue technical findings into one review input package. |
| AHR-04 | Real Provider Connection | Connect an OpenAI-compatible Vision/LLM provider or another provider through env-only credentials. Do not store raw provider responses; store only normalized advisory JSON. |
| AHR-05 | Natural-Language Review Planning | Convert a user's natural-language request into an appropriate `effort`, `roles`, `transfer scope`, and `rubric`. Explain in non-engineer-readable language what will be reviewed and how. |
| AHR-06 | Approved CLI Execution | Mechanically enforce `plan -> approval -> run --execute`. Validate plan hash, transfer permissions, provider capability, and receipts before execution. |
| AHR-07 | Effort Mode Orchestration | Make `quick`, `standard`, `deep`, and `xhigh` executable. Split work across Visual/UX, Content, Audience, Accessibility, Risk, Critic, Verifier, and Synthesis roles. |
| AHR-08 | Human Review Prompt And Rubric | Replace free-form prompting with a stable rubric contract. Make "how a person viewing this page would feel" a required review dimension. |
| AHR-09 | Consensus And Dissent Synthesis | Preserve each sub-agent opinion, contradictions, dissent, and verification results. Prevent technical findings from overwhelming content value and reader-impact evaluation. |
| AHR-10 | Human-Readable Report | Produce a report that non-engineers can understand, covering strengths, lost value, reader impression, priority fixes, technical issues, and content or copy improvements. |
| AHR-11 | Safety And Privacy Enforcement | Explicitly gate transfer of raw pixels, page text, DOM summaries, URLs, and artifact references. Reject execution without permission. Do not store credentials, cookies, secrets, or raw provider responses. |
| AHR-12 | Review Quality Benchmark | Add fixtures for blogs, landing pages, commerce pages, dashboards, images, and article pages. Verify human-like review quality through fake providers and injected transports so CI can run without external calls. |

### MVP Scope

The first practical implementation target should be AHR-01 through AHR-06.

At that point, TraceCue should support a flow shaped like:

```bash
trace-cue agentic review plan --url <target> --effort standard --json
trace-cue agentic review run --plan <plan> --allow-screenshot --allow-page-text --execute --json
```

The MVP should be able to produce:

- A human-like first impression of the page.
- A reading-comprehension review of visible text and page content.
- A UI/UX review of what reduces the page's value.
- A technical-quality summary from TraceCue's deterministic findings.
- A subjective estimate of reader trust, anxiety, appeal, and motivation.
- Prioritized improvement suggestions.
- An integrated comparison between TraceCue's mechanical findings and the agentic human review.

### Key Implementation Policy

This feature must not mix AI-generated review output into deterministic findings or gate status. AI review output must remain separated as `agentic_human_review_advisory`.

TraceCue must preserve two distinct review layers:

```text
Mechanical inspection:
  objective, reproducible, deterministic, gate-oriented

Agentic Human Review:
  subjective, interpretive, reader-centered, improvement-oriented
```

This separation is essential because many real pages have both strengths and weaknesses at the same time. A page can have technical problems while still being valuable, persuasive, trustworthy, or emotionally effective. TraceCue must be able to explain that distinction clearly.

## Implementation Sync: AHR-01-12

Status:
- Implemented in TraceCue as an Agentic Human Review strengthening layer on top of Slices 26-42.

Implemented capabilities:
- Added Agentic Human Review schema v2 contracts with `human_review_schema_version`.
- Made first impression, reader emotion, content comprehension, trust and credibility, visual UX, accessibility comprehension, and improvement priority explicit review dimensions.
- Added human review contracts to proposals and plans.
- Added provider instruction contracts and review-quality benchmark contracts to plans.
- Added technical evidence and mechanical review summaries to review packages.
- Added reader-experience review, mechanical-versus-human comparison, and human-review coverage to normalized advisory results.
- Added human-review coverage and actionability scoring to report-quality output.
- Added non-engineer-readable Markdown sections for viewer feeling, content and trust, and mechanical review compared with human review.
- Validated plan artifacts in provider readiness.
- Validated advisory result contracts and optional execution/result pairing in report-quality.
- Rejected conflicting proposal inputs before planning.
- Minimized generic API provider payload metadata so plan paths, execution paths, and deterministic review paths are not transferred.
- Rejected credential-bearing non-loopback HTTP generic API provider endpoints while preserving loopback HTTP for local development.
- Synchronized schema files, schema registry entries, API exports, CLI tests, architecture tests, packed-install smoke tests, product docs, workflow state, security notes, verification notes, and session memory.

Preserved boundaries:
- Agentic Human Review remains advisory-only.
- Deterministic review findings, metrics, release gates, existing review artifacts, MCP permissions, raw provider response storage, and credential storage remain unchanged.
- Provider readiness and report-quality remain non-executing read/validation surfaces.
- Generic `agent execution` remains unable to route Agentic Human Review packages.
- AHR execution still requires the approved plan hash, package hash validation, explicit `--execute`, provider/model/surface matching, and exact transfer flags.

## Agentic Human Review AHR-13-24 Implementation Plan

Goal:
- Make high-quality human-equivalent Agentic Human Review measurable, calibratable, and safely dogfoodable with real providers while preserving existing advisory-only and no-MCP-execution boundaries.

Slices:
- AHR-13: Provider capability contract and capability hash stored in plans, then revalidated at run time.
- AHR-14: Multimodal evidence planner that separates visual references, text summaries, DOM summaries, accessibility summaries, URLs, artifact references, and raw pixel bytes.
- AHR-15: Live provider dogfood readiness that remains env-only, explicit, bounded, and CI-disabled by default.
- AHR-16: Benchmark corpus contract for blog, landing page, commerce page, dashboard, article page, and image cases.
- AHR-17: Page-type rubric profiles that tune review questions without adding product-specific runtime branches.
- AHR-18: xhigh orchestration v2 with round dependencies, role instruction contracts, critic/verifier/synthesis diagnostics, and missing-role detection.
- AHR-19: Review quality evaluator v2 with evidence support, specificity, dissent handling, actionability, calibration, and safety-boundary components.
- AHR-20: Fake/injected/live test split where CI uses fake/injected seams and live provider dogfood remains manual.
- AHR-21: Human-readable report v2 with clearer strengths, lost value, reader journey, priority fixes, and direct evidence.
- AHR-22: Direct-vs-TraceCue comparison for measuring the value added by TraceCue's mechanical context.
- AHR-23: Privacy and disclosure audit for approved, denied, and effective transfer classes.
- AHR-24: Calibration loop and benchmark comparison diagnostics for ongoing rubric/prompt/role improvement.

Implementation policy:
- Add contracts and read-only benchmark/calibration surfaces instead of bypassing the existing `propose -> plan -> run -> report-quality` path.
- Keep benchmark/calibration output advisory-only with `gate_effect: none`.
- Do not store credentials, raw provider responses, cookies, storage state, raw review artifacts, or raw pixel bytes.
- Do not expose Agentic Human Review execution through MCP or generic `agent execution`.

## Implementation Sync: AHR-13-24

Status:
- Implemented in TraceCue as the provider dogfood, benchmark calibration, and orchestration-quality layer on top of AHR-01-12.

Implemented capabilities:
- Added provider capability contracts and SHA-256 capability hashes to provider readiness, plans, provider payloads, executions, and results.
- Added run-time provider capability drift rejection before provider execution.
- Added evidence planning by transfer class with explicit distinction between visual references and raw pixel bytes.
- Added rubric profiles for general, blog/content, landing/trust, commerce/confidence, and dashboard/comprehension review.
- Added privacy disclosure audits for package, plan, and result artifacts.
- Hardened API provider endpoints against unsupported non-loopback HTTP, URL credentials, credential-like query parameters, redirects, oversized requests, oversized streaming responses, and raw response storage.
- Added role instruction contracts, orchestration v2 contracts, role instruction coverage, consensus analysis, dissent analysis, review-quality evaluation, and calibration metadata.
- Added read-only benchmark catalog commands: `agentic review benchmark list` and `agentic review benchmark show`.
- Added read-only calibration and comparison commands: `agentic review calibrate` and `agentic review compare`.
- Added schema registry entries, schema files, API exports, CLI help/parser coverage, architecture tests, CLI end-to-end tests, and packed-install smoke coverage.
- Synchronized product docs, security notes, verification notes, task tracker, handoff, and session memory.

Preserved boundaries:
- Agentic Human Review remains advisory-only with `gate_effect: none`.
- Deterministic review findings, metrics, release gates, existing review artifacts, MCP permissions, raw provider response storage, and credential storage remain unchanged.
- Benchmark, calibration, comparison, provider readiness, and report-quality remain read-only or non-executing validation surfaces.
- Agentic Human Review execution remains CLI-only and is still not exposed through MCP or generic `agent execution`.

## Implementation Sync: AHR-25-40

Status:
- Implemented in TraceCue as the completion-readiness layer for real provider dogfood, visual/text evidence contracts, xhigh review quality, direct-vs-TraceCue comparison, and production readiness diagnostics.

Implemented capabilities:
- Added Agentic Human Review completion, Visual Evidence Package v2, Quality Evaluator v3, and Human Report v3 version contracts.
- Added `visual_evidence_package_v2` and `visible_text_reading_contract` to local Agentic Human Review packages without embedding raw pixel bytes, raw DOM, raw report bodies, credential values, or raw provider responses.
- Added a manual-only dogfood readiness command: `agentic review dogfood readiness`.
- Added a read-only dogfood planning command: `agentic review dogfood plan --case <benchmark-case-id>`.
- Added `AGENTIC_HUMAN_REVIEW_LIVE_DOGFOOD` as an explicit manual opt-in signal for real-provider dogfood readiness while keeping CI live-provider dogfood disabled by default.
- Added `article-comprehension-risk` to the benchmark catalog for content comprehension, trust evidence, terminology risk, reader uncertainty, and rewrite-priority review.
- Added transfer approval preview metadata to plans so required flags, transfer classes, owner-facing explanation, and safety controls are visible before any run.
- Added xhigh round-plan v2 metadata that records independent review, critique/verification, and synthesis expectations while preserving single approved provider execution.
- Added Quality Evaluator v3 scores for human likeness, visual specificity, content reading, sensibility, specific fixes, and safety boundary.
- Added Human Report v3 to advisory results and Markdown reports with reader story, what works, what gets lost, priority fix, and quality snapshot.
- Added failure diagnostics to provider failures, execution records, and run receipts with advisory-safe stage, code, next actions, and no raw response or credential value storage.
- Added `--comparison-kind direct-vs-tracecue` to `agentic review compare` and included a direct-vs-TraceCue analysis block.
- Extended provider payload filtering so v2 visual/text contracts honor the approved transfer flags and still exclude raw bytes and raw DOM.
- Added public schemas, schema registry entries, API exports, parser/CLI help, product manifest entries, CLI tests, architecture tests, and packed-install smoke coverage for the new dogfood readiness/plan surfaces.

Preserved boundaries:
- Agentic Human Review remains advisory-only with `gate_effect: none`.
- Dogfood readiness and dogfood plan are read-only and perform no provider calls, browser launches, credential-value reads, evidence transfer, artifact writes, or release-gate changes.
- Real provider execution still goes only through `agentic review run` with a valid plan, matching plan hash, package hash validation, provider capability hash, explicit `--execute`, provider/model/surface match, and exact transfer flags.
- Deterministic review findings, metrics, release gates, existing review artifacts, MCP permissions, raw provider response storage, credential storage, and generic `agent execution` routing remain unchanged.

## 2026-06-27 Implementation Note: Agentic Human Review Responses Adapter

TraceCue now includes an optional local Responses-compatible adapter for manual Agentic Human Review live dogfood.

Implemented scope:
- A loopback-only HTTP adapter started with `npm run ahr:responses-adapter`.
- The adapter accepts TraceCue's existing `generic-api-provider` request contract.
- The adapter validates a local bearer token, then uses a separate upstream provider credential environment variable.
- The adapter converts the TraceCue AHR request into a bounded Responses-compatible request with provider-side storage disabled and provider tools disabled.
- The adapter rejects raw pixel bytes and local plan/execution path disclosure, strips local path values before upstream dispatch, parses provider output text into advisory JSON, redacts normalized output, and stores no raw provider response or credential values.
- API helpers are exported for startup, request handling, request building, and provider output parsing.
- No-browser tests cover request conversion, credential non-disclosure, local path stripping, unsafe request rejection, output parsing, architecture isolation, and packed-install coverage.

Persistent boundaries:
- This adapter does not replace `agentic review run`.
- The existing AHR plan hash, exact transfer flags, explicit `--execute`, package/provider validation, advisory-only result contract, and report-quality checks remain the execution authority.
- The adapter is not exposed through MCP.
- The adapter does not mutate deterministic findings, metrics, release gates, existing review artifacts, visual review artifacts, or MCP permissions.
- Live upstream calls remain manual-only and environment-configured; CI uses injected transports.

## 2026-06-27 Live Upstream Dogfood Result

The manual live upstream dogfood run completed successfully after the adapter implementation and local verification.

Executed flow:
- Started the local adapter with `npm run ahr:responses-adapter -- --json`.
- Created an Agentic Human Review plan for `gpt-5.4-nano`, `quick` effort, and `generic-api-provider`.
- Ran upstream provider execution through `agentic review run` via the loopback adapter endpoint.
- Ran `agentic review report-quality` against the resulting advisory artifact.
- Stopped the adapter and confirmed no listener remained on port 8787.

Run result:
- `agentic review run`: `ok`.
- `execution_status`: `completed`.
- `provider_id`: `generic-api-provider`.
- `model_id`: `gpt-5.4-nano`.
- `api_call_performed`: `true`.
- `external_evidence_transfer`: `true`.
- `raw_provider_response_stored`: `false`.
- `credential_values_recorded`: `false`.
- `gate_effect`: `none`.
- `advisory_only`: `true`.

Report-quality result:
- `status`: `ok`.
- `completeness_score`: `1`.
- `evidence_coverage_score`: `1`.
- `verification_score`: `0.35`.
- `human_review_coverage_score`: `0.7142857142857143`.
- `actionability_score`: `1`.
- Warnings were consistent with `quick` effort: no dedicated critique or verification output, and incomplete human-review dimension coverage.

Local artifacts were created under ignored `.browser-debug/` result, receipt, and report directories. The checked target artifacts and temporary outputs did not contain secret-like patterns. Git-managed changes did not increase beyond the pre-existing adapter implementation dirty state.

Persistent boundaries:
- Do not print or store credential values.
- Do not store raw provider responses.
- Do not bypass `agentic review run`, plan hash validation, exact transfer flags, or explicit `--execute`.
- Do not expose Agentic Human Review through MCP.
- Do not mutate deterministic findings, metrics, release gates, existing review artifacts, visual review artifacts, or MCP permissions.

## 2026-06-28 Implementation Note: Human Review Maturity Diagnostics

TraceCue now has a read-only maturity layer for moving Agentic Human Review closer to owner-reviewed human-level evidence without claiming equality or superiority.

Implemented scope:
- `agentic review report-quality` adds `human_review_maturity` and `longitudinal_quality_evaluation`.
- The maturity output records the current result effort, benchmark case, provider/model ids, live-provider dogfood evidence, single-result maturity score, longitudinal evidence score, missing standard/deep/xhigh effort evidence, missing benchmark cases, comparison/history requirements, and next recommended actions.
- `agentic review dogfood readiness` and `agentic review dogfood plan` add a standard/deep/xhigh maturity plan and benchmark-case matrix with proposal, plan, run, report-quality, and calibrate command shapes.
- Public schemas, schema registry entries, and CLI coverage were updated.

Persistent boundaries:
- The maturity layer is read-only and advisory-only.
- It does not call providers, read credential values, transfer evidence, write artifacts from readiness/planning, expose Agentic Human Review through MCP, mutate deterministic findings, change release gates, store raw provider responses, or store credential values.
- `human_equivalent_claim_allowed` and `human_superior_claim_allowed` remain false. Standard/deep/xhigh real-page dogfood, multiple benchmark-case comparison, and longitudinal owner-reviewed quality history remain required before any future claim discussion.

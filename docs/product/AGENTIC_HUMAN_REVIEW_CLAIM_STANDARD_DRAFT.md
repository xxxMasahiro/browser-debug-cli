# Agentic Human Review Claim Standard Draft

Status: draft, non-authoritative.

This document is a product-facing draft for owner review. It does not change the active claim policy, does not authorize human-equivalent or human-superior claims, and does not weaken any Agentic Human Review security, approval, evidence, or advisory-only boundary.

Implementation note: the active mechanical surface is `agentic review claim standard-gate --evidence-set <workspace-json> [--policy <workspace-json>] --json`. It enforces owner claim-review readiness as a read-only, fail-closed gate and still keeps human-equivalent and human-superior claim states false. This draft remains non-authoritative until a separate owner-approved standard changes the active claim policy.

## Purpose

Agentic Human Review now has enough proof-readiness evidence to enter a separate owner claim-standard review. The next step is to define what TraceCue would need before it could make any scoped claim about human-equivalent or human-superior review quality.

The current approved position remains narrower:

> The Agentic Human Review evidence set is ready for a separate owner claim-standard review.

The current approved position does not include these claims:

- Agentic Human Review is human-equivalent.
- Agentic Human Review is human-superior.
- Agentic Human Review is better than a human reviewer.
- Agentic Human Review can approve releases.
- Provider output changed deterministic gates.

## Current Evidence Packet

The current local proof packet is:

`.browser-debug/target-url-ahr-evidence/2026-06-28T18-46-38-215Z-owner-baseline-contract/claim-review-proof-packet-2026-06-29.md`

The current local claim-standard working artifact is:

`.browser-debug/target-url-ahr-evidence/2026-06-28T18-46-38-215Z-owner-baseline-contract/claim-standard-draft-2026-06-29.md`

The evidence packet reports:

- result count: `18`
- calibration count: `18`
- comparison count: `36`
- owner-labeled baseline count: `6`
- claim-numerator eligible results: `18 / 18`
- real-provider claim-numerator matrix complete: `true`
- mechanical contract matrix complete: `true`
- calibration pass matrix complete: `true`
- claim-readiness status: `ready_for_separate_owner_claim_standard_review`
- longitudinal-quality status: `ready_for_owner_longitudinal_review`
- missing result, mechanical incomplete, claim-ineligible, failed calibration, and missing comparison blockers: `0`

## Non-Negotiable Boundaries

- Agentic Human Review remains advisory-only.
- Deterministic findings, metrics, release gates, existing review artifacts, and MCP permissions must not be mutated by claim review.
- Human-equivalent and human-superior claims remain disabled until a separately approved claim standard is mechanically enforced.
- Owner baselines require owner approval metadata.
- AI drafts are preparation only and never proof by themselves.
- Generic criteria alone are insufficient; target-specific must-not-miss criteria must be present and linked to evidence-backed owner labels.
- Synthetic, deterministic, fixture-only, fake, injected, or local-pipeline markers must remain excluded from owner-baseline verification and future claim-numerator evidence.
- `xhigh` must be judged by observable mechanical completion metadata, not by prompt wording or provider effort selection alone.
- Provider execution remains governed by the existing approved `agentic review run` plan-hash, package-hash, provider-capability-hash, exact-transfer-flag, explicit-`--execute`, and manual-live-dogfood boundaries.
- Raw provider responses, credential values, raw pixels, raw DOM, cookies, storage state, and local secret values must not be stored in claim artifacts.

## Claim States

### `not_ready`

The evidence is not ready for owner claim-standard review.

This state applies when any required case-effort result, calibration, comparison, owner-labeled baseline, mechanical contract, or claim-readiness condition is missing or blocked.

### `owner_claim_review_ready`

The evidence may be reviewed by the owner against a separate claim standard.

This state requires:

- the required benchmark-case by effort matrix is complete;
- real-provider claim-numerator eligibility is complete;
- mechanical contract coverage is complete;
- calibration pass coverage is complete;
- required comparison kinds are complete by case;
- owner-labeled human baselines are present and verified;
- claim-readiness reports no blockers;
- longitudinal quality reports no blockers;
- equality and superiority claim flags remain false.

### `human_equivalent_candidate`

This state is not currently allowed by active policy.

To become allowed, a future owner-approved mechanical claim gate must require all `owner_claim_review_ready` conditions plus:

- every owner-labeled human-baseline comparison cell is ready for owner review;
- every owner-labeled human-baseline comparison cell matches the owner baseline;
- no target-specific must-not-miss criterion is missed;
- no critical or high-severity owner-labeled criterion is missed or severity-downgraded;
- direct-vs-TraceCue comparisons show no material regression in any benchmark case;
- any score regression is explicitly reviewed and accepted by the owner with written rationale;
- repeated observations include at least one additional independent run or an owner-approved equivalent stability record;
- the claim is scoped to the reviewed evidence set, benchmark cases, provider, model, and effort modes;
- the claim remains advisory-only and cannot mutate deterministic review findings or release gates.

### `human_superior_candidate`

This state is not currently allowed by active policy.

To become allowed, a future owner-approved mechanical claim gate must require all `human_equivalent_candidate` conditions plus:

- direct-vs-TraceCue comparisons show material improvement in every benchmark case, or the owner provides an explicit superiority rationale for every non-improving case;
- provider-dogfood and benchmark-regression comparisons show no unaccepted material regressions;
- the superiority basis is tied to specific review dimensions rather than a broad global claim;
- the claim is limited to the tested benchmark scope and cannot be generalized to medical, legal, financial, safety-critical, or unseen domains.

## Required Mechanical Enforcement

Manual protocol memory is insufficient. Any future equality or superiority claim gate must be enforced mechanically.

Required enforcement surfaces:

- evidence-set summary for case-effort completeness;
- evidence-set summary for claim-numerator eligibility;
- claim-readiness blocker categories for missing results, mechanical incompleteness, claim ineligibility, failed calibration, and missing comparisons;
- human-baseline comparison diagnostics for owner-label match, miss, severity mismatch, over-report, and insufficient evidence;
- xhigh completion diagnostics for role, round, critique, verification, synthesis, structured benchmark, evidence reference, placeholder rejection, and completion metadata;
- claim policy validation that keeps equality and superiority disabled unless an owner-approved standard is supplied and validated;
- explicit owner approval metadata for any accepted regression or scoped exception.

## Current Evidence Assessment

The current evidence passes `owner_claim_review_ready`.

The current evidence does not pass `human_equivalent_candidate` or `human_superior_candidate`.

Known blockers for equality or superiority:

- direct-vs-TraceCue comparisons are mixed, with regressions in `article-comprehension-risk`, `commerce-decision-confidence`, and `landing-trust-clarity`;
- `commerce-decision-confidence / deep` and `commerce-decision-confidence / xhigh` do not currently match the owner-labeled baseline comparison;
- the active claim policy still sets equality and superiority claim authorization to false.

## Non-Scope

This draft does not:

- authorize human-equivalent claims;
- authorize human-superior claims;
- authorize release approval;
- authorize provider calls;
- authorize evidence transfer;
- authorize MCP execution;
- store raw provider responses;
- store credential values;
- weaken owner-baseline validation;
- treat AI drafts as owner evidence;
- treat synthetic, deterministic, fixture-only, fake, injected, or local-pipeline markers as future claim evidence;
- mutate deterministic review findings, metrics, or release gates.

## Owner Decision Request

The owner should choose one:

1. Approve this draft as the next mechanical claim gate design.
2. Amend the equality or superiority criteria before implementation.
3. Keep the current evidence as proof-readiness only and continue collecting data.

Until that decision is made and a standard is mechanically enforced, TraceCue must continue to report human-equivalent and human-superior claims as not allowed.

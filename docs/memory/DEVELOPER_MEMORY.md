# DEVELOPER_MEMORY.md

## Reset Notice

The previous developer memory was intentionally cleared at the developer's request on 2026-06-22.
This file records the draft roadmap proposal below and the narrow Phase 60/60.1 promotion notes.

Phase 60 has been promoted only as a read-only operation registry and roadmap risk taxonomy foundation. Phase 60.1 has been implemented only as a read-only operation roadmap boundary-contract report for draft phase A/B/C status. Do not treat Phase 61-155 as approved product-plan entries, release commitments, live execution permission, or product-document source of truth until the developer explicitly asks to promote a specific slice into the formal proposal, implementation plan, and product documents.

## Phase 60 Promotion Note

The Phase 60 slice is intentionally limited to policy inspection: operation registry, risk taxonomy, required gates, registry-derived MCP capability exclusions, registry-derived MCP execution-gate operation metadata, CLI/API output, safe MCP inspection, schema/package coverage, and no-execution boundaries.

Phase 60 does not authorize execution tokens, execution harnesses, provider/API execution through MCP, cleanup execution through MCP, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, constrained shell execution, HTTP `full` or `admin`, socket transport, remote listeners, or MCP write/execute expansion.

## Phase 60.1 Promotion Note

The Phase 60.1 slice is intentionally limited to policy inspection: operation roadmap phase A/B/C boundary contracts, phase/group/risk filtering, registry-related operation references, safe MCP inspection, schema/package coverage, unsupported execution-option rejection, and no-live-execution boundaries.

Phase 60.1 does not promote Phase 61-155 into formal product-plan entries, release commitments, or implementation approval. It does not authorize execution tokens, execution harnesses, provider/API execution through MCP, cleanup execution through MCP, capture execution, translation execution, npm publication, artifact-root migration, legacy alias removal, constrained shell execution, remote CI triggering, HTTP `full` or `admin`, socket transport, remote listeners, or MCP write/execute expansion.

## Draft Roadmap Proposal

The earlier roadmap was useful as a product-level view, but it was too coarse for safe, accurate, and efficient implementation. The safer implementation approach is to split each risky area into smaller slices such as policy, schema, dry-run, CLI execution, MCP read-only exposure, MCP admin execution, documentation, and hardening.

This finer-grained roadmap is intended to reduce rework from intermediate verification failures and to keep risky operations behind explicit plans, tokens, receipts, boundaries, and focused tests.

| Phase | Slice | Purpose | Primary Verification |
| ---: | --- | --- | --- |
| 60 | Operation Registry | Put risky operations into a shared operation registry. | Unit and schema tests |
| 61 | Operation Risk Taxonomy | Classify read, write, delete, provider, shell, and capture operations. | Architecture tests |
| 62 | Operation Gate Schema | Define plan, execute, and receipt schemas. | Schema parity tests |
| 63 | Execute Token Contract | Define execution token scope, expiry, and one-time usage. | Unit tests |
| 64 | Receipt Contract | Define the common execution receipt format. | Unit and package tests |
| 65 | Admin Policy Config | Add the admin execution policy file. | Docs and security checks |
| 66 | CLI Operation Plan | Allow CLI users to inspect operation plans. | No-browser tests |
| 67 | CLI Operation Execute Harness | Build the shared execution harness. | Fake operation tests |
| 68 | MCP Execute Gate Readiness | Expose execution readiness through MCP as read-only data. | MCP safe-profile tests |
| 69 | MCP Execute Token Flow | Implement the MCP admin execution token flow. | MCP admin dry-run tests |
| 70 | MCP Execute Harness | Let MCP admin calls use the shared execution harness. | MCP smoke tests |
| 71 | Provider MCP Plan | Expose provider/API execution plans through MCP. | No-provider-call tests |
| 72 | Provider Disclosure Contract | Fix the bounded disclosure contract for provider inputs. | Security tests |
| 73 | Provider Env Credential Guard | Preserve env-only credential handling for MCP-triggered provider execution. | Secret-handling tests |
| 74 | Provider Fake MCP Execute | Execute the fake provider through MCP admin. | MCP admin smoke tests |
| 75 | Provider Local Runner MCP Execute | Execute configured local runner callbacks through MCP admin. | Callback tests |
| 76 | Provider API MCP Execute | Execute API providers through MCP admin with explicit execution. | Injected fetch tests |
| 77 | Provider MCP Status/List | Inspect provider execution status and lists through MCP. | MCP safe/full tests |
| 78 | Provider MCP Docs/Hardening | Synchronize docs, security, and release boundaries. | Product gate |
| 79 | Cleanup MCP Plan | Inspect cleanup plans through MCP without deletion. | No-delete tests |
| 80 | Cleanup Candidate Lock | Lock cleanup candidates by path, size, and hash. | Unit tests |
| 81 | Cleanup Execute Token | Add cleanup-specific execute tokens. | Unit tests |
| 82 | Cleanup MCP Execute Dry Fixture | Execute cleanup against a fixture artifact root. | Temporary-directory tests |
| 83 | Cleanup Receipt Audit | Strengthen receipts and skipped reasons. | Unit tests |
| 84 | Cleanup Docs/Hardening | Synchronize cleanup docs, security, and release boundaries. | Product gate |
| 85 | Capture OS Capability Probe | Detect OS capture capability without capturing pixels. | No-capture tests |
| 86 | Capture Privacy Policy | Define privacy, redaction, and window metadata policy. | Security docs |
| 87 | Capture Artifact Schema | Define capture artifact and receipt schemas. | Schema parity tests |
| 88 | Screen Capture CLI Plan | Add CLI screen-capture planning. | No-pixel-read tests |
| 89 | Screen Capture CLI Execute | Execute screen capture through the CLI. | Local fixture or manual tests |
| 90 | Window Capture CLI Plan | Add CLI window-capture planning. | No-process-leak tests |
| 91 | Window Capture CLI Execute | Execute window capture through the CLI. | Local or manual tests |
| 92 | Desktop App Capture Handoff Upgrade | Connect capture results to the existing review pipeline. | Image review smoke tests |
| 93 | Capture MCP Read-only | Expose capture capability, plan, and status through safe MCP. | MCP safe-profile tests |
| 94 | Capture MCP Admin Execute | Execute capture through MCP admin with explicit tokens. | Admin token tests |
| 95 | Capture Docs/Hardening | Synchronize capture docs, security, and release boundaries. | Product gate |
| 96 | UI i18n Key Inventory | Inventory dashboard display text keys. | Static checks |
| 97 | UI i18n Resource Schema | Define locale resource schemas. | Schema parity tests |
| 98 | UI i18n Runtime Resolver | Add locale fallback resolution. | Unit tests |
| 99 | UI i18n English Baseline | Make English resources the baseline. | Snapshot tests |
| 100 | UI i18n 14 Locale Stubs | Add stub resources for the 14 supported locales. | Schema tests |
| 101 | UI i18n RTL Layout Guard | Add direction and layout guards for RTL locales. | UI smoke tests |
| 102 | Dashboard Language Switch | Switch dashboard display with `ui_locale`. | Playwright tests |
| 103 | UI i18n Docs/Hardening | Synchronize UI i18n docs, security, and verification. | Product gate |
| 104 | Report Text Inventory | Inventory translatable report body text. | Static checks |
| 105 | Report Template Schema | Define report template schemas. | Schema parity tests |
| 106 | Report English Templates | Make English report templates the baseline. | Snapshot tests |
| 107 | Report Locale Resolver | Resolve report language from `artifact_output.language`. | Unit tests |
| 108 | Report Localized Rendering | Render report bodies by locale. | Fixture tests |
| 109 | Raw Evidence Non-Translation Guard | Keep raw page text, selectors, and logs out of translation. | Security tests |
| 110 | Report 14 Locale Stubs | Add report template stubs for the 14 supported locales. | Schema and snapshot tests |
| 111 | Report Docs/Hardening | Synchronize report localization docs, security, and verification. | Product gate |
| 112 | Translation Provider Threat Model | Define the provider translation threat model. | Docs only |
| 113 | Translation Disclosure Plan | Plan minimal provider-bound disclosure. | No-provider tests |
| 114 | Translation Dry-run CLI | Add provider translation dry-run. | No-network tests |
| 115 | Translation Fake Provider | Execute translation through a fake provider. | Unit tests |
| 116 | Translation API Provider | Execute translation through an env-only API provider. | Injected fetch tests |
| 117 | Translation MCP Readiness | Inspect translation readiness through MCP. | MCP safe-profile tests |
| 118 | Translation MCP Admin Execute | Execute translation through MCP admin with token and receipt. | Token and receipt tests |
| 119 | Translation Docs/Hardening | Synchronize translation docs, security, and verification. | Product gate |
| 120 | npm Name/License Decision Pack | Prepare package-name and license decision material. | Docs checks |
| 121 | npm Public Package Metadata | Prepare public package metadata. | Package checks |
| 122 | npm Provenance/2FA Policy | Define provenance, token, and 2FA policy. | Docs and security checks |
| 123 | npm Release Candidate | Prepare a local release-candidate package. | Local-only checks |
| 124 | npm Publish Dry Run | Run publish dry-run and checklist. | No-publish checks |
| 125 | npm Publish | Publish the first npm release. | Post-publish smoke tests |
| 126 | Artifact Root Policy | Define canonical and legacy artifact-root policy. | Docs checks |
| 127 | Artifact Root Config | Make artifact-root resolution configurable. | Unit tests |
| 128 | Dual Read Support | Read from both new and legacy artifact roots. | Fixture tests |
| 129 | Dual Write Support | Write to the new root while preserving legacy compatibility. | Fixture tests |
| 130 | Migration Plan CLI | Add artifact-root migration dry-run. | No-mutation tests |
| 131 | Migration Execute CLI | Add migration execution with receipts. | Temporary-directory tests |
| 132 | Artifact Root MCP Status | Inspect artifact-root migration state through MCP. | Read-only MCP tests |
| 133 | Artifact Root Docs/Hardening | Synchronize artifact-root docs, security, and verification. | Product gate |
| 134 | Legacy Alias Usage Audit | Audit legacy alias usage. | Static checks |
| 135 | Legacy Alias Deprecation Warnings | Add deprecation warnings. | CLI and MCP tests |
| 136 | Legacy Alias Migration Guide | Write the migration guide. | Docs checks |
| 137 | Legacy Alias Compatibility Window | Define the version boundary for compatibility. | Docs checks |
| 138 | Legacy Alias Removal RC | Prepare a removal candidate. | Tests |
| 139 | Legacy Alias Removal | Remove legacy aliases at the approved boundary. | Release tests |
| 140 | Shell Use-case Review | Reassess whether shell execution is truly needed. | Proposal review |
| 141 | Shell Threat Model | Define the shell threat model. | Security docs |
| 142 | Constrained Command Schema | Define an allowlisted command schema. | Schema tests |
| 143 | Constrained Runner CLI Plan | Add plan-only constrained shell support. | No-execution tests |
| 144 | Constrained Runner CLI Execute | Execute only allowlisted commands. | Temporary-directory tests |
| 145 | Env/CWD/Timeout Guard | Add environment scrubbing, cwd confinement, and timeout guards. | Security tests |
| 146 | Shell MCP Readiness | Inspect shell readiness through MCP. | MCP safe-profile tests |
| 147 | Shell MCP Admin Execute | Execute constrained shell through MCP admin. | Token and receipt tests |
| 148 | Shell Docs/Hardening | Synchronize shell docs, security, and verification. | Product gate |
| 149 | Cross-feature Regression Matrix | Build the provider, cleanup, capture, i18n, npm, artifact-root, alias, and shell regression matrix. | Docs and tests |
| 150 | Full Release Gate Hardening | Reorganize full gates and CI for the completed roadmap. | Release checks |
| 151 | Browser Smoke Rebaseline | Rebaseline Playwright smoke coverage. | Browser tests |
| 152 | MCP Smoke Rebaseline | Rebaseline stdio, HTTP safe, and admin MCP smoke coverage. | MCP tests |
| 153 | Security Final Sweep | Sweep secrets, provider, shell, upload, and capture boundaries. | Security checks |
| 154 | Docs English Scan | Verify English-only documentation for changed docs. | Text scan |
| 155 | Final Product Gate | Run the final product gate. | All required checks |

## Safety Notes

- Provider/API execution, cleanup execution, capture execution, translation execution, and shell execution must not be exposed through MCP before the shared operation registry, gate schema, execution token, receipt contract, and admin policy exist.
- Arbitrary shell execution should remain a last-resort candidate. If implemented, it should be constrained shell execution with an allowlist, cwd confinement, environment scrubbing, timeouts, receipts, and admin-only MCP exposure.
- UI localization and report localization should not translate raw evidence such as page text, selectors, logs, URLs, traces, screenshots, or provider output.
- npm publication, artifact-root migration, and legacy alias removal remain release-bound operations and should not be combined with unrelated feature work.

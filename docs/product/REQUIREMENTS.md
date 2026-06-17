# REQUIREMENTS.md

## Purpose

Browser Debug CLI should make browser debugging reusable across repositories and AI agents. It should provide a local Playwright-based command surface that can observe a page, expose safe action candidates, run selected actions, and produce evidence for UI/UX and functional debugging.

## Users

- Developers who want fast browser-debug feedback during feature work.
- AI coding agents that need browser state without depending on Playwright MCP.
- Reviewers who want reproducible UI/UX findings with screenshots, traces, and notes.
- OSS users who want a repository-agnostic CLI they can add to different projects.

## Required Outcomes

- Provide a standalone CLI that can be used from any repository.
- Use Playwright as the browser automation layer.
- Provide a Node.js package layout with a stable local CLI binary before public release work starts.
- Support fast headless observation for routine debugging.
- Support headed browser and DevTools workflows for visual quality, animations, hover, focus, scroll, and final interaction checks.
- Support an opt-in process-scoped supervised browser run for ordered local actions when one-shot observation is too slow.
- Support an opt-in local background daemon for ephemeral browser supervision when a browser must stay open across CLI invocations.
- Return structured page observations suitable for AI decision making.
- Provide explicit action candidates instead of requiring raw DOM scraping.
- Record reproducible artifacts such as screenshots, traces, console messages, network summaries, and issue reports.
- Keep JSON output deterministic enough for agents, scripts, and regression tests to consume.
- Keep secrets, cookies, storage state, and existing browser profiles out of committed artifacts.
- Keep the design agent-independent: Codex, other agents, scripts, or humans should all be able to use the same CLI.
- Prepare for OSS distribution through local Git, GitHub publication with `gh`, CI, and npm packaging in later phases.

## Non-Goals

- Do not clone Playwright MCP or require MCP as the runtime interface.
- Do not replace final visual review; the tool should help operate and capture evidence, while humans approve product-level decisions when needed.
- Do not bypass authentication or collect credentials.
- Do not upload artifacts to external services by default.
- Do not add runtime features that cross into authentication, profile reuse, external upload, credential handling, or external daemon control channels without explicit implementation approval and security documentation.
- Do not create public repositories, remotes, remote CI execution, or npm publication paths as part of package/runtime design.

## Success Criteria

- The repository has the standard product scaffold expected by the lesson workflow.
- The initial five documents are synchronized and describe the same product direction.
- Product-local checks can validate structure, document sync, security, and design-system placeholders.
- Package/runtime design records the CLI shape, artifact boundaries, safety defaults, and focused verification plan before implementation begins.
- The first no-browser implementation slice provides local package metadata, the `browser-debug` executable, `doctor`, command parsing, deterministic JSON errors, and focused tests without launching a browser.
- The local MVP runtime provides Playwright-backed one-shot observation, local screenshots/traces/observation artifacts, session metadata, simple actions, report export, spec export, redaction tests, and browser smoke tests.

## Phase 2a Package and Runtime Design Criteria

- The working CLI binary is `browser-debug`.
- The package uses Node.js 20 or newer and ESM modules.
- The default runtime mode is local-first, headless, and artifact-safe.
- The first implementation slice is `doctor` plus a no-browser command parser and JSON output contract.
- The first Playwright slice is a one-shot `observe --url <url> --json` command using an ephemeral browser context.
- The default artifact root is `.browser-debug/`, which must stay ignored and must not contain cookies, storage state, credentials, or raw secrets.
- Long-running browser supervision is opt-in after the one-shot observation flow is working.

## Current Local MVP Criteria

- `doctor --json` verifies Node.js, ESM configuration, artifact ignore policy, and Playwright package availability.
- `observe --url <url> --json` launches an ephemeral Chromium context, captures structured page data, closes the browser context, and writes an observation artifact.
- `observe --screenshot` writes a local screenshot artifact without committing it.
- `observe --trace` writes a local Playwright trace artifact and warns that traces can contain page content.
- `session start`, `act`, `report`, and `spec export` operate on local `.browser-debug/` session metadata.
- `supervise --url <url> --actions <json-array>` keeps one ephemeral browser context alive for ordered local actions within a single CLI process and closes it before exit.
- `daemon start --url <url>`, `daemon status --daemon <id>`, and `daemon stop --daemon <id>` keep a local background ephemeral browser worker alive across CLI invocations and stop it through local process signaling.
- Page text, console messages, URLs, action data, and generated reports are treated as untrusted data and pass through basic secret redaction.
- Browser smoke tests verify local file observation, click actions, form controls, keyboard input, deterministic scroll, screenshots, reports, spec export, process-scoped supervision, and local daemon start/status/stop without using external services.
- Headed and DevTools mode regression tests verify Playwright launch-mode wiring without requiring a GUI display.
- Architecture regression tests check for generic runtime boundaries, shared page evidence helpers, and local Node CLI packaging.
- Local package dry-run verification confirms the npm package file set without publishing.
- Local CI manifest checks validate the GitHub Actions workflow definition without remote execution.
- Release readiness notes and `npm run release:check` track the unreleased status, public-release blockers, and no-publish boundaries.

## Closed Local Decisions

- JSON envelopes, artifact descriptors, and local metadata use schema version `0.1.0` for the local MVP. Additive fields may be added while existing fields keep their meaning and type. Renaming, removing, or changing the type of existing fields requires a schema version bump with updated docs and tests.
- Generated artifacts are retained manually under the ignored `.browser-debug/` artifact root. The CLI does not auto-delete artifacts and does not provide a destructive cleanup command in the local MVP.

## Open Decisions

- Final public npm package name and npm scope.
- Release license and contribution policy.

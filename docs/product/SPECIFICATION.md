# SPECIFICATION.md

## Product Shape

Browser Debug CLI is planned as a Node.js CLI package backed by Playwright. It should be usable from any product repository and should not require the caller to run an MCP server.

The Phase 2a design baseline uses Node.js 20 or newer, ESM modules, and a local CLI binary named `browser-debug`. The final npm package name can still be confirmed during release planning, but runtime code should not depend on a scoped package name.

## Planned Architecture

- CLI entrypoint: accepts commands, options, and JSON input/output flags.
- Core library: owns Playwright session management, observation, actions, and artifact creation.
- Browser supervisor: keeps a reusable browser context alive when fast iterative debugging is needed.
- Observation layer: summarizes URL, title, accessibility tree, visible text, form controls, action candidates, console errors, failed requests, screenshots, and selected metadata.
- Action layer: performs explicit actions such as click, fill, select, press, scroll, wait, navigate, screenshot, and trace capture.
- Report layer: converts session evidence into issue reports and handoff notes.

## Planned CLI Surface

The Phase 2a command surface is:

```text
browser-debug doctor
browser-debug session start
browser-debug session close --session <id>
browser-debug observe --url <url> --json
browser-debug act --session <id> --action <json>
browser-debug report --session <id>
browser-debug spec export --session <id>
```

The MVP implementation order is:

1. `doctor` with environment and safety checks.
2. Command parsing and deterministic JSON error output without launching a browser.
3. `observe --url <url> --json` with an ephemeral headless Playwright context.
4. Artifact directory handling under `.browser-debug/`.
5. Session start, explicit actions, reports, and spec export after one-shot observation is stable.

## Current Implemented Slice

The repository now includes a private local Node.js package named `browser-debug-cli` with the `browser-debug` executable at `bin/browser-debug.js`. The implementation is ESM-only and uses Playwright as its browser runtime dependency.

Implemented behavior:

- `browser-debug doctor --json` returns the standard JSON envelope and local environment checks.
- Parser errors return deterministic JSON envelopes when `--json` is used.
- Planned command names are parsed explicitly.
- `observe --url <url> --json` validates absolute `http`, `https`, or `file` URLs, launches an ephemeral Chromium context, captures structured page state, writes a local observation artifact, and closes the context.
- `observe --screenshot` writes a local screenshot artifact.
- `observe --trace` writes a local Playwright trace zip and emits a warning because traces can contain page content.
- `observe --headed` launches a visible browser mode when the host environment supports it.
- `observe --devtools` launches visible browser mode with DevTools enabled when the host environment supports it.
- `session start --url <url>` creates local session metadata and can attach the first observation.
- `act --session <id> --action <json>` supports simple local actions such as `navigate`, `observe`, `screenshot`, `click`, `fill`, `select`, `press`, `scroll`, and `wait` using an ephemeral page visit. Scroll actions use deterministic page scrolling from the requested deltas.
- `report --session <id>` writes a Markdown report.
- `spec export --session <id>` writes a JSON action/spec export.
- `npm test` runs deterministic no-browser tests, including headed/devtools launch-mode regression through an injected Playwright browser type. `npm run test:browser` runs Playwright smoke tests for observation, screenshots/traces, click actions, form controls, keyboard input, scroll, wait, reports, and spec export.
- `npm run test:pack` runs `npm pack --dry-run --json` with an ignored local npm cache to verify the package file set without publishing.
- `CHANGELOG.md` and `docs/workflow/RELEASE.md` track unreleased local changes, release blockers, local readiness checks, and no-publish boundaries.

The package is marked `private` and `UNLICENSED` until public release naming, licensing, CI, and npm publication are approved.

## Browser Modes

- `headless`: default fast mode for structured observation and regression debugging.
- `headed`: visible browser mode for final UI/UX quality, animation, hover, focus, and operation feel.
- `devtools`: headed mode with DevTools for targeted inspection.

Long-running browser supervision is opt-in. The default `observe` path should launch an ephemeral context, collect the requested evidence, close cleanly, and avoid reusing a user's normal browser profile.

## AI Interaction Contract

The CLI should expose structured observations and action candidates. The AI decides the next action outside the CLI, then sends that action back to the CLI. This keeps the tool agent-independent and avoids binding the product to one model, one chat UI, or one MCP runtime.

## Artifact Contract

Artifacts should be local by default and written under an ignored product workspace directory such as `.browser-debug/`. Planned artifact types include:

- screenshots
- traces
- console summaries
- network failure summaries
- accessibility summaries
- action history
- issue reports

Sensitive browser data must not be emitted unless a later approved feature defines safe redaction and explicit consent.

The initial artifact layout is:

```text
.browser-debug/
  sessions/
  observations/
  screenshots/
  traces/
  reports/
  specs/
```

Committed files must not include `.browser-debug/`, screenshots, traces, cookies, storage state, existing browser profiles, credentials, or secret-like values.

## JSON Output Contract

Every command that supports `--json` should return an object with these top-level fields:

```text
schema_version
command
status
observed_at
data
warnings
errors
artifacts
```

Errors must be structured and non-secret-bearing. Page content, console output, network data, screenshots, traces, and model suggestions remain untrusted data.

## Runtime Security Contract

- Browser contexts are ephemeral by default.
- Existing browser profiles, cookies, storage state, local storage, and credentials are not read or written.
- Artifact root paths must stay inside the current workspace.
- Observation and report data applies basic redaction to common secret-like strings and sensitive URL query parameters.
- Trace zip files are raw local evidence and can contain unredacted page content. They must remain under ignored `.browser-debug/` paths unless a future approved workflow defines safer handling.
- The current session model is file-backed metadata, not a long-running browser supervisor.

## OSS Workflow Contract

The repository should move through these phases:

- Phase 0: scaffold and synchronized planning documents.
- Phase 1: local Git initialization and first commit.
- Phase 2a: package/runtime design without network, dependency installation, or runtime implementation.
- Phase 2b: public GitHub repository creation through `gh`.
- Phase 3: GitHub Actions CI.
- Phase 4: npm package metadata and CLI packaging implementation.
- Phase 5: MVP Playwright implementation.
- Phase 6: release and npm publish flow.

The current repository only implements local release readiness documentation and dry-run package verification. It does not execute public release actions.

## Out of Scope for Phase 0

- Runtime CLI implementation.
- Dependency installation.
- Browser launch.
- GitHub remote creation.
- npm package publication.
- CI workflow execution.

## Out of Scope for Phase 2a

- Dependency installation.
- Browser launch.
- Runtime Playwright implementation.
- GitHub remote creation.
- CI workflow execution.
- npm package publication.

## Out of Scope for the Current Local MVP

- Long-running browser supervision.
- Existing browser profile reuse.
- Authentication automation, OAuth flows, webhook handling, external upload, and credential storage.
- Remote trace storage or trace upload.
- GitHub remote setup, CI workflow execution, npm publication, or external upload.

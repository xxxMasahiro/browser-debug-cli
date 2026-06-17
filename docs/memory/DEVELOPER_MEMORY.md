# DEVELOPER_MEMORY.md

## Standing Decisions

- The parent repository `ai-driven-development-lesson` and its root `AGENTS.MD` are the highest charter for parent-managed work.
- This repository's `AGENTS.MD` is the product-local charter for `browser-debug-cli`; it cannot weaken or override the parent charter.
- All future development work in this repository must be conducted in English.
- `AGENTS.MD` is the canonical agent entry point.
- Do not create legacy `AGENT.md`.
- Keep canonical product documents under `docs/product/`.
- Keep canonical workflow documents under `docs/workflow/`.
- Keep product memory under `docs/memory/`.
- Push, remote setup, GitHub repository creation, dependency installation, external communication, and destructive operations require explicit approval.

## Current Development Boundary

Phase 5 local MVP runtime is implemented. Local Git is initialized, the initial scaffold commit exists, package code exists, Playwright-backed observation works locally, and product-gate evidence has been recorded locally. No GitHub repository, remote, push, CI workflow, npm publication, OAuth/login automation, external upload, existing-browser-profile reuse, or credential storage has been created.

## Phase 2a Package/Runtime Design

Phase 2a records the package/runtime design without dependency installation, browser launch, GitHub repository creation, CI, npm publication, or runtime implementation.

Current design baseline:

- Working CLI binary: `browser-debug`.
- Runtime platform: Node.js 20 or newer, ESM modules.
- Default behavior: local-first, headless, artifact-safe, ephemeral browser context.
- First implementation slice: `doctor`, command parsing, deterministic JSON errors, and focused tests.
- First Playwright slice: one-shot `observe --url <url> --json`.
- Artifact root: ignored `.browser-debug/`.
- Long-running browser supervision: opt-in after one-shot observation is stable.

## Local MVP Runtime

- Runtime dependency: `playwright`.
- Implemented commands: `doctor`, `observe`, `session start`, `session close`, `act`, `report`, and `spec export`.
- Artifact root: ignored `.browser-debug/`.
- Default browser behavior: ephemeral Chromium context per observation/action.
- Verification: `npm test`, `npm run test:browser`, `npm run test:pack`, `./tools/product-gate`, and local Dashboard Control Center observation. Coverage includes headed/devtools launch-mode checks, observation, screenshot/trace artifacts, click actions, form controls, keyboard input, deterministic scroll, wait actions, reports, spec export, and local package dry-run verification.
- Release readiness: `CHANGELOG.md` and `docs/workflow/RELEASE.md` exist, but public package naming, license changes, GitHub publication, CI, and npm publication remain approval-bound.

# IMPLEMENTATION_PLAN.md

## Preconditions

- Work stays in `/home/masahiro/projects/agent-toolbox/browser-debug-cli`.
- The lesson repository remains the parent workflow source.
- Phase 0 is documentation and scaffold only.
- Runtime browser automation starts only after the scaffold and initial documents are verified.

## Phase Plan

### Phase 0: Scaffold and Document Sync

- Create the standard product repository structure.
- Add product-local `AGENTS.MD`, docs, ops manifests, skills, tools, `src/`, and `tests/`.
- Synchronize the initial five documents:
  - `docs/product/REQUIREMENTS.md`
  - `docs/product/SPECIFICATION.md`
  - `docs/product/IMPLEMENTATION_PLAN.md`
  - `docs/workflow/TASK_TRACKER.md`
  - `docs/workflow/HANDOFF.md`
- Run structure, document, security, design-system, and workflow-pair checks.

### Phase 1: Local Git

- Confirm the user wants to enter local Git mode.
- Run `git init`.
- Review `git status`.
- Create an initial commit once scaffold checks pass.
- Decide whether `.githooks/` should be added for product-local hooks.

### Phase 2a: Package and Runtime Design

- Record the local package baseline without installing dependencies.
- Use `browser-debug` as the working CLI binary name.
- Use Node.js 20 or newer and ESM modules.
- Define the command surface, JSON output contract, artifact layout, and security defaults.
- Keep the first implementation slice limited to `doctor`, command parsing, deterministic JSON errors, and focused tests.
- Keep the first Playwright slice limited to one-shot `observe --url <url> --json` with an ephemeral context.
- Keep long-running browser supervision opt-in and later than one-shot observation.
- Do not create a GitHub repository, install dependencies, launch browsers, add CI, or publish packages in this phase.

### Phase 2b: GitHub Public Repository

- Confirm public OSS repository name and owner.
- Use `gh auth status` and `gh repo create` only after approval.
- Push the initial branch.
- Add remote-sync notes to the handoff.

### Phase 3: CI

- Add `.github/workflows/` and `ops/CI_MANIFEST.tsv`. Completed locally.
- Add product-local CI manifest validation without remote execution. Completed with `tools/check_product_ci.sh`.
- Run local checks before push. Completed locally.
- Confirm GitHub Actions status after a remote repository and push exist.

### Phase 4: npm Package Design and Local CLI Scaffold

- Add `package.json`. Completed for the private local package.
- Use `browser-debug` as the local CLI binary name. Completed.
- Use ESM modules and Node.js 20 or newer. Completed.
- Keep the package private and `UNLICENSED` until public release naming and licensing are approved.
- Add package metadata, test commands, browser smoke commands, and distribution file declarations. Completed for the local MVP slice.
- Add local package dry-run verification without publishing. Completed with `npm run test:pack` and aggregate product-gate wiring.
- Add a local release-readiness command without publishing. Completed with `npm run release:check`.
- Preserve the Phase 2a design baseline unless the user approves a design change.

### Phase 5: MVP Runtime

- Implement `doctor`. Completed for local environment and safety checks.
- Implement command parsing and deterministic JSON error output. Completed for the planned command surface.
- Implement one-shot `observe`. Completed with Playwright-backed ephemeral Chromium contexts.
- Implement session start and simple actions. Completed for file-backed local session metadata and ephemeral action execution.
- Implement opt-in process-scoped browser supervision. Completed with `supervise --url <url> --actions <json-array>`.
- Implement opt-in local background browser daemon supervision. Completed with `daemon start`, `daemon status`, and `daemon stop` using an ephemeral local worker process.
- Implement artifact directory handling. Completed for sessions, observations, screenshots, traces, reports, and spec exports under `.browser-debug/`.
- Add focused tests for command parsing, observation output, action coverage, and safety boundaries. Completed with `npm test` and `npm run test:browser`.
- Add headed/devtools launch-mode regression coverage. Completed with deterministic no-GUI tests in `npm test`.
- Define JSON schema versioning details and the default artifact retention policy. Completed with `doctor` metadata, product docs, and deterministic tests.
- Keep authentication automation, external daemon control channels, profile reuse, credential handling, and external upload for later approved phases.

### Phase 6: Release

- Add release notes and changelog. Completed locally with `CHANGELOG.md`.
- Add release readiness checklist and publication blockers. Completed locally with `docs/workflow/RELEASE.md`.
- Confirm npm account and publishing method.
- Publish only after CI and release checklist pass.

## Verification Method

- `./tools/product-gate`
- `./tools/check_product_ci.sh`
- `npm test`
- `npm run test:browser`
- `npm run test:pack`
- `npm run release:check`
- lesson-side `product-scaffold-check` with this repository path.
- lesson-side `product-repository-authority status` with this repository path.
- `check_workflow_pair_sync.sh --repo <this-repo>`.
- Current local runtime checks include command parser tests, JSON error tests, `doctor` schema/retention metadata tests, headed/devtools launch-mode tests, session/report/spec tests, daemon parser tests, redaction tests, architecture regressions for generic runtime boundaries, shared page evidence helpers, and local daemon boundaries, Playwright browser smoke tests with screenshots, traces, click/form/keyboard/scroll/wait actions, supervised ordered actions, daemon start/status/stop, local package dry-run verification, Control Center observation, and aggregate product-gate execution.
- Later release work should run remote CI after GitHub repository creation and push, add real headed visual checks where a display is available, choose public package naming and license, and publish to npm after approval.

## Recovery Path

- If scaffold checks fail, fix missing canonical files or manifest format first.
- If document sync fails, update `TASK_TRACKER.md` and `HANDOFF.md` together.
- If security checks fail, remove committed secret-like data and update `SECURITY.md`.
- If Git/GitHub/npm steps are requested too early, stop and return to the phase plan.

## Approval Boundaries

- Ask before new runtime phases that add authentication, external daemon control channels, external upload, profile reuse, or credential handling.
- Ask before new dependency installation or network use.
- Ask before commit, push, branch deletion, or remote changes.
- Ask before `gh repo create`, remote setup, push, or any public GitHub action.
- Ask before npm publish.
- Ask before external uploads, OAuth, webhooks, credential storage, or destructive cleanup.

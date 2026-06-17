# VERIFICATION.md

## Verification Scope

Current verification checks repository structure, document synchronization, security defaults, design-system placeholders, product operation mode, local MVP runtime behavior, and browser smoke coverage.

## Product-Local Commands

```bash
npm test
npm run test:browser
npm run test:pack
./tools/check_product_structure.sh
./tools/check_product_docs.sh
./tools/check_product_security.sh
./tools/check_product_design_system.sh
./tools/test_product_repository.sh
./tools/product-gate
```

`./tools/test_product_repository.sh` and `./tools/product-gate` run `npm test` and `npm run test:pack` when `package.json` is present. `npm run test:browser` is intentionally separate because it launches local Chromium.

## Lesson-Side Commands

From `/home/masahiro/projects/ai-driven-development-lesson`:

```bash
./tools/product-scaffold-check check --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli --context free-development --product-type all --git-optional --ci-optional
./tools/product-repository-authority status --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli --context free-development --product-type all --git-optional --ci-optional
./tools/check_workflow_pair_sync.sh --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli
```

## Current Runtime Checks

The current implementation includes command parser tests, deterministic JSON error tests, `doctor` tests, headed/devtools launch-mode tests, session/report/spec tests, redaction tests, local package dry-run verification, and Playwright smoke tests for local file observation, screenshot/trace artifacts, click actions, form controls, keyboard input, deterministic scroll, wait actions, reports, and spec export. Manual local checks can use:

```bash
node ./bin/browser-debug.js observe --url http://127.0.0.1:5173/ --screenshot --trace --timeout 15000 --json
```

For this session, `http://127.0.0.1:5173/` was observed successfully with screenshot and trace artifacts, and `http://127.0.0.1:5174/` was not listening.

## Release Readiness Checks

`CHANGELOG.md` and `docs/workflow/RELEASE.md` are local release-readiness documents. They do not authorize publish actions. Public GitHub repository creation, CI setup, npm credentials, license changes, and `npm publish` remain approval-bound.

## Phase 2a Design Checks

- Product documents describe the same CLI binary, package baseline, JSON contract, artifact root, and safety defaults.
- `TASK_TRACKER.md` and `HANDOFF.md` agree on the current phase and next approval boundary.
- No GitHub remote, CI workflow, or npm publication path is added in the local MVP phase.
- Playwright visual checks are required after browser-runtime behavior changes when a suitable local target is available.

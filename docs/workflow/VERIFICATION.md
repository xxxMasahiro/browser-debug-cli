# VERIFICATION.md

## Verification Scope

Current verification checks repository structure, document synchronization, security defaults, CI configuration, design-system placeholders, product operation mode, local MVP runtime behavior, and browser smoke coverage.

## Product-Local Commands

```bash
npm test
npm run test:browser
npm run test:pack
npm run release:check
./tools/check_product_structure.sh
./tools/check_product_docs.sh
./tools/check_product_security.sh
./tools/check_product_ci.sh
./tools/check_product_design_system.sh
./tools/test_product_repository.sh
./tools/product-gate
```

`./tools/test_product_repository.sh` and `./tools/product-gate` run structure, docs, security, CI manifest, design-system, product mode, `npm test`, and `npm run test:pack` when `package.json` is present. `npm run test:browser` is intentionally separate because it launches local Chromium. `npm run release:check` is a no-publish convenience wrapper for no-browser and package dry-run checks.

## Lesson-Side Commands

From `/home/masahiro/projects/ai-driven-development-lesson`:

```bash
./tools/product-scaffold-check check --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli --context free-development --product-type all --git-optional --ci-optional
./tools/product-repository-authority status --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli --context free-development --product-type all --git-optional --ci-optional
./tools/check_workflow_pair_sync.sh --repo /home/masahiro/projects/agent-toolbox/browser-debug-cli
```

## Current Runtime Checks

The current implementation includes command parser tests, deterministic JSON error tests, `doctor` tests for environment, schema-versioning, and artifact-retention metadata, headed/devtools launch-mode tests, session/report/spec tests, daemon parser tests, redaction tests, architecture regressions for generic runtime boundaries, shared evidence helpers, and local daemon boundaries, local package dry-run verification, and Playwright smoke tests for local file observation, screenshot/trace artifacts, click actions, form controls, keyboard input, deterministic scroll, wait actions, reports, spec export, process-scoped supervision, and daemon start/status/stop. Manual local checks can use:

```bash
node ./bin/browser-debug.js observe --url http://127.0.0.1:3000/ --screenshot --trace --timeout 15000 --json
node ./bin/browser-debug.js supervise --url http://127.0.0.1:3000/ --actions '[{"type":"observe"}]' --timeout 15000 --json
node ./bin/browser-debug.js daemon start --url http://127.0.0.1:3000/ --timeout 15000 --json
node ./bin/browser-debug.js daemon status --daemon <id> --json
node ./bin/browser-debug.js daemon stop --daemon <id> --json
```

For this session, `http://127.0.0.1:5173/` was observed successfully with screenshot and trace artifacts, and `http://127.0.0.1:5174/` was not listening.

## Release Readiness Checks

`CHANGELOG.md`, `.github/workflows/ci.yml`, `ops/CI_MANIFEST.tsv`, and `docs/workflow/RELEASE.md` are local release-readiness files. They do not authorize publish actions. Public GitHub repository creation, remote CI execution, npm credentials, license changes, and `npm publish` remain approval-bound.

## Phase 2a Design Checks

- Product documents describe the same CLI binary, package baseline, JSON contract, artifact root, and safety defaults.
- `TASK_TRACKER.md` and `HANDOFF.md` agree on the current phase and next approval boundary.
- No GitHub remote, remote CI workflow execution, or npm publication path is added in the local MVP phase.
- Playwright visual checks are required after browser-runtime behavior changes when a suitable local target is available.

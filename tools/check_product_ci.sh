#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tools/lib/product_common.sh
source "$SCRIPT_DIR/lib/product_common.sh"

ROOT="$(product_repo_root)"
WORKFLOW="$ROOT/.github/workflows/ci.yml"
MANIFEST="$ROOT/ops/CI_MANIFEST.tsv"
failed=0

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! grep -Eq "$pattern" "$file"; then
    printf 'missing %s in %s\n' "$label" "$(product_rel "$ROOT" "$file")" >&2
    failed=1
  fi
}

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eiq "$pattern" "$file"; then
    printf 'forbidden %s in %s\n' "$label" "$(product_rel "$ROOT" "$file")" >&2
    failed=1
  fi
}

product_require_nonempty_file "$ROOT" .github/workflows/ci.yml || failed=1
product_require_nonempty_file "$ROOT" ops/CI_MANIFEST.tsv || failed=1

if [[ -s "$WORKFLOW" ]]; then
  require_pattern "$WORKFLOW" '^name: CI$' 'workflow name'
  require_pattern "$WORKFLOW" '^on:$' 'workflow triggers'
  require_pattern "$WORKFLOW" 'pull_request:' 'pull request trigger'
  require_pattern "$WORKFLOW" 'workflow_dispatch:' 'manual trigger'
  require_pattern "$WORKFLOW" 'permissions:' 'permissions block'
  require_pattern "$WORKFLOW" 'contents: read' 'read-only contents permission'
  require_pattern "$WORKFLOW" 'actions/checkout@v4' 'checkout action'
  require_pattern "$WORKFLOW" 'actions/setup-node@v4' 'Node setup action'
  require_pattern "$WORKFLOW" 'node-version:' 'Node version configuration'
  require_pattern "$WORKFLOW" 'run: npm ci' 'locked dependency install'
  require_pattern "$WORKFLOW" 'run: npm test' 'no-browser tests'
  require_pattern "$WORKFLOW" 'run: npm run test:pack' 'package dry-run tests'
  require_pattern "$WORKFLOW" 'run: npx playwright install --with-deps chromium' 'explicit Chromium install'
  require_pattern "$WORKFLOW" 'run: npm run test:browser' 'browser smoke tests'
  reject_pattern "$WORKFLOW" 'npm publish|gh repo|curl |wget |secrets\.' 'release, network upload, or secret usage'
fi

if [[ -s "$MANIFEST" ]]; then
  product_check_tsv "$MANIFEST" || {
    printf 'invalid TSV: ops/CI_MANIFEST.tsv\n' >&2
    failed=1
  }
  require_pattern "$MANIFEST" 'github_actions_node' 'node CI manifest row'
  require_pattern "$MANIFEST" 'github_actions_browser' 'browser CI manifest row'
  require_pattern "$MANIFEST" 'product_ci_manifest' 'local CI validation row'
fi

[[ "$failed" -eq 0 ]] || {
  printf 'Product CI check failed.\n' >&2
  exit 1
}

printf 'Product CI check passed.\n'

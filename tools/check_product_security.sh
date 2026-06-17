#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tools/lib/product_common.sh
source "$SCRIPT_DIR/lib/product_common.sh"

ROOT="$(product_repo_root)"
failed=0

product_require_nonempty_file "$ROOT" docs/workflow/SECURITY.md || failed=1
product_require_nonempty_file "$ROOT" ops/SECURITY_MANIFEST.tsv || failed=1
product_require_nonempty_file "$ROOT" .codex-plugin/plugin.json || failed=1
product_require_nonempty_file "$ROOT" .mcp.json || failed=1
product_require_nonempty_file "$ROOT" skills/browser-debug-review/SKILL.md || failed=1

while IFS= read -r -d '' file; do
  rel="$(product_rel "$ROOT" "$file")"
  case "$rel" in
    .git/*|node_modules/*|dist/*|build/*|coverage/*|test-results/*|playwright-report/*|.browser-debug/*)
      continue
      ;;
  esac
  grep -Iq . "$file" 2>/dev/null || continue
  if grep -Eq '(SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY)[[:space:]]*[:=][[:space:]]*[^[:space:]#]{8,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY' "$file"; then
    printf 'secret-like data found in %s\n' "$rel" >&2
    failed=1
  fi
done < <(find "$ROOT" -type f -print0)

while IFS= read -r -d '' file; do
  rel="$(product_rel "$ROOT" "$file")"
  printf 'environment file must not be committed: %s\n' "$rel" >&2
  failed=1
done < <(find "$ROOT" -type f \( -name '.env' -o -name '.env.*' \) -print0)

scan_runtime_pattern() {
  local pattern="$1"
  local label="$2"
  local ignore_regex="${3:-}"
  if grep -RInE "$pattern" "$ROOT/src" "$ROOT/bin" >/tmp/browser-debug-security-scan.$$ 2>/dev/null; then
    if [[ -n "$ignore_regex" ]]; then
      grep -Ev "$ignore_regex" /tmp/browser-debug-security-scan.$$ >/tmp/browser-debug-security-filtered.$$ || true
      mv /tmp/browser-debug-security-filtered.$$ /tmp/browser-debug-security-scan.$$
    fi
    if [[ ! -s /tmp/browser-debug-security-scan.$$ ]]; then
      rm -f /tmp/browser-debug-security-scan.$$
      return
    fi
    while IFS= read -r line; do
      printf 'forbidden runtime pattern for %s: %s\n' "$label" "${line#$ROOT/}" >&2
    done </tmp/browser-debug-security-scan.$$
    failed=1
  fi
  rm -f /tmp/browser-debug-security-scan.$$
}

scan_runtime_pattern 'launchPersistentContext|userDataDir|storageState' 'browser profile or persistent storage reuse'
scan_runtime_pattern 'createServer|listen\(|WebSocket|EventSource' 'external control channel'
scan_runtime_pattern 'node:child_process|child_process|execFile|spawn\(' 'arbitrary shell execution' 'src/daemon\.js:'
scan_runtime_pattern 'npm publish|gh repo|curl |wget ' 'publication or external transfer'

if ! grep -q 'browser-debug-mcp' "$ROOT/.mcp.json"; then
  printf 'plugin MCP configuration must reference browser-debug-mcp\n' >&2
  failed=1
fi

if grep -RInE 'createServer|listen\(|WebSocket|EventSource|curl |wget |npm publish|launchPersistentContext|userDataDir|storageState' \
  "$ROOT/.codex-plugin" "$ROOT/.mcp.json" "$ROOT/skills/browser-debug-review/SKILL.md" >/tmp/browser-debug-plugin-security.$$ 2>/dev/null; then
  while IFS= read -r line; do
    printf 'forbidden plugin metadata pattern: %s\n' "${line#$ROOT/}" >&2
  done </tmp/browser-debug-plugin-security.$$
  failed=1
fi
rm -f /tmp/browser-debug-plugin-security.$$

[[ "$failed" -eq 0 ]] || {
  printf 'Product security check failed.\n' >&2
  exit 1
}

printf 'Product security check passed.\n'

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
product_require_nonempty_file "$ROOT" skills/trace-cue-review/SKILL.md || failed=1

while IFS= read -r -d '' file; do
  rel="$(product_rel "$ROOT" "$file")"
  case "$rel" in
    .git/*|node_modules/*|dist/*|build/*|coverage/*|test-results/*|playwright-report/*|.browser-debug/*|.trace-cue/*|tools/check_product_security.sh)
      continue
      ;;
  esac
  grep -Iq . "$file" 2>/dev/null || continue
  secret_scan_file="/tmp/trace-cue-secret-scan.$$"
  if grep -nE '(SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY)[[:space:]]*[:=][[:space:]]*[^[:space:]#]{8,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY' "$file" >"$secret_scan_file"; then
    if [[ "$rel" == "tests/cli.test.js" ]]; then
      grep -Ev 'TRACE_CUE_TEST_SECRET:[[:space:]]*sentinel' "$secret_scan_file" >"/tmp/trace-cue-secret-filtered.$$" || true
      mv "/tmp/trace-cue-secret-filtered.$$" "$secret_scan_file"
    fi
  fi
  if [[ -s "$secret_scan_file" ]]; then
    printf 'secret-like data found in %s\n' "$rel" >&2
    failed=1
  fi
  rm -f "$secret_scan_file"
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
  if grep -RInE "$pattern" "$ROOT/src" "$ROOT/bin" >/tmp/trace-cue-security-scan.$$ 2>/dev/null; then
    if [[ -n "$ignore_regex" ]]; then
      grep -Ev "$ignore_regex" /tmp/trace-cue-security-scan.$$ >/tmp/trace-cue-security-filtered.$$ || true
      mv /tmp/trace-cue-security-filtered.$$ /tmp/trace-cue-security-scan.$$
    fi
    if [[ ! -s /tmp/trace-cue-security-scan.$$ ]]; then
      rm -f /tmp/trace-cue-security-scan.$$
      return
    fi
    while IFS= read -r line; do
      printf 'forbidden runtime pattern for %s: %s\n' "$label" "${line#$ROOT/}" >&2
    done </tmp/trace-cue-security-scan.$$
    failed=1
  fi
  rm -f /tmp/trace-cue-security-scan.$$
}

scan_runtime_pattern 'launchPersistentContext|userDataDir' 'browser profile reuse'
scan_runtime_pattern 'storageState' 'unapproved storageState persistence' 'src/browser-session-worker\.js:|src/browser-session-manager\.js:|src/mcp-profiles\.js:|src/operation-registry\.js:|src/mcp-capabilities\.js:'
scan_runtime_pattern 'createServer|listen\(|WebSocket|EventSource' 'unapproved external control channel' 'src/mcp-http-transport\.js:|src/agentic-human-review-responses-adapter\.js:'
scan_runtime_pattern "node:child_process|from ['\"]child_process|require\\(['\"]child_process|execFile|spawn\\(" 'arbitrary shell execution' "src/daemon\\.js:|src/browser-session-manager\\.js:[0-9]+:import \\{ spawn as defaultSpawn \\} from 'node:child_process';|src/browser-session-manager\\.js:[0-9]+:  const child = spawn\\(process\\.execPath, args, \\{"
scan_runtime_pattern 'npm publish|gh repo|curl |wget ' 'publication or external transfer'

if ! grep -q 'trace-cue-mcp' "$ROOT/.mcp.json"; then
  printf 'plugin MCP configuration must reference trace-cue-mcp\n' >&2
  failed=1
fi

if grep -RInE 'createServer|listen\(|WebSocket|EventSource|curl |wget |npm publish|launchPersistentContext|userDataDir|storageState' \
  "$ROOT/.codex-plugin" "$ROOT/.mcp.json" "$ROOT/skills/trace-cue-review/SKILL.md" >/tmp/trace-cue-plugin-security.$$ 2>/dev/null; then
  while IFS= read -r line; do
    printf 'forbidden plugin metadata pattern: %s\n' "${line#$ROOT/}" >&2
  done </tmp/trace-cue-plugin-security.$$
  failed=1
fi
rm -f /tmp/trace-cue-plugin-security.$$

if grep -RInE 'browser_debug_agentic.*review|agentic_human_review|raw_pixel_transfer|page_text_transfer' \
  "$ROOT/.codex-plugin" "$ROOT/.mcp.json" "$ROOT/src/mcp-profiles.js" >/tmp/trace-cue-agentic-mcp-security.$$ 2>/dev/null; then
  while IFS= read -r line; do
    printf 'agentic human review must not be exposed through MCP or plugin metadata: %s\n' "${line#$ROOT/}" >&2
  done </tmp/trace-cue-agentic-mcp-security.$$
  failed=1
fi
rm -f /tmp/trace-cue-agentic-mcp-security.$$

[[ "$failed" -eq 0 ]] || {
  printf 'Product security check failed.\n' >&2
  exit 1
}

printf 'Product security check passed.\n'

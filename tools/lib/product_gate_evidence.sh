#!/usr/bin/env bash

product_gate_evidence_repo_root() {
  if [[ -n "${PRODUCT_REPO_ROOT:-}" ]]; then
    printf '%s\n' "$PRODUCT_REPO_ROOT"
    return
  fi
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

product_gate_evidence_index() {
  local repo
  repo="$(product_gate_evidence_repo_root)"
  printf '%s/.git/product-gate-evidence/index.tsv\n' "$repo"
}

product_gate_evidence_dir() {
  local repo
  repo="$(product_gate_evidence_repo_root)"
  printf '%s/.git/product-gate-evidence\n' "$repo"
}

product_gate_evidence_ledger() {
  printf '%s/ledger.jsonl\n' "$(product_gate_evidence_dir)"
}

product_gate_evidence_details_dir() {
  printf '%s/details\n' "$(product_gate_evidence_dir)"
}

product_gate_evidence_sanitize() {
  local value="${1:-}"
  value="${value//$'\t'/ }"
  value="${value//$'\r'/ }"
  value="${value//$'\n'/ }"
  printf '%s' "$value"
}

product_gate_evidence_json_escape() {
  local value="${1:-}"
  value="$(product_gate_evidence_sanitize "$value")"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

product_gate_evidence_safe_id() {
  local value="${1:-}"
  value="$(product_gate_evidence_sanitize "$value")"
  value="${value//[^A-Za-z0-9._-]/-}"
  value="${value#-}"
  value="${value%-}"
  if [[ -z "$value" ]]; then
    value="unknown"
  fi
  printf '%s' "$value"
}

product_gate_evidence_validate_source_id() {
  case "$1" in
    repositories.product|repositories.product.*|product.docs|product.docs.*|product.workflow|product.workflow.*|product.git|product.git.*|product.ci|product.ci.*|product.security|product.security.*|product.approvals|product.approvals.*|product.design_system|product.design_system.*|product.gates|product.gates.*)
      return 0
      ;;
  esac
  return 1
}

product_gate_evidence_validate_context() {
  case "$1" in
    all|free-development|product-improvement|external-integration|lesson-maintenance|custom)
      return 0
      ;;
  esac
  return 1
}

product_gate_evidence_validate_status() {
  case "$1" in
    not_run|passed|failed|blocked|unknown|optional|cached|stale|not_applicable)
      return 0
      ;;
  esac
  return 1
}

product_gate_evidence_freshness_for_status() {
  case "$1" in
    not_run|not_applicable)
      printf 'not_collected'
      ;;
    stale)
      printf 'stale'
      ;;
    *)
      printf 'current'
      ;;
  esac
}

product_gate_evidence_now() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

product_gate_evidence_head() {
  local repo
  repo="$(product_gate_evidence_repo_root)"
  git -C "$repo" rev-parse --short=12 HEAD 2>/dev/null || printf 'none'
}

product_gate_evidence_root_label() {
  local repo
  repo="$(product_gate_evidence_repo_root)"
  printf '[external-product-repository]/%s' "$(basename "$repo")"
}

product_gate_evidence_header() {
  printf '# source_id\tcontext\tstatus\tfreshness_state\trequired_in_context\tauthority\tobserved_at\tmax_age_seconds\tproduct_root\tproduct_head\tsource_artifacts\tblocked_by\tnext_command\n'
}

product_gate_evidence_detail_code() {
  printf '%s.detail' "$(product_gate_evidence_safe_id "$1")"
}

product_gate_evidence_event_id() {
  local source_id="$1"
  local context="$2"
  local observed_at="$3"
  local nonce
  nonce="$(date -u '+%s%N' 2>/dev/null || date -u '+%s')"
  printf '%s-%s-%s-%s' \
    "$(product_gate_evidence_safe_id "$observed_at")" \
    "$(product_gate_evidence_safe_id "$source_id")" \
    "$(product_gate_evidence_safe_id "$context")" \
    "$(product_gate_evidence_safe_id "$nonce")"
}

product_gate_evidence_summary_for_status() {
  local source_id="$1"
  local status="$2"
  printf '%s %s' "$source_id" "$status"
}

product_gate_evidence_reason_for_status() {
  local status="$1"
  local source_artifacts="$2"
  local blocked_by="$3"
  case "$status" in
    passed)
      printf 'Recorded evidence passed using %s.' "${source_artifacts:-declared product checks}"
      ;;
    failed|blocked)
      printf 'Recorded evidence requires attention; blocked_by=%s.' "${blocked_by:-none}"
      ;;
    not_run)
      printf 'No evidence has been recorded for this source yet.'
      ;;
    stale)
      printf 'Recorded evidence is stale for the selected product state.'
      ;;
    *)
      printf 'Recorded evidence status is %s.' "$status"
      ;;
  esac
}

product_gate_evidence_next_action_for_status() {
  local status="$1"
  local next_command="$2"
  case "$status" in
    passed|not_applicable)
      printf 'Inspect details when a workflow decision needs supporting evidence.'
      ;;
    *)
      printf 'Review the source-specific detail and rerun the displayed command preview: %s' "${next_command:-not_applicable}"
      ;;
  esac
}

product_gate_evidence_write_detail() {
  local event_id="$1"
  local source_id="$2"
  local context="$3"
  local status="$4"
  local freshness_state="$5"
  local authority="$6"
  local observed_at="$7"
  local product_root="$8"
  local product_head="$9"
  local source_artifacts="${10}"
  local blocked_by="${11}"
  local next_command="${12}"
  local detail_code safe_summary reason next_action detail_dir detail_path ledger

  detail_code="$(product_gate_evidence_detail_code "$source_id")"
  safe_summary="$(product_gate_evidence_summary_for_status "$source_id" "$status")"
  reason="$(product_gate_evidence_reason_for_status "$status" "$source_artifacts" "$blocked_by")"
  next_action="$(product_gate_evidence_next_action_for_status "$status" "$next_command")"
  detail_dir="$(product_gate_evidence_details_dir)/$(product_gate_evidence_safe_id "$source_id")"
  detail_path="$detail_dir/$(product_gate_evidence_safe_id "$event_id").json"
  ledger="$(product_gate_evidence_ledger)"
  mkdir -p "$detail_dir" "$(dirname "$ledger")"

  {
    printf '{\n'
    printf '  "artifact_schema_version": "1.0.0",\n'
    printf '  "event_id": "%s",\n' "$(product_gate_evidence_json_escape "$event_id")"
    printf '  "source_id": "%s",\n' "$(product_gate_evidence_json_escape "$source_id")"
    printf '  "context": "%s",\n' "$(product_gate_evidence_json_escape "$context")"
    printf '  "status": "%s",\n' "$(product_gate_evidence_json_escape "$status")"
    printf '  "freshness_state": "%s",\n' "$(product_gate_evidence_json_escape "$freshness_state")"
    printf '  "authority": "%s",\n' "$(product_gate_evidence_json_escape "$authority")"
    printf '  "observed_at": "%s",\n' "$(product_gate_evidence_json_escape "$observed_at")"
    printf '  "product_root": "%s",\n' "$(product_gate_evidence_json_escape "$product_root")"
    printf '  "product_head": "%s",\n' "$(product_gate_evidence_json_escape "$product_head")"
    printf '  "detail_code": "%s",\n' "$(product_gate_evidence_json_escape "$detail_code")"
    printf '  "safe_summary": "%s",\n' "$(product_gate_evidence_json_escape "$safe_summary")"
    printf '  "reason": "%s",\n' "$(product_gate_evidence_json_escape "$reason")"
    printf '  "next_action": "%s",\n' "$(product_gate_evidence_json_escape "$next_action")"
    printf '  "source_artifacts": "%s",\n' "$(product_gate_evidence_json_escape "$source_artifacts")"
    printf '  "blocked_by": "%s",\n' "$(product_gate_evidence_json_escape "$blocked_by")"
    printf '  "next_command": "%s"\n' "$(product_gate_evidence_json_escape "$next_command")"
    printf '}\n'
  } >"$detail_path"

  printf '{"event_id":"%s","source_id":"%s","context":"%s","status":"%s","freshness_state":"%s","authority":"%s","observed_at":"%s","product_head":"%s","detail_artifact_path":"%s"}\n' \
    "$(product_gate_evidence_json_escape "$event_id")" \
    "$(product_gate_evidence_json_escape "$source_id")" \
    "$(product_gate_evidence_json_escape "$context")" \
    "$(product_gate_evidence_json_escape "$status")" \
    "$(product_gate_evidence_json_escape "$freshness_state")" \
    "$(product_gate_evidence_json_escape "$authority")" \
    "$(product_gate_evidence_json_escape "$observed_at")" \
    "$(product_gate_evidence_json_escape "$product_head")" \
    "$(product_gate_evidence_json_escape "${detail_path#$(product_gate_evidence_repo_root)/}")" >>"$ledger"
}

product_gate_evidence_record() {
  local source_id="${1:-}"
  local context="${2:-}"
  local status="${3:-}"
  local required_in_context="${4:-true}"
  local authority="${5:-authoritative}"
  local max_age_seconds="${6:-3600}"
  local source_artifacts="${7:-}"
  local blocked_by="${8:-}"
  local next_command="${9:-}"
  local freshness_state observed_at product_root product_head event_id index dir tmp

  product_gate_evidence_validate_source_id "$source_id" || {
    printf 'invalid product gate evidence source_id: %s\n' "$source_id" >&2
    return 1
  }
  product_gate_evidence_validate_context "$context" || {
    printf 'invalid product gate evidence context: %s\n' "$context" >&2
    return 1
  }
  product_gate_evidence_validate_status "$status" || {
    printf 'invalid product gate evidence status: %s\n' "$status" >&2
    return 1
  }
  case "$required_in_context" in true|false) ;; *)
    printf 'invalid product gate evidence required flag: %s\n' "$required_in_context" >&2
    return 1
    ;;
  esac
  case "$authority" in authoritative|manual_required|advisory|not_collected) ;; *)
    printf 'invalid product gate evidence authority: %s\n' "$authority" >&2
    return 1
    ;;
  esac
  [[ "$max_age_seconds" =~ ^[0-9]+$ ]] || {
    printf 'invalid product gate evidence max age: %s\n' "$max_age_seconds" >&2
    return 1
  }

  index="$(product_gate_evidence_index)"
  dir="$(dirname "$index")"
  if [[ ! -d "$(product_gate_evidence_repo_root)/.git" ]]; then
    printf 'product gate evidence requires a Git repository: %s\n' "$(product_gate_evidence_repo_root)" >&2
    return 1
  fi
  mkdir -p "$dir"
  tmp="$(mktemp "$dir/index.tsv.XXXXXX")"
  freshness_state="$(product_gate_evidence_freshness_for_status "$status")"
  observed_at="$(product_gate_evidence_now)"
  product_root="$(product_gate_evidence_root_label)"
  product_head="$(product_gate_evidence_head)"
  event_id="$(product_gate_evidence_event_id "$source_id" "$context" "$observed_at")"
  source_artifacts="$(product_gate_evidence_sanitize "$source_artifacts")"
  blocked_by="$(product_gate_evidence_sanitize "$blocked_by")"
  next_command="$(product_gate_evidence_sanitize "$next_command")"

  product_gate_evidence_header >"$tmp"
  if [[ -f "$index" ]]; then
    awk -F '\t' -v source_id="$source_id" -v context="$context" '
      /^[[:space:]]*$/ { next }
      $1 ~ /^#/ { next }
      NF == 13 && !($1 == source_id && $2 == context) { print }
    ' "$index" >>"$tmp"
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$source_id" "$context" "$status" "$freshness_state" "$required_in_context" "$authority" \
    "$observed_at" "$max_age_seconds" "$product_root" "$product_head" "$source_artifacts" \
    "$blocked_by" "$next_command" >>"$tmp"
  mv "$tmp" "$index"
  product_gate_evidence_write_detail "$event_id" "$source_id" "$context" "$status" "$freshness_state" \
    "$authority" "$observed_at" "$product_root" "$product_head" "$source_artifacts" "$blocked_by" "$next_command"
  printf 'Product gate evidence recorded: %s %s %s %s\n' "$source_id" "$context" "$status" "$event_id"
}

product_gate_evidence_run() {
  local source_id="${1:-}"
  local context="${2:-}"
  local source_artifacts="${3:-}"
  local next_command="${4:-}"
  local max_age_seconds="${5:-3600}"
  local had_errexit=0
  local rc
  shift 5 || true
  if [[ "${1:-}" == "--" ]]; then
    shift
  fi
  if [[ "$#" -eq 0 ]]; then
    product_gate_evidence_record "$source_id" "$context" "blocked" "true" "manual_required" "$max_age_seconds" "$source_artifacts" "$source_id" "$next_command"
    return 2
  fi
  case "$-" in
    *e*)
      had_errexit=1
      set +e
      ;;
  esac
  "$@"
  rc=$?
  if [[ "$had_errexit" -eq 1 ]]; then
    set -e
  fi
  if [[ "$rc" -eq 0 ]]; then
    product_gate_evidence_record "$source_id" "$context" "passed" "true" "authoritative" "$max_age_seconds" "$source_artifacts" "" "$next_command"
  else
    product_gate_evidence_record "$source_id" "$context" "failed" "true" "authoritative" "$max_age_seconds" "$source_artifacts" "$source_id" "$next_command"
  fi
  return "$rc"
}

product_gate_evidence_git_status() {
  local context="${1:-free-development}"
  local max_age_seconds="${2:-300}"
  local repo branch porcelain upstream counts ahead behind worktree_status upstream_status sync_status blocked_by
  repo="$(product_gate_evidence_repo_root)"
  if [[ ! -d "$repo/.git" ]]; then
    product_gate_evidence_record "product.git.worktree" "$context" "blocked" "true" "manual_required" "$max_age_seconds" ".git" "repositories.product" "git status --short"
    return 1
  fi

  branch="$(git -C "$repo" branch --show-current 2>/dev/null || true)"
  [[ -n "$branch" ]] || branch="detached"
  porcelain="$(git -C "$repo" status --short 2>/dev/null || true)"
  if [[ -z "$porcelain" ]]; then
    worktree_status="passed"
    blocked_by=""
  else
    worktree_status="failed"
    blocked_by="product.git.worktree"
  fi
  product_gate_evidence_record "product.git.worktree" "$context" "$worktree_status" "true" "authoritative" "$max_age_seconds" "git status --short;branch=$branch" "$blocked_by" "git status --short"

  upstream="$(git -C "$repo" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    product_gate_evidence_record "product.git.upstream" "$context" "not_run" "false" "advisory" "$max_age_seconds" "git rev-parse --abbrev-ref --symbolic-full-name @{u}" "product.git.upstream" "git branch -vv"
    product_gate_evidence_record "product.git.local_remote_sync" "$context" "not_run" "false" "advisory" "$max_age_seconds" "git rev-list --left-right --count HEAD...@{u}" "product.git.upstream" "git branch -vv"
    return 0
  fi

  product_gate_evidence_record "product.git.upstream" "$context" "passed" "true" "authoritative" "$max_age_seconds" "git upstream=$upstream" "" "git branch -vv"
  counts="$(git -C "$repo" rev-list --left-right --count "HEAD...@{u}" 2>/dev/null || true)"
  ahead="${counts%%[[:space:]]*}"
  behind="${counts##*[[:space:]]}"
  [[ "$ahead" =~ ^[0-9]+$ ]] || ahead=0
  [[ "$behind" =~ ^[0-9]+$ ]] || behind=0
  if [[ "$ahead" -eq 0 && "$behind" -eq 0 ]]; then
    sync_status="passed"
    blocked_by=""
  else
    sync_status="failed"
    blocked_by="product.git.local_remote_sync"
  fi
  product_gate_evidence_record "product.git.local_remote_sync" "$context" "$sync_status" "true" "authoritative" "$max_age_seconds" "git ahead=$ahead;behind=$behind;upstream=$upstream" "$blocked_by" "git status -sb"
}

product_gate_evidence_status() {
  local index ledger details
  index="$(product_gate_evidence_index)"
  ledger="$(product_gate_evidence_ledger)"
  details="$(product_gate_evidence_details_dir)"
  printf 'Product gate evidence index: %s\n' "${index#$(product_gate_evidence_repo_root)/}"
  if [[ -f "$index" ]]; then
    printf 'Status: ready\n'
  else
    printf 'Status: not_collected\n'
  fi
  if [[ -f "$ledger" ]]; then
    printf 'Ledger: ready\n'
  else
    printf 'Ledger: not_collected\n'
  fi
  if [[ -d "$details" ]]; then
    printf 'Details: ready\n'
  else
    printf 'Details: not_collected\n'
  fi
}

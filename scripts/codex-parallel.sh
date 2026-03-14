#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

usage() {
  cat <<'EOF'
Usage: scripts/codex-parallel.sh MANIFEST.tsv [RUN_LABEL]

Launch one `codex exec` worker per manifest row.

Manifest format:
  name<TAB>branch<TAB>worktree<TAB>prompt_file<TAB>owned_paths

Rules:
  - `worktree` and `prompt_file` can be absolute or repo-relative.
  - Blank lines and lines starting with `#` are ignored.
  - `owned_paths` is injected into the worker prompt as a write-scope contract.

Artifacts:
  .codex-orchestrator/runs/<RUN_LABEL>/
    logs/<name>.log
    prompts/<name>.md
    results/<name>.md
    summary.tsv

Environment:
  CODEX_MODEL=<model>   Optional model override passed to `codex exec`.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
}

resolve_path() {
  local input_path="$1"
  if [[ "$input_path" = /* ]]; then
    printf '%s\n' "$input_path"
  else
    printf '%s\n' "${REPO_ROOT}/${input_path}"
  fi
}

ensure_worktree() {
  local branch_name="$1"
  local worktree_path="$2"
  local current_branch

  if git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    current_branch=$(git -C "$worktree_path" branch --show-current)
    [[ "$current_branch" = "$branch_name" ]] || die "Worktree ${worktree_path} is on branch ${current_branch}, expected ${branch_name}"
    return
  fi

  [[ ! -e "$worktree_path" ]] || die "Path exists but is not a git worktree: ${worktree_path}"
  mkdir -p "$(dirname "$worktree_path")"

  if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    git worktree add "$worktree_path" "$branch_name" >/dev/null
  else
    git worktree add -b "$branch_name" "$worktree_path" >/dev/null
  fi
}

write_agent_prompt() {
  local prompt_source="$1"
  local owned_paths="$2"
  local output_path="$3"

  {
    echo "You are one worker in a coordinated Codex run for the Later Life Planner repository."
    echo
    echo "Rules:"
    echo "- Only modify files inside these owned paths: ${owned_paths}"
    echo "- Treat files outside those paths as read-only, even if they are mentioned in passing."
    echo "- If the task genuinely requires a shared file outside your owned paths, stop and report the blocker."
    echo "- Do not run destructive git commands."
    echo "- Keep changes narrow and leave integration to the parent branch."
    echo "- End with three short sections: Changed files, Verification, Open issues."
    echo
    echo "Task:"
    echo
    cat "$prompt_source"
  } > "$output_path"
}

[[ "${1:-}" = "-h" || "${1:-}" = "--help" ]] && {
  usage
  exit 0
}

MANIFEST_INPUT="${1:-}"
RUN_LABEL="${2:-$(date +"%Y%m%d-%H%M%S")}"

[[ -n "$MANIFEST_INPUT" ]] || {
  usage >&2
  exit 1
}

require_command git
require_command codex

MANIFEST_PATH=$(resolve_path "$MANIFEST_INPUT")
[[ -f "$MANIFEST_PATH" ]] || die "Manifest not found: ${MANIFEST_PATH}"

RUN_ROOT="${REPO_ROOT}/.codex-orchestrator/runs/${RUN_LABEL}"
mkdir -p "${RUN_ROOT}/logs" "${RUN_ROOT}/prompts" "${RUN_ROOT}/results"

SUMMARY_FILE="${RUN_ROOT}/summary.tsv"
printf 'name\tbranch\tworktree\tresult\tlog\tstatus\n' > "$SUMMARY_FILE"

declare -a AGENT_NAMES=()
declare -a AGENT_BRANCHES=()
declare -a AGENT_WORKTREES=()
declare -a AGENT_RESULTS=()
declare -a AGENT_LOGS=()
declare -a AGENT_PIDS=()

agent_count=0

while IFS=$'\t' read -r name branch worktree prompt_file owned_paths extra; do
  [[ -n "${name//[[:space:]]/}" ]] || continue
  [[ "$name" != \#* ]] || continue
  [[ -z "${extra:-}" ]] || die "Too many columns for agent ${name}"
  [[ -n "${branch:-}" && -n "${worktree:-}" && -n "${prompt_file:-}" && -n "${owned_paths:-}" ]] || die "Manifest row is missing fields for agent ${name}"

  worktree_path=$(resolve_path "$worktree")
  prompt_path=$(resolve_path "$prompt_file")
  [[ -f "$prompt_path" ]] || die "Prompt file not found for agent ${name}: ${prompt_path}"

  ensure_worktree "$branch" "$worktree_path"

  combined_prompt="${RUN_ROOT}/prompts/${name}.md"
  result_file="${RUN_ROOT}/results/${name}.md"
  log_file="${RUN_ROOT}/logs/${name}.log"

  write_agent_prompt "$prompt_path" "$owned_paths" "$combined_prompt"

  cmd=(codex exec --full-auto -C "$worktree_path" -o "$result_file")
  if [[ -n "${CODEX_MODEL:-}" ]]; then
    cmd+=(-m "$CODEX_MODEL")
  fi
  cmd+=(-)

  "${cmd[@]}" < "$combined_prompt" > "$log_file" 2>&1 &

  AGENT_NAMES+=("$name")
  AGENT_BRANCHES+=("$branch")
  AGENT_WORKTREES+=("$worktree_path")
  AGENT_RESULTS+=("$result_file")
  AGENT_LOGS+=("$log_file")
  AGENT_PIDS+=("$!")

  echo "[launch] ${name} -> ${worktree_path} (${branch})"
  agent_count=$((agent_count + 1))
done < "$MANIFEST_PATH"

[[ "$agent_count" -gt 0 ]] || die "Manifest did not contain any runnable agents."

failures=0

for index in "${!AGENT_PIDS[@]}"; do
  status="ok"
  if wait "${AGENT_PIDS[$index]}"; then
    echo "[done] ${AGENT_NAMES[$index]} -> ${AGENT_RESULTS[$index]}"
  else
    exit_code=$?
    status="exit:${exit_code}"
    failures=$((failures + 1))
    echo "[fail] ${AGENT_NAMES[$index]} -> ${AGENT_LOGS[$index]} (exit ${exit_code})" >&2
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${AGENT_NAMES[$index]}" \
    "${AGENT_BRANCHES[$index]}" \
    "${AGENT_WORKTREES[$index]}" \
    "${AGENT_RESULTS[$index]}" \
    "${AGENT_LOGS[$index]}" \
    "$status" >> "$SUMMARY_FILE"
done

echo
echo "Artifacts: ${RUN_ROOT}"
echo "Summary:   ${SUMMARY_FILE}"

if [[ "$failures" -gt 0 ]]; then
  exit 1
fi

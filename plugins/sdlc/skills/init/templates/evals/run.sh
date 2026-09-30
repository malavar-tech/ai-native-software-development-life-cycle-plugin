#!/usr/bin/env bash
# Agent evals (Stage 4: Test, "Continuous evals in CI").
# Each case in evals/cases/*.json is a real task with the checks that define "acceptable".
# The task starts from the case's baseRef, but the agent configuration under test
# (CLAUDE.md and .claude/) is always the current checkout: that is what evals regress.
#
# Env: EVAL_PASS_THRESHOLD (default 0.8), EVAL_RESULTS_DIR (default evals/results),
#      EVAL_FILTER (optional substring to run a subset). Needs: git, jq, claude.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
CASES_DIR="$ROOT/evals/cases"
RESULTS_DIR="${EVAL_RESULTS_DIR:-$ROOT/evals/results}"
THRESHOLD="${EVAL_PASS_THRESHOLD:-0.8}"
FILTER="${EVAL_FILTER:-}"
mkdir -p "$RESULTS_DIR"

for bin in git jq claude; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 2; }
done

total=0; passed=0; summary=""
for case_file in "$CASES_DIR"/*.json; do
  [ -e "$case_file" ] || continue
  name="$(basename "$case_file")"
  [[ "$name" == _* ]] && continue
  [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && continue

  id="$(jq -r '.id' "$case_file")"
  prompt="$(jq -r '.prompt' "$case_file")"
  tools="$(jq -r '.allowedTools // "Read,Grep,Glob,Edit,Write,Bash"' "$case_file")"
  base="$(jq -r '.baseRef // "HEAD"' "$case_file")"
  max_turns="$(jq -r '.maxTurns // 30' "$case_file")"
  log="$RESULTS_DIR/$id.log"
  : > "$log"

  wt="$(mktemp -d)"
  git -C "$ROOT" worktree add --detach "$wt" "$base" >/dev/null 2>&1
  # Overlay the agent configuration under test onto the task's starting state.
  [ -f "$ROOT/CLAUDE.md" ] && cp "$ROOT/CLAUDE.md" "$wt/CLAUDE.md"
  if [ -d "$ROOT/.claude" ]; then rm -rf "$wt/.claude"; cp -R "$ROOT/.claude" "$wt/.claude"; fi

  total=$((total + 1))
  echo "▶ $id" | tee -a "$log"
  ( cd "$wt" && claude -p "$prompt" --allowedTools "$tools" --max-turns "$max_turns" \
      --output-format json > "$RESULTS_DIR/$id.result.json" 2>>"$log" ) || echo "claude exited non-zero" >> "$log"

  ok=1
  while IFS= read -r check; do
    [ -z "$check" ] && continue
    if ( cd "$wt" && bash -c "$check" ) >>"$log" 2>&1; then
      echo "  ✓ $check" | tee -a "$log"
    else
      echo "  ✗ $check" | tee -a "$log"; ok=0
    fi
  done < <(jq -r '.checks[]' "$case_file")

  git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
  if [ "$ok" -eq 1 ]; then passed=$((passed + 1)); summary+="PASS $id"$'\n'; else summary+="FAIL $id"$'\n'; fi
done

if [ "$total" -eq 0 ]; then echo "No eval cases found in $CASES_DIR"; exit 0; fi
rate="$(awk -v p="$passed" -v t="$total" 'BEGIN { printf "%.2f", p / t }')"
printf '%s' "$summary"
echo "Pass rate: $passed/$total = $rate (threshold $THRESHOLD)"
jq -n --arg rate "$rate" --argjson passed "$passed" --argjson total "$total" \
  '{passed: $passed, total: $total, rate: ($rate | tonumber)}' > "$RESULTS_DIR/summary.json"
awk -v r="$rate" -v t="$THRESHOLD" 'BEGIN { exit (r + 0 >= t + 0) ? 0 : 1 }'

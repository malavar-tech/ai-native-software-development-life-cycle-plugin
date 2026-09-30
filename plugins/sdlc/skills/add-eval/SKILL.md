---
name: add-eval
description: Add a case to the agent eval suite (evals/cases/) from a real task — a shipped incident fix, a merged change or a repeated review finding — so future changes to the model, CLAUDE.md, skills or hooks are regression-tested against it.
disable-model-invocation: true
argument-hint: "[change id | PR number | commit]"
---

# Add an eval case

Evals test the agent's configuration, not the application: when the model, CLAUDE.md, a skill or a hook
changes, the suite says whether Claude still does this kind of work to the same standard.

## Steps

1. **Pick the source** from `$ARGUMENTS`: an incident or change under `intent/`, a PR, or a commit. Find the commit where the task started (before the fix/feature landed) — that is `baseRef` — and the accepted outcome (the merged diff and its tests).
2. **Write the prompt** the way a person would actually give the task, without hints from the solution.
3. **Write the checks**: shell commands run in the task's worktree after Claude finishes; each must exit 0. Prefer behavior checks (the regression test from the fix passes, the endpoint returns the expected value) plus guard checks (tests not modified: `git diff --quiet HEAD -- <test paths>`, lint clean). Avoid checks that pin one exact implementation.
4. **Create `evals/cases/<id>.json`** following `evals/cases/_template.json` (`id`, `source`, `baseRef`, `prompt`, `allowedTools`, `maxTurns`, `checks`). Validate it with `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"`.
5. **Sanity-check the checks** against the accepted outcome: check out the fixed commit in a scratch worktree and run the checks there; they must pass. If `claude` and `jq` are available and the user agrees to the cost, run `EVAL_FILTER=<id> ./evals/run.sh`.
6. Commit the case: `git commit -m "eval: <id>"`, and mention it in the incident's intent.md if it came from one.

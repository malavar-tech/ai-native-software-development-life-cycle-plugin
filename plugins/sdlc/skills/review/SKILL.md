---
name: review
description: Stage 5 (Deploy). Review a pull request, branch or the staged diff against REVIEW.md, CLAUDE.md and the change's spec.md/plan.md in separate passes, ranked by severity; optionally address the findings. Never approves or merges.
disable-model-invocation: true
argument-hint: "[PR number | branch | --staged] [--fix]"
---

# Agentic review

Every change gets the same passes. Human attention moves up a level: does the change do what the
plan intended, and is the risk acceptable?

## Steps

1. **Resolve the target** from `$ARGUMENTS`: a PR number (`gh pr view <n>`, `gh pr diff <n>`), a branch (`git diff <main>...<branch>`), `--staged` (`git diff --cached`), or by default the current branch against the main branch.
2. **Delegate to the `reviewer` subagent** with the target, so the review runs in a fresh context that did not write the code. Pass the change id if you know it.
3. **Present the findings** as the reviewer returns them: summary, Important, Nits (max five), repeated findings. Add the counts line `sdlc-review: important=<n> nit=<n>`.
4. **Post them** if the target is a PR and the user agrees: one comment with `gh pr comment <n> --body-file -`.
5. **Feed the loop back**:
   - For each Important finding, append a line to `.claude/sdlc-findings.md` (`YYYY-MM-DD — category — example`). If the category was already there, propose the correction for `CLAUDE.md` ("Things Claude gets wrong") and, with the user's approval, add it in the same PR.
   - If the review says CLAUDE.md is outdated, propose the edit.
6. **With `--fix`** (or when the user asks): address the findings one by one on the PR branch, run the verify command, push, and summarize what changed per finding. Findings you disagree with get a reasoned reply instead of a change.

A human code owner approves the merge. Do not approve, merge or push to the main branch.

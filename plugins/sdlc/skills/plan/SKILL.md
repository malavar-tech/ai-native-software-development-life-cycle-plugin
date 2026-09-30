---
name: plan
description: Stage 3 (Build). Produce and interrogate the implementation plan for an approved spec, in plan mode, then commit it as plan.md before any code is written and keep it in sync during the build.
disable-model-invocation: true
argument-hint: "[change id]"
---

# Plan before code

Design review happens while changing course is still editing a document. The approved plan is
committed so the PR review can check the diff against it.

## Steps

1. **Plan mode.** If this session is not in plan mode, ask the user to switch (Shift+Tab until "plan mode") and re-run, or proceed read-only: do not edit any file until the plan is approved.
2. **Read** `intent/<id>/intent.md`, `intent/<id>/spec.md` (use `$ARGUMENTS` as id or ask), `CLAUDE.md`, and the code the spec touches. Use the `researcher` subagent for wide exploration.
3. **Draft the plan** with the structure of `intent/_templates/plan.md` (or `${CLAUDE_SKILL_DIR}/../init/templates/intent/_templates/plan.md`): files that change, order of work (steps small enough to verify independently), risks, alternatives considered, proof (tests, a quantifiable verify target, visual check for UI), and tasks that could run in parallel worktrees because they touch different files.
4. **Interrogate it yourself before presenting**: what could this break? Which step is riskiest and how is it mitigated? What did you choose not to do and why? Put the answers in the plan so the engineer can challenge them.
5. **Iterate with the engineer** until someone who never saw this conversation could implement the change from the plan alone. Present it with the plan-mode approval so the user accepts it explicitly.
6. **Commit the plan before code.** Once approved: write `intent/<id>/plan.md` (configured language) with `Status: approved by <name> on <date>`, set intent.md to `Status: building`, and commit both: `git commit -m "sdlc(<id>): plan" -m "Approved-by: <approver>"`. Work on a branch `sdlc/<id>` if you are not on one.
7. **Implement** following the order of work, running the verify command after each step (the `verify` skill). For routine changes with a tight spec and good test coverage, the user may switch to auto mode now.
8. **Keep plan and code in sync.** When the implementation departs from the plan, add a line to the Deviations log and commit plan.md in the same commit as the code that deviates.
9. When done: run the `verifier` subagent, set intent.md to `Status: in-review`, push the branch and open a PR whose body links `intent/<id>/`. Next: `/sdlc:review`.

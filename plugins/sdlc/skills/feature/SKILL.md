---
name: feature
description: The whole loop for one change in a single session (solo flow) — capture intent, write the spec, plan in plan mode, build with the verification loop, and open the PR for review — stopping only at the human decision points.
disable-model-invocation: true
argument-hint: "[what you want to build]"
---

# One change, end to end

This is the collapsed flow for a person who is originator, product owner and engineer at once.
It keeps every artifact of the playbook (intent.md, spec.md, plan.md, verified diff, reviewed PR)
and removes only the hand-offs between roles. The human decision points stay.

Input: `$ARGUMENTS`.

## Flow

1. **Branch.** `git checkout -b sdlc/<id>` from an up-to-date main branch (`<id>` = `<YYYY-MM-DD>-<slug>`).
2. **Intent** — follow `${CLAUDE_SKILL_DIR}/../intent/SKILL.md` steps 1–4. Keep the interview short: ask only what is missing.
   ⏸ **Decision 1:** the user confirms the intent says what they mean. Commit it as accepted.
3. **Spec** — follow `${CLAUDE_SKILL_DIR}/../spec/SKILL.md` steps 2–5.
   ⏸ **Decision 2:** resolve every flagged concern with the user, then get approval. Commit.
   If the risk class is `higher-risk`, recommend a second reviewer before building and let the user decide.
4. **Plan** — follow `${CLAUDE_SKILL_DIR}/../plan/SKILL.md` steps 1–6 (ask the user to enter plan mode now if they are not in it).
   ⏸ **Decision 3:** plan approval. Commit plan.md before any code.
5. **Build** — plan steps 7–8: implement in order, run the verify command after each step, keep the Deviations log.
6. **Verify** — run the `verifier` subagent. Fix what it reports until the verdict is PASS, or explain honestly why not.
7. **PR** — set `Status: in-review`, push, open the PR linking `intent/<id>/`, and run `/sdlc:review` on it (or let the review workflow do it).
   ⏸ **Decision 4:** the human reviews findings and merges. After merge, set `Status: done` (in the next commit or a follow-up).

Small changes (a typo, a one-line config tweak) do not need this: say so and just do them with the verify loop.

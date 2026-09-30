---
name: intent
description: Stage 1 (Plan). Turn an idea, ticket or request into intent/<id>/intent.md by interviewing the originator like an analyst, then record the accept/reject decision.
disable-model-invocation: true
argument-hint: "[idea, ticket id or link]"
---

# Capture intent

`intent.md` is a proto-spec in the originator's own terms: what is wanted, why, and under which
constraints. It is human readable, versioned, and the input of the next stage. It is **not** a spec:
no implementation details, no file names, no technology choices unless they are real constraints.

Input: `$ARGUMENTS` (a description, a ticket id/link, or nothing).

## Steps

1. **Read the source.** If the input references a ticket, issue, document or thread and a connector or `gh` can read it, pull it. Record its id in `Source:` (the external tool stays linked, the repo holds the artifact).
2. **Brainstorm until the idea is concrete.** Let the originator describe it freely first. Then ask the questions an analyst would ask, only those not yet answered, in one or two rounds:
   - What can't be done today, who is affected, how often?
   - What does better look like? How will we know it worked?
   - What is out of scope?
   - Which constraints apply (security, privacy, compatibility, deadlines, cost)?
   - Which systems and people are touched?
3. **Write the artifact.** Id = `<YYYY-MM-DD>-<kebab-slug>`. Use `intent/_templates/intent.md` if the project has it, otherwise `${CLAUDE_SKILL_DIR}/../init/templates/intent/_templates/intent.md`. Write in the language set in `.claude/sdlc.json` (`language`). Keep the originator's vocabulary; do not upgrade it into jargon. `Status: draft`.
4. **Correct.** Show the file and ask the originator what you misunderstood. Iterate until they confirm it says what they meant.
5. **Record the decision** (read `mode` and `approvers` from `.claude/sdlc.json`):
   - **solo**: when the user explicitly accepts, set `Status: accepted` and commit only that file: `git commit -m "sdlc(<id>): intent" -m "Approved-by: <approver>"`. If they reject, set `Status: rejected` and commit it anyway (rejections are part of the record).
   - **team**: commit on a branch `intent/<id>` and open a PR (`gh pr create`) for the product owner; merging is acceptance, closing is rejection. Leave `Status: draft` in the PR; the approver flips it to `accepted` on merge.
6. Tell the user the next step: `/sdlc:spec <id>`. Do not start the spec yourself unless you were invoked from `/sdlc:feature`.

---
name: spec
description: Stage 2 (Design). From an accepted intent.md, produce requirements and design in one pass as spec.md, constrained by the project's skills and policies, with areas of concern flagged first.
disable-model-invocation: true
argument-hint: "[change id]"
---

# Requirements and design

Requirements and design happen in one working session. The approver reviews the spec; they do not write it.

## Steps

1. **Pick the change.** Use `$ARGUMENTS` as the id; otherwise list changes under `intent/` with `Status: accepted` and ask which. If the intent is not accepted, say so and ask whether to continue anyway (and note it in the spec).
2. **Load the constraints.** Read `intent.md`, `CLAUDE.md`, and every policy skill available in this session (brand, security, compliance, UX, API conventions, whatever the project or organization provides). Note which ones you apply; they go in the spec header. Use the `researcher` subagent to map the relevant code without flooding your context.
3. **Write `intent/<id>/spec.md`** from `intent/_templates/spec.md` (or `${CLAUDE_SKILL_DIR}/../init/templates/intent/_templates/spec.md`), in the configured language, as a spec for integrating the intent into the existing codebase:
   - **Flagged concerns first**: every place where policies contradict each other or the intent, where a constraint cannot be met, where risk or ambiguity remains. Give options and the owner who must decide.
   - Numbered, testable requirements; user-facing behavior including empty and error states; technical design at the level of components, data and interfaces (the file-level detail belongs to the plan).
   - Answer the intent's open questions or carry them forward with an owner.
   - Acceptance criteria that can be checked by a command or an observation.
   - Risk class: `routine` or `higher-risk` (auth, payments, data migrations, public APIs, security-sensitive paths), with the reason.
   - For UI work, if a mock exists (e.g. from Claude Design), link it; the plan will verify against it.
4. **Resolve concerns before anything else.** Walk the user through the flagged concerns one by one and record each resolution in the table. Engineering should not see unresolved concerns.
5. **Review against the intent.** Does the spec solve the stated problem? Are the open questions answered or carried forward? Fix gaps.
6. **Record the decision** (per `.claude/sdlc.json`):
   - **solo**: on explicit approval set `Status: approved` in spec.md and `Status: specified` in intent.md; commit both: `git commit -m "sdlc(<id>): spec" -m "Approved-by: <approver>"`. If the risk class is `higher-risk`, say that a second pair of eyes is recommended before build.
   - **team**: open a PR with spec.md; merge = acceptance. Higher-risk changes need the technical lead's approval too.
7. Next step: `/sdlc:plan <id>`, ideally from a session in plan mode.

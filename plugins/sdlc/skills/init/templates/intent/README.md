# intent/

Home of the change artifacts for this repository, following the AI-native SDLC loop.
Each change lives in its own folder, `intent/<YYYY-MM-DD>-<slug>/`, and accumulates the
artifacts stage by stage. Every artifact is committed, so Git history is the audit trail:
who asked for what, what the agent produced and who approved it.

| File | Stage | Written by | Approved by |
|------|-------|------------|-------------|
| `intent.md` | Plan | Claude, from the originator's words (`/sdlc:intent`) | Product owner |
| `spec.md` | Design | Claude, constrained by the project skills (`/sdlc:spec`) | Product owner (+ tech lead if higher-risk) |
| `plan.md` | Build | Claude in plan mode (`/sdlc:plan`) | Engineer |

The diff and its tests, the PR with its review findings, and incident records complete the chain.

## Status values

The `Status:` field on the second line of `intent.md` moves through:
`draft → accepted → specified → planned → building → in-review → done`, or ends in `rejected`.
Incidents start as `triage` and become `accepted` (fix now), `scheduled`, or `dismissed`.

## Approval

- **Solo mode:** approvals happen in the session and are recorded as a commit with an
  `Approved-by:` trailer. One branch per change carries all artifacts and code, and the
  pull request is the review gate.
- **Team mode:** `intent.md` and `spec.md` are proposed as pull requests; merging is the
  acceptance. `plan.md` travels with the code in the implementation PR.

Templates live in `intent/_templates/`. Adjust them to the project; the skills read them first.

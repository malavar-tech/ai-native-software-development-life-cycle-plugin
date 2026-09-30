# {{PROJECT_NAME}}
{{ONE_LINE_DESCRIPTION}} Must never break: {{MUST_NEVER_BREAK}}.

## Commands
- Verify (build + lint + tests, non-zero exit on failure): `{{VERIFY}}` — healthy output ends with: {{HEALTHY_OUTPUT}}
- Test: `{{TEST}}`
- Build: `{{BUILD}}`
- Lint: `{{LINT}}`

## Verifying your work
Run `{{VERIFY}}` before reporting any task complete and paste the tail of the output.
If a test fails, fix the code, not the test. Never skip or delete a failing test.

## Conventions
{{CONVENTIONS}}

## Architecture
{{ARCHITECTURE}}

## How we work
Changes flow intent → spec → plan → code, committed under `intent/<id>/` (see intent/README.md).
New work: /sdlc:feature. Bugs: /sdlc:fix (failing test first). Alerts: /sdlc:incident.
If the implementation departs from plan.md, update plan.md in the same commit.

## Things Claude gets wrong
<!-- When Claude makes the same mistake twice, the correction goes here. Keep this file under a page. -->

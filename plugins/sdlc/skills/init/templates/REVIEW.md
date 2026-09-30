# Review instructions

## Passes
Run three passes and tag each finding with its pass:
- **Bugs**: logic errors, broken edge cases, missing error handling, subtle regressions.
- **Security**: injection, authentication and authorization gaps, secrets or personal data in code, logs or error messages.
- **Compliance**: the change does what `intent/<id>/spec.md` asks and follows `plan.md`; it respects CLAUDE.md conventions{{EXTRA_POLICIES}}.

## What Important means here
Important is reserved for findings that would break behavior, leak data, breach a policy, or
contradict the plan without an update to plan.md. Style and naming are nits.
In a bug-fix PR, any change to an existing test file is Important.

## Cap the nits
Report at most five nits per review; summarize the rest as a count.

## Do not report
{{EXCLUDED_PATHS}}, and anything CI already enforces (formatting, lint rules).

## Feeding back
When a finding repeats one recorded in `.claude/sdlc-findings.md`, propose the correction for CLAUDE.md.
Say when the change makes CLAUDE.md outdated.

## Approval
Findings never approve or block on their own. A human code owner approves the merge.

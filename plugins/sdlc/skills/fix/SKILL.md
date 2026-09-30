---
name: fix
description: Fix a bug the playbook way — reproduce it as a failing test, commit the test, lock test files, then fix the code until the test and the full verify command pass. Use --unlock to finish.
disable-model-invocation: true
argument-hint: "[bug description | --unlock]"
---

# Failing test first

A test that existed before the fix, and that the agent could not rewrite, is the proof the bug is gone.

## If `$ARGUMENTS` contains `--unlock`

Run `rm .claude/sdlc-test-lock`. The sdlc gate will ask the user to approve it; that approval is the point.
Then summarize the fix and stop.

## Steps

1. **Understand the bug** from `$ARGUMENTS`, the issue or the incident intent it came from. Find the smallest reproduction. Use the `researcher` subagent if the area is unfamiliar.
2. **Write a failing test** that reproduces it, in the project's existing test style and location.
3. **Run it and confirm it fails for the expected reason.** Show the failure output. If it fails for a different reason, fix the test now (this is the only moment the test may change).
4. **Commit the test alone** on a branch `fix/<slug>`: `git commit -m "test: reproduce <bug>"`.
5. **Lock the tests.** Create `.claude/sdlc-test-lock` with JSON `{"reason": "<bug>", "tests": ["<path>"], "since": "<ISO date>"}`. From now on the gate hook denies edits to every file matching `paths.tests`.
6. **Fix the code**, not the test, until the new test passes and the full verify command passes. If you become convinced the test itself is wrong, stop and explain; do not try to work around the lock.
7. **Verify** with the `verifier` subagent, then commit the fix with the output tail in the commit body or PR.
8. **Hand back.** Tell the user to run `/sdlc:fix --unlock` (or delete the lock file) once they are satisfied. If the bug came from production, suggest `/sdlc:add-eval` once the fix ships.

---
name: verify
description: The feedback loop. Use whenever you implement or change code in a repository that has .claude/sdlc.json, and always before reporting a coding task as done — run the project's single verify command, iterate until it passes, check UI visually when relevant, and report the literal output as evidence.
---

# Verify before done

The session checks its own work and fixes its own mistakes before a person sees them.
Evidence comes from the toolchain, not from your summary.

1. Read `commands.verify` from `.claude/sdlc.json` (or the Verifying section of CLAUDE.md). If there is none, tell the user and propose one; meanwhile run the test and build commands you can find.
2. Run it. If it fails, read the failure, fix the **code**, and run it again. Repeat until it passes.
3. Never make a check pass by weakening it: do not delete, skip or rewrite failing tests, loosen assertions, raise timeouts or thresholds, or add ignores. If a test is genuinely wrong, stop and say so.
4. When a target was stated (in the request or in plan.md's Proof), check it explicitly: "all tests in X pass", "endpoint returns 200 with field Y".
5. For UI work, close the loop visually if a browser or screenshot tool is available: implement, screenshot, compare with the mock, adjust. Two or three rounds is normal.
6. For non-trivial changes, finish with the `verifier` subagent (fresh context) and address what it reports.
7. In your final message, paste the command and the last lines of its output, and state anything you could not verify.

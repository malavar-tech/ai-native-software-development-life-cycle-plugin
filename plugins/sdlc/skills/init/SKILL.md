---
name: init
description: Set up the current repository for the AI-native SDLC loop (Anthropic Academy playbook). Interviews the user once and scaffolds CLAUDE.md, REVIEW.md, intent/, .claude/sdlc.json, evals/, ops/ and optional GitHub workflows.
disable-model-invocation: true
argument-hint: "[--refresh]"
---

# Initialize the AI-native SDLC loop

You are setting up this repository so every change follows the loop
**intent → spec → plan → build → verify → review → gated release → incident → intent**,
with each stage ending in a committed artifact. Templates live in `${CLAUDE_SKILL_DIR}/templates/`.

## 0. Check the current state

- If `.claude/sdlc.json` exists and `$ARGUMENTS` does not contain `--refresh`: tell the user the repo is already initialized, summarize its config in five lines, and offer `--refresh`. Stop.
- With `--refresh`: re-run the interview using the current config as defaults and only touch what the user changes.

## 1. Inspect before asking

Read what already answers the interview, so you only ask about gaps: `README*`, an existing `CLAUDE.md`,
`package.json` / `Makefile` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `composer.json`,
existing test folders and naming, `.github/workflows/`, generated or vendored folders, migration and infra folders,
deploy scripts. Run `/init`-style exploration yourself; delegate to the `researcher` subagent if the repo is large.

## 2. Interview

Ask in the user's language, in at most two rounds, proposing a default for each question from what you found.
Use a multiple-choice question tool if one is available.

1. **Product**: one line on what it is and for whom; what must never break.
2. **Artifact language** for intent/spec/plan/review (e.g. `es`, `en`).
3. **Mode**: `solo` (approvals happen in the session, recorded as commit trailers) or `team` (intent/spec as PRs, merge = acceptance). Names for the intent, spec, plan and release approvers.
4. **Verify command**: one command that builds, lints and tests and exits non-zero on failure. If none exists, propose one for this stack (for example a `verify` script or Make target chaining build, lint and test) and add it. Ask what its healthy output ends with.
5. **Per-file formatter** (optional), e.g. `npx prettier --write {file}`; `{file}` is replaced by the edited path.
6. **Test file globs** if they differ from the defaults (`**/*.test.*`, `**/*.spec.*`, `**/tests/**`…).
7. **Protected paths** (never edited by hand: generated, vendored, frozen) and **guarded paths** (edits need approval: migrations, infrastructure, CI workflows).
8. **Production commands** the release gate must catch beyond the defaults (`--prod`, `deploy … prod`, terraform/kubectl/helm). Add them as regexes.
9. **Opt-ins**: verify-on-stop hook (blocks "done" while verify fails); GitHub workflows (verify, review, @claude, evals); Maintain assets (ops/); the GitHub repo that hosts this marketplace (`owner/repo`), for `.claude/settings.json`.

## 3. Confirm the plan

List every file you will create or modify, with one line each. Wait for the user's approval.

## 4. Scaffold

Fill `{{PLACEHOLDERS}}` from the answers. Never leave a placeholder behind: if a value is unknown, write a short TODO the user can see.

| Template | Destination | Notes |
|----------|-------------|-------|
| `CLAUDE.md` | `CLAUDE.md` | If one exists, merge: keep its content, add the missing sections (Commands, Verifying your work, How we work, Things Claude gets wrong). Keep the result under a page. |
| `REVIEW.md` | `REVIEW.md` | Add project policies to the Compliance pass; list excluded paths. |
| `intent/README.md`, `intent/_templates/*` | same paths | |
| `claude/sdlc.json` | `.claude/sdlc.json` | **Write this last**: it is the marker that the repo is initialized. Globs are JSON arrays. |
| `claude/settings.json` | `.claude/settings.json` | Merge with an existing file. `ALLOWED_COMMANDS` = one `"Bash(<cmd>)",` entry per verify/test/build/lint command, so the safe inner loop does not prompt. |
| `claude/sdlc-findings.md` | `.claude/sdlc-findings.md` | |
| `gitignore.snippet` | append to `.gitignore` | Skip lines already present. |
| `evals/*` | `evals/` | Keep `run.sh` executable. |
| `github-workflows/*.yml` | `.github/workflows/` | Only the ones the user chose. Replace `# {{SETUP_STEPS}}` with the setup for this stack (e.g. `actions/setup-node` + `npm ci`). |
| `ops/*` | `ops/` | Only if Maintain was chosen; leave metric placeholders as visible TODOs if unknown. |

## 5. Finish

1. Run the verify command once and show the tail of its output. If it fails, say so; do not "fix" the project as part of init.
2. Suggest committing on a branch: `git checkout -b chore/sdlc-init && git add -A && git commit -m "chore: set up AI-native SDLC loop"`.
3. Next steps, briefly: `/sdlc:feature` for the first change; add `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`) to the repo secrets and install the Claude GitHub App if workflows were added; enable branch protection with a required code-owner review; seed `evals/cases/` with 3–5 real tasks over the next weeks.

Never read or write secrets files, never run deploys, and never create files the user declined.

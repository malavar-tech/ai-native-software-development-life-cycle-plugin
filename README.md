# AI-native SDLC — Claude Code plugin

A stack-agnostic [Claude Code](https://code.claude.com) plugin that implements the
**AI-native SDLC playbook** from Anthropic Academy
(<https://academy.claude.com/courses/ai-native-sdlc-playbook/introduction>).

You install it once per machine. In each project, `/sdlc:init` sets up the loop:

**intent → spec → plan → build → verify → review → gated release → incident → intent**

Every stage ends with a committed artifact (`intent.md`, `spec.md`, `plan.md`, the diff with its
tests, the PR with its review, the incident record), and the next stage starts by reading it.
The chain of commits is the audit trail.

> This is an independent implementation of the playbook, not an official Anthropic artifact.

## What's inside

| Component | Description |
|---|---|
| **Skills** (slash commands) | `init`, `feature`, `intent`, `spec`, `plan`, `verify`, `fix`, `review`, `incident`, `add-eval` |
| **Subagents** | `verifier` (independent final check), `reviewer` (bugs / security / compliance passes), `researcher` (read-only codebase mapping) |
| **Hooks** | Session-start status, deterministic guardrails and approval gates, per-file formatting, optional verify-on-stop |
| **Project templates** | `CLAUDE.md`, `REVIEW.md`, `intent/` templates, `.claude/sdlc.json`, agent evals, GitHub workflows, `ops/` anomaly detector |

## Requirements

- Claude Code (CLI, desktop or IDE extension)
- Node.js 18+ and `sh` (hooks are written for macOS and Linux)
- Optional: `gh` CLI (PR creation and review), `jq` (running evals locally)

## Installation

```bash
# 1. Once per machine (user scope)
claude plugin marketplace add malavar-tech/ai-native-software-development-life-cycle-plugin
claude plugin install sdlc@ai-native-sdlc
# (or from inside Claude Code: /plugin marketplace add … and /plugin install …)

# 2. In each project
claude            # open Claude Code in the repository
/sdlc:init        # short interview + scaffolding
```

If the repository is private, `marketplace add` uses your local git credentials. Installing it in
CI requires a token with read access.

**Updating:** bump the version in `plugins/sdlc/.claude-plugin/plugin.json` and in
`.claude-plugin/marketplace.json`, push, and on each machine run
`claude plugin marketplace update ai-native-sdlc`.

## Daily use

| Situation | Command |
|---|---|
| New or unconfigured project | `/sdlc:init` (the session-start hook reminds you) |
| New work, full flow in one session | `/sdlc:feature <what you want>` |
| Step by step (or as a team) | `/sdlc:intent` → `/sdlc:spec <id>` → `/sdlc:plan <id>` |
| Bug | `/sdlc:fix <description>`, then `/sdlc:fix --unlock` when done |
| Review a PR or branch | `/sdlc:review [PR number] [--fix]` |
| Alert, production error, urgent message | `/sdlc:incident <alert>` |
| Turn an incident or real task into an eval | `/sdlc:add-eval <id>` |

`/sdlc:feature` walks the whole loop and stops at the four human decisions: accepting the intent,
resolving the spec's *flagged concerns*, approving the plan, and merging.

### Typical flow

1. **Intent** — Claude interviews you like an analyst and writes `intent/<id>/intent.md` in your
   own words (problem, desired outcome, constraints — no implementation details).
2. **Spec** — requirements and design in one pass, constrained by the project's policy skills,
   with areas of concern flagged first. Written to `intent/<id>/spec.md`.
3. **Plan** — in plan mode, Claude drafts and self-interrogates an implementation plan, which is
   committed as `plan.md` *before* any code is written, and kept in sync with a deviations log.
4. **Build + verify** — Claude implements step by step, running the project's single verify
   command after each step, and never weakens tests to make them pass.
5. **Review** — a fresh-context `reviewer` subagent checks the diff against `REVIEW.md`,
   `CLAUDE.md`, the spec and the plan. It never approves or merges; a human does.
6. **Maintain** — alerts become triaged `intent.md` files after a read-only diagnosis, bugs are
   fixed failing-test-first, and shipped fixes become regression evals.

### Solo vs. team mode

- **solo**: approvals happen in the session and are recorded as `Approved-by:` commit trailers.
- **team**: intent and spec are opened as PRs; merging is acceptance, closing is rejection.

## What `/sdlc:init` creates in each project

```
CLAUDE.md                       commands, verification, how we work, "Things Claude gets wrong"
REVIEW.md                       Bugs / Security / Compliance passes, Important vs Nit, nit cap
intent/README.md                statuses and approvals
intent/_templates/              intent.md, spec.md, plan.md (editable per project)
.claude/sdlc.json               configuration (marks the repo as initialized)
.claude/settings.json           enables the plugin, safe-loop permissions, secret denies
.claude/sdlc-findings.md        review findings log (the "second mistake" rule)
evals/                          run.sh + cases (agent evals, not app tests)
.github/workflows/              optional: sdlc-verify, sdlc-review, claude (@claude), sdlc-evals, sdlc-maintain
ops/                            optional: bands.json, detect.mjs, routine prompt
```

Existing files such as `CLAUDE.md`, `.claude/settings.json` and `.gitignore` are merged, not
overwritten. Run `/sdlc:init --refresh` later to change the configuration.

## Playbook map

| Stage | Play | Kit component |
|---|---|---|
| Plan | Capture as intent.md | `intent` skill, `intent.md` template |
| Design | Requirements and design | `spec` skill: one pass with the project's skills, concerns first |
| Build | Plan mode | `plan` skill: `plan.md` committed before code; the hook reminds you to keep it in sync |
| Build | CLAUDE.md | Under-a-page template, merged with any existing one |
| Build | Skills as institutional knowledge | Your policy skills in `.claude/skills/` are applied in `spec`; hooks back up what must always hold |
| Build | Parallel sessions and subagents | `verifier`, `reviewer`, `researcher` subagents; `plan.md` marks parallelizable tasks |
| Test | Give Claude a feedback loop | `verify` skill, `/sdlc:fix` (failing test first + test lock), optional verify-on-stop hook |
| Test | Continuous evals in CI | `evals/run.sh`, `sdlc-evals` workflow, `add-eval` skill |
| Deploy | AI in the PR review loop | `REVIEW.md`, `review` skill, `sdlc-review` and `claude` workflows |
| Deploy | Hooks as approval gates | `gate` hook: *deny* secrets / protected paths / force push to main; *ask* for production deploys, push to main, guarded paths |
| Deploy | CI/CD integration | `sdlc-verify` workflow with read-only triage on failure |
| Maintain | Closing the loop on metrics | `incident` skill, `ops/detect.mjs` (Western Electric rules), `bands.json`, routine prompt, `sdlc-maintain` workflow |

## Hooks

| Hook | What it does |
|---|---|
| `SessionStart` | Unconfigured repo: suggests `/sdlc:init`. Configured: status of open changes, verify command, test lock. |
| `PreToolUse` (`gate.mjs`) | Deterministic guardrails and approval gates, configurable in `.claude/sdlc.json` (`paths`, `gates`). In headless mode an *ask* cannot be approved, so the agent does not pass the gate. |
| `PostToolUse` | Formats the edited file if `commands.format` is configured. |
| `Stop` | Opt-in (`verifyOnStop: true`): prevents finishing a task with code changes while verify fails (max 3 attempts). |

Approximate fixed cost of the plugin: about 780 tokens per session
(`claude plugin details sdlc@ai-native-sdlc`).

## Configuration

All project settings live in `.claude/sdlc.json`, generated by `/sdlc:init`:

- `language` — language for intent/spec/plan/review artifacts (e.g. `en`, `es`)
- `mode` — `solo` or `team`, plus `approvers` for intent, spec, plan and release
- `commands` — `verify`, `test`, `build`, `lint`, and a per-file `format` command (`{file}` placeholder)
- `paths` — test globs, secrets (always denied), `protected` (never edited by hand) and `guarded` (edits need approval)
- `gates` — regexes for commands that are denied or need human approval (force push, push to main, `--prod`, terraform/kubectl/helm…)
- `verifyOnStop` — enable the Stop hook

## Known limitations

- **Cloud sessions and CI do not load your local plugins.** That is why `init` copies the
  templates into the repo and the routine prompt (`ops/maintain-routine.md`) is self-contained.
  To include the plugin in CI evals, uncomment the install step in `sdlc-evals.yml`.
- **Automatic per-project installation is not reliable.** Declaring the plugin in
  `.claude/settings.json` does not always show the install prompt; install it manually on each machine.
- **The test lock is not foolproof**: it blocks editing tests with the edit tools, but does not
  catch every write made through Bash. The safety net is `REVIEW.md`, which flags any test change
  in a fix PR as Important.
- **Hooks are written for macOS and Linux** (Node 18+ and `sh`).
- **Evals and Claude-powered workflows consume API credits** (or your quota if you use
  `CLAUDE_CODE_OAUTH_TOKEN`).

## Repository layout

```
.claude-plugin/marketplace.json     marketplace manifest (name: ai-native-sdlc)
plugins/sdlc/
  .claude-plugin/plugin.json        plugin manifest
  skills/<name>/SKILL.md            slash-command skills
  skills/init/templates/            files scaffolded into each project
  agents/                           verifier, reviewer, researcher subagents
  hooks/                            hooks.json + Node hook scripts
tests/                              node:test suites for hooks and the detector
.github/workflows/ci.yml            CI for the kit itself
```

## Developing the kit

```bash
node --test tests/*.test.mjs         # hooks and detector tests
claude plugin validate ./plugins/sdlc
claude plugin validate .
claude --plugin-dir ./plugins/sdlc   # try changes without reinstalling
```

The repository CI (`.github/workflows/ci.yml`) runs the same checks on every push and nightly,
to detect whether a new Claude Code release breaks anything.

## License

[MIT](LICENSE) © 2026 Esteban Simón

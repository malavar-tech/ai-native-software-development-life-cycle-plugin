# evals/

Agent evals: they test **the agent's configuration** (CLAUDE.md, skills, hooks, model),
not the application. When a model is swapped, CLAUDE.md is edited or a skill changes,
the suite says whether Claude still does the work to the same standard.

- `cases/*.json` — one real task per file (files starting with `_` are ignored; see `_template.json`).
- `run.sh` — runs every case in a clean worktree at `baseRef`, with the *current* CLAUDE.md and `.claude/` overlaid, then runs the case's checks. Exits non-zero below `EVAL_PASS_THRESHOLD` (default 0.8).
- `results/` — logs and JSON results (git-ignored).

How the suite grows:
1. Start with 20–50 real tasks from recent work, each with its accepted outcome.
2. Every production incident gets a case once its fix ships (`/sdlc:add-eval`).
3. Retire cases that no longer discriminate as models improve.

Run locally: `./evals/run.sh` (needs `jq` and `claude`; uses your API key or login).
In CI it runs nightly and on any change to `CLAUDE.md`, `.claude/**` or `evals/**`.

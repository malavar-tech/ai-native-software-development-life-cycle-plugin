# ops/ — closing the loop (Stage 6: Maintain)

Claude does not watch production. A **deterministic** detector does, and Claude is only
invoked when a control band is breached. Its output is always an `intent.md` in triage,
so the finding re-enters the loop like any other change.

| Tier | Detector | Claude may |
|------|----------|------------|
| 1σ | logs | nothing |
| 2σ | invokes Claude read-only | diagnose and write `intent/<id>/intent.md` (Status: triage) |
| 3σ | invokes Claude | the above, plus open a fix PR into the review gate or trigger a pre-approved runbook |

Files:
- `bands.json` — metric, baseline window, minimum samples and actions per tier. Record every dismissal in `tuning` so bands get less noisy.
- `detect.mjs` — mean and standard deviation over a rolling window plus Western Electric rules (spikes and slow drift). Deterministic and unit-testable; no model.
- `maintain-routine.md` — prompt for a Claude Code routine (cloud) triggered by an alert webhook or a schedule.
- `.github/workflows/sdlc-maintain.yml` (optional) — hourly: fetch series → detect → Claude writes the incident intent as a PR.

Choosing the metric: pick one with a stable baseline and enough volume (CI failure rate,
post-deploy error rate, PR cycle time). With little traffic, raise `minSamples` or `minSd`,
or use absolute thresholds in your own fetch step, or every single error looks like 3σ.

Triage: the service owner decides fix now / schedule / dismiss. When a fix ships, add an
eval for the incident (`/sdlc:add-eval`). Rollback must be rehearsed before any tier is
allowed to call it, and rolling back code does not roll back data migrations.

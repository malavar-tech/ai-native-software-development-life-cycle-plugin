#!/usr/bin/env node
// SessionStart hook: onboarding nudge for new repos, and a short status of the loop
// (open changes, verify command, test lock) for initialized ones.
import fs from 'node:fs';
import path from 'node:path';
import { readInput, projectDir, loadConfig, listChanges, emit, LOCK_FILE, CLOSED_STATUSES, CONFIG_FILE } from './lib.mjs';

const input = await readInput();
const dir = projectDir(input);
const cfg = loadConfig(dir);
const isGitRepo = fs.existsSync(path.join(dir, '.git'));

let text;

if (cfg.configError) {
  text = `[sdlc] ${CONFIG_FILE} exists but is not valid JSON (${cfg.configError}). Tell the user; the hooks fall back to defaults until it is fixed.`;
} else if (!cfg.initialized) {
  if (!isGitRepo) process.exit(0);
  text = '[sdlc] This repository is not set up for the AI-native SDLC loop yet (no .claude/sdlc.json). Once, early in the conversation and without interrupting a task in progress, tell the user they can run /sdlc:init to set it up (a short interview plus scaffolding). Do not run it yourself.';
} else {
  const open = listChanges(dir, cfg).filter((c) => !CLOSED_STATUSES.includes(c.status));
  const lines = [`[sdlc] AI-native SDLC loop active. Config: ${CONFIG_FILE}. Artifacts: ${cfg.intentDir}/<id>/{intent,spec,plan}.md. Mode: ${cfg.mode}. Artifact language: ${cfg.language}.`];
  if (cfg.commands.verify) {
    lines.push(`Verify: \`${cfg.commands.verify}\`. Run it before reporting any task as done and paste the tail of the output.`);
  } else {
    lines.push('No verify command is configured. Suggest adding one single command that builds, lints and tests and exits non-zero on failure.');
  }
  if (open.length) {
    lines.push('Open changes:');
    for (const c of open.slice(0, 8)) {
      const artifacts = ['intent', c.spec && 'spec', c.plan && 'plan'].filter(Boolean).join('+');
      lines.push(`- ${c.id}: ${c.status} [${artifacts}]`);
    }
    if (open.length > 8) lines.push(`- …and ${open.length - 8} more`);
  }
  if (fs.existsSync(path.join(dir, LOCK_FILE))) {
    lines.push(`Test lock active (${LOCK_FILE}): test files are read-only during the current fix. Fix the code, not the tests. Only the user removes the lock.`);
  }
  lines.push('Commands: /sdlc:feature (new work, solo flow), /sdlc:intent → /sdlc:spec → /sdlc:plan (step by step), /sdlc:fix (bugs, failing test first), /sdlc:review, /sdlc:incident, /sdlc:add-eval. When the user describes new work, a bug or an alert, suggest the matching command before writing code.');
  text = lines.join('\n');
}

emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } });

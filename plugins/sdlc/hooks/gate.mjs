#!/usr/bin/env node
// PreToolUse hook.
// Playbook plays implemented here:
//   - Skills as institutional knowledge / build-time guardrails: block protected paths
//     and keep secrets out of the agent's context (deterministic, no human involved).
//   - Give Claude a feedback loop: while a fix is locked, test files cannot be edited.
//   - Hooks as approval gates: production deploys, pushes to main and force pushes ask
//     a human (in headless runs an "ask" cannot be answered, so the agent cannot pass).
//   - Plan mode: when committing code for a change in "building", remind Claude to keep
//     plan.md in sync in the same commit.
import fs from 'node:fs';
import path from 'node:path';
import {
  readInput, projectDir, loadConfig, matches, relPath, safeRegExp, git,
  listChanges, emit, LOCK_FILE
} from './lib.mjs';

const input = await readInput();
const dir = projectDir(input);
const cfg = loadConfig(dir);
const tool = input.tool_name || '';
const toolInput = input.tool_input || {};
const lockActive = cfg.initialized && fs.existsSync(path.join(dir, LOCK_FILE));

const RANK = { ask: 1, deny: 2 };
let decision = null;
const reasons = [];
const context = [];

function flag(kind, reason) {
  if (!decision || RANK[kind] > RANK[decision]) decision = kind;
  reasons.push(reason);
}

function isSecret(rel) {
  return matches(rel, cfg.paths.secrets) && !matches(rel, cfg.paths.secretsAllow);
}

function commandMentionsSecret(cmd) {
  const tokens = cmd.split(/[\s'"`;|&<>()=,]+/).filter(Boolean);
  return tokens.some((t) => {
    const rel = relPath(dir, t);
    return rel && isSecret(rel);
  });
}

function planSyncReminders(cmd) {
  const building = listChanges(dir, cfg).filter((c) => c.status === 'building');
  if (!building.length) return [];
  const staged = new Set(git(dir, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean));
  if (/\s-[a-zA-Z]*a[a-zA-Z]*\b/.test(cmd)) {
    for (const f of git(dir, ['diff', '--name-only']).split('\n').filter(Boolean)) staged.add(f);
  }
  return building
    .map((c) => `${cfg.intentDir}/${c.id}/plan.md`)
    .filter((planRel) => !staged.has(planRel))
    .map((planRel) =>
      `[sdlc] This commit belongs to a change in status "building". If the implementation departed from ${planRel}, update plan.md (Deviations log) in this same commit; if it follows the plan, carry on.`);
}

if (tool === 'Bash') {
  const cmd = String(toolInput.command || '');

  for (const source of cfg.gates.deny || []) {
    if (safeRegExp(source)?.test(cmd)) {
      flag('deny', `Blocked by the sdlc gate /${source}/. This action is not allowed from an agent session; if it is really needed, the user runs it themselves.`);
    }
  }
  for (const source of cfg.gates.ask || []) {
    if (safeRegExp(source)?.test(cmd)) {
      flag('ask', `Approval gate /${source}/: releases, pushes to the main branch and infrastructure changes need explicit human authorization (Stage 5: Deploy). Explain what will happen and wait for the user.`);
    }
  }
  if (/\bgit\s+push\b/.test(cmd) && !/\b(main|master)\b/.test(cmd)) {
    const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch === 'main' || branch === 'master') {
      flag('ask', `You are on "${branch}". Changes should reach ${branch} through a pull request and review; pushing directly needs explicit human approval.`);
    }
  }
  if (cfg.initialized) {
    if (commandMentionsSecret(cmd)) {
      flag('ask', 'This command touches a secrets file (see paths.secrets in .claude/sdlc.json). Secrets stay out of the agent context unless the user approves this specific command.');
    }
    if (cmd.includes('sdlc-test-lock')) {
      flag('ask', 'The test lock protects the failing test that proves a bug fix. Only the user decides to change or remove it.');
    }
    if (/\bgit\s+commit\b/.test(cmd)) context.push(...planSyncReminders(cmd));
  }
} else {
  const file = toolInput.file_path || toolInput.notebook_path || toolInput.path || '';
  const rel = relPath(dir, file);
  if (rel && cfg.initialized) {
    const isWrite = tool !== 'Read' && tool !== 'Grep';
    if (isSecret(rel)) {
      flag('deny', `${rel} is a secrets file. Secrets stay out of the agent context (build-time guardrail). Ask the user for the non-secret information you need, or use the .example file.`);
    }
    if (isWrite) {
      if (rel === LOCK_FILE) {
        flag('deny', 'The test lock is created by /sdlc:fix and removed only by the user.');
      }
      if (matches(rel, cfg.paths.protected)) {
        flag('deny', `${rel} is a protected path (paths.protected in .claude/sdlc.json): generated, vendored or frozen code must not be edited by hand. Change the source it is generated from, or ask the user.`);
      }
      if (matches(rel, cfg.paths.guarded)) {
        flag('ask', `${rel} is a guarded path (paths.guarded in .claude/sdlc.json), e.g. migrations, infrastructure or CI. State why the change is needed and what it affects, then wait for approval.`);
      }
      if (lockActive && matches(rel, cfg.paths.tests)) {
        flag('deny', `Test files are locked while a bug fix is in progress (${LOCK_FILE}). The failing test is the proof: fix the code, not the test. If the test itself is wrong, stop and tell the user.`);
      }
    }
  }
}

if (!decision && !context.length) process.exit(0);

const out = { hookSpecificOutput: { hookEventName: 'PreToolUse' } };
if (decision) {
  out.hookSpecificOutput.permissionDecision = decision;
  out.hookSpecificOutput.permissionDecisionReason = reasons.join(' ');
}
if (context.length) out.hookSpecificOutput.additionalContext = context.join('\n');
emit(out);

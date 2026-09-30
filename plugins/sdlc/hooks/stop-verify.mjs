#!/usr/bin/env node
// Stop hook (opt-in with "verifyOnStop": true in .claude/sdlc.json).
// "Verification is part of done": when the session tries to finish with code changes
// that have not passed the verify command, block the stop and feed the failure back.
// Gives up after 3 consecutive failed attempts in the same session and hands back.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInput, projectDir, loadConfig, git, emit } from './lib.mjs';

const MAX_ATTEMPTS = 3;
const input = await readInput();
const dir = projectDir(input);
const cfg = loadConfig(dir);
const verify = String(cfg.commands.verify || '').trim();
if (!cfg.initialized || !cfg.verifyOnStop || !verify) process.exit(0);

const changed = git(dir, ['status', '--porcelain'])
  .split('\n')
  .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
  .filter(Boolean)
  .map((f) => (f.includes(' -> ') ? f.split(' -> ').pop() : f))
  .filter((f) => !f.endsWith('.md') && !f.startsWith(`${cfg.intentDir}/`) && !f.startsWith('.claude/'));
if (!changed.length) process.exit(0);

const fingerprint = crypto.createHash('sha256')
  .update(git(dir, ['diff', 'HEAD']))
  .update(changed.join('\n'))
  .digest('hex');
const stateFile = path.join(os.tmpdir(), `sdlc-verify-${crypto.createHash('sha1').update(dir).digest('hex')}.json`);
let state = {};
try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { state = {}; }
if (state.lastPass === fingerprint) process.exit(0);

const res = spawnSync('sh', ['-c', verify], {
  cwd: dir, encoding: 'utf8', timeout: (cfg.verifyTimeoutSec || 600) * 1000, maxBuffer: 32 * 1024 * 1024
});
const session = input.session_id || 'default';
state.attempts = state.attempts || {};

if (res.status === 0) {
  state.lastPass = fingerprint;
  delete state.attempts[session];
  fs.writeFileSync(stateFile, JSON.stringify(state));
  process.exit(0);
}

state.attempts[session] = (state.attempts[session] || 0) + 1;
fs.writeFileSync(stateFile, JSON.stringify(state));
const tail = `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n').slice(-40).join('\n');

if (state.attempts[session] >= MAX_ATTEMPTS) {
  delete state.attempts[session];
  fs.writeFileSync(stateFile, JSON.stringify(state));
  emit({ systemMessage: `sdlc: \`${verify}\` is still failing after ${MAX_ATTEMPTS} attempts. Handing back to you instead of looping.` });
  process.exit(0);
}

emit({
  decision: 'block',
  reason: `Verification failed: \`${verify}\` exited with ${res.status ?? 'a timeout'}. Fix the code (not the tests) and run it again before reporting the task as done.\n--- last lines ---\n${tail || res.error?.message || 'no output'}`
});

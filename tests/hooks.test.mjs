// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/sdlc/hooks');

function makeProject({ config = null, branch = 'feature/x' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-test-'));
  const run = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  run('init', '-q', '-b', 'main');
  run('config', 'user.email', 't@example.com');
  run('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(dir, 'README.md'), '# test\n');
  run('add', '.');
  run('commit', '-q', '-m', 'init');
  if (branch !== 'main') run('checkout', '-q', '-b', branch);
  if (config) {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude/sdlc.json'), JSON.stringify(config, null, 2));
  }
  return dir;
}

function runHook(name, dir, payload) {
  const res = spawnSync('node', [path.join(HOOKS, name)], {
    input: JSON.stringify({ cwd: dir, ...payload }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8'
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout ? JSON.parse(res.stdout) : null;
}

const decisionOf = (out) => out?.hookSpecificOutput?.permissionDecision ?? null;
const baseConfig = {
  version: 1,
  commands: { verify: 'true' },
  paths: { protected: ['src/generated/**'], guarded: ['migrations/**'] }
};

test('uninitialized repo: session start nudges /sdlc:init', () => {
  const dir = makeProject();
  const out = runHook('session-start.mjs', dir, { hook_event_name: 'SessionStart', source: 'startup' });
  assert.match(out.hookSpecificOutput.additionalContext, /\/sdlc:init/);
});

test('initialized repo: session start lists open changes and skips closed ones', () => {
  const dir = makeProject({ config: baseConfig });
  for (const [id, status] of [['2026-10-01-a', 'building'], ['2026-09-01-b', 'done']]) {
    fs.mkdirSync(path.join(dir, 'intent', id), { recursive: true });
    fs.writeFileSync(path.join(dir, 'intent', id, 'intent.md'), `# Intent: ${id}\nAuthor: T. Status: ${status}.\n`);
  }
  fs.writeFileSync(path.join(dir, 'intent/2026-10-01-a/plan.md'), '# Plan\n');
  const ctx = runHook('session-start.mjs', dir, { hook_event_name: 'SessionStart' }).hookSpecificOutput.additionalContext;
  assert.match(ctx, /2026-10-01-a: building \[intent\+plan\]/);
  assert.doesNotMatch(ctx, /2026-09-01-b/);
});

test('production deploy asks for approval, even in uninitialized repos', () => {
  const dir = makeProject();
  const out = runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'vercel deploy --prod' } });
  assert.equal(decisionOf(out), 'ask');
});

test('force push to main is denied; plain feature push is allowed', () => {
  const dir = makeProject();
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } })), 'deny');
  assert.equal(runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'git push -u origin feature/x' } }), null);
});

test('bare git push while on main asks', () => {
  const dir = makeProject({ branch: 'main' });
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'git push' } })), 'ask');
});

test('secrets: reading .env is denied, .env.example is allowed', () => {
  const dir = makeProject({ config: baseConfig });
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Read', tool_input: { file_path: path.join(dir, '.env') } })), 'deny');
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Read', tool_input: { file_path: path.join(dir, 'apps/web/.env.local') } })), 'deny');
  assert.equal(runHook('gate.mjs', dir, { tool_name: 'Read', tool_input: { file_path: path.join(dir, '.env.example') } }), null);
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'cat .env' } })), 'ask');
});

test('protected paths are denied and guarded paths ask', () => {
  const dir = makeProject({ config: baseConfig });
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/generated/api.ts') } })), 'deny');
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Write', tool_input: { file_path: path.join(dir, 'migrations/001.sql') } })), 'ask');
  assert.equal(runHook('gate.mjs', dir, { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/app.ts') } }), null);
});

test('test lock: test files cannot be edited, code can, lock removal asks', () => {
  const dir = makeProject({ config: baseConfig });
  fs.writeFileSync(path.join(dir, '.claude/sdlc-test-lock'), '{"tests":["src/app.test.ts"]}');
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/app.test.ts') } })), 'deny');
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'tests/unit/x.py') } })), 'deny');
  assert.equal(runHook('gate.mjs', dir, { tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'src/app.ts') } }), null);
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'rm .claude/sdlc-test-lock' } })), 'ask');
  assert.equal(decisionOf(runHook('gate.mjs', dir, { tool_name: 'Write', tool_input: { file_path: path.join(dir, '.claude/sdlc-test-lock') } })), 'deny');
});

test('commit during a building change reminds to sync plan.md', () => {
  const dir = makeProject({ config: baseConfig });
  fs.mkdirSync(path.join(dir, 'intent/2026-10-01-a'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'intent/2026-10-01-a/intent.md'), 'Status: building\n');
  const out = runHook('gate.mjs', dir, { tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
  assert.equal(decisionOf(out), null);
  assert.match(out.hookSpecificOutput.additionalContext, /plan\.md/);
});

test('stop hook blocks when verify fails and passes when it succeeds', () => {
  const failing = makeProject({ config: { ...baseConfig, verifyOnStop: true, commands: { verify: 'echo boom && exit 1' } } });
  fs.writeFileSync(path.join(failing, 'app.js'), 'x\n');
  const out = runHook('stop-verify.mjs', failing, { session_id: `s-${Date.now()}` });
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /boom/);

  const passing = makeProject({ config: { ...baseConfig, verifyOnStop: true, commands: { verify: 'true' } } });
  fs.writeFileSync(path.join(passing, 'app.js'), 'x\n');
  assert.equal(runHook('stop-verify.mjs', passing, { session_id: 's2' }), null);
});

test('stop hook is off by default', () => {
  const dir = makeProject({ config: { ...baseConfig, commands: { verify: 'exit 1' } } });
  fs.writeFileSync(path.join(dir, 'app.js'), 'x\n');
  assert.equal(runHook('stop-verify.mjs', dir, { session_id: 's3' }), null);
});

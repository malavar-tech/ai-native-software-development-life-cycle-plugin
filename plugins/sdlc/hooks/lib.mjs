// Shared helpers for the sdlc plugin hooks. No dependencies: Node >= 18.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const CONFIG_FILE = '.claude/sdlc.json';
export const LOCK_FILE = '.claude/sdlc-test-lock';
export const CLOSED_STATUSES = ['done', 'rejected', 'dismissed'];

// Defaults apply to keys missing from .claude/sdlc.json. Arrays in the project
// config replace the default arrays; objects are merged.
export const DEFAULTS = {
  version: 1,
  language: 'en',
  mode: 'solo',
  intentDir: 'intent',
  commands: { verify: '', test: '', build: '', lint: '', format: '' },
  paths: {
    tests: ['**/*.test.*', '**/*.spec.*', '**/*_test.*', '**/test_*.py', '**/test/**', '**/tests/**', '**/__tests__/**', '**/e2e/**'],
    secrets: ['.env', '.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/secrets/**', '**/.secrets/**'],
    secretsAllow: ['**/.env.example', '**/.env.sample', '**/.env.template', '**/*.example'],
    protected: [],
    guarded: []
  },
  gates: {
    deny: [
      '\\bgit\\s+push\\b[^\\n]*\\s(--force|-f)\\b[^\\n]*\\b(main|master)\\b',
      '\\bgit\\s+push\\b[^\\n]*\\b(main|master)\\b[^\\n]*\\s(--force|-f)\\b'
    ],
    ask: [
      '\\bgit\\s+push\\b[^\\n]*\\s(--force|-f)\\b',
      '\\bgit\\s+push\\b[^\\n]*\\s(origin\\s+)?(main|master)\\b',
      '(^|\\s)--prod(uction)?\\b',
      '\\bdeploy\\b[^\\n]*\\bprod(uction)?\\b',
      '\\b(terraform|tofu)\\s+(apply|destroy)\\b',
      '\\bkubectl\\b[^\\n]*\\b(apply|delete|rollout|scale)\\b',
      '\\bhelm\\s+(install|upgrade|uninstall|rollback)\\b'
    ]
  },
  verifyOnStop: false,
  verifyTimeoutSec: 600
};

export async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(base[key])) deepMerge(base[key], value);
    else base[key] = value;
  }
  return base;
}

export function loadConfig(dir) {
  const file = path.join(dir, CONFIG_FILE);
  const cfg = structuredClone(DEFAULTS);
  cfg.initialized = false;
  cfg.configError = null;
  if (!fs.existsSync(file)) return cfg;
  try {
    const user = JSON.parse(fs.readFileSync(file, 'utf8'));
    deepMerge(cfg, user);
    cfg.initialized = true;
  } catch (err) {
    cfg.configError = err.message;
  }
  return cfg;
}

export function globToRegExp(glob) {
  const g = glob.replace(/\\/g, '/');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; }
        else { re += '.*'; i += 1; }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

// Globs without a slash match the basename anywhere in the tree.
export function matches(relPath, globs = []) {
  if (!relPath) return false;
  const p = relPath.replace(/\\/g, '/');
  const base = p.split('/').pop();
  return globs.some((glob) => {
    const rx = globToRegExp(glob);
    return glob.includes('/') ? rx.test(p) : (rx.test(base) || rx.test(p));
  });
}

// Path relative to the project, or null when it points outside it.
export function relPath(dir, file) {
  if (!file) return null;
  const rel = path.relative(dir, path.resolve(dir, String(file)));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.replace(/\\/g, '/');
}

export function safeRegExp(source) {
  try { return new RegExp(source); } catch { return null; }
}

export function git(dir, args) {
  try {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
  } catch {
    return '';
  }
}

export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// Reads intent/<id>/intent.md files and returns their status and artifacts.
export function listChanges(dir, cfg) {
  const root = path.join(dir, cfg.intentDir || 'intent');
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  const changes = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const folder = path.join(root, entry.name);
    const intentFile = path.join(folder, 'intent.md');
    if (!fs.existsSync(intentFile)) continue;
    let status = 'unknown';
    try {
      const text = fs.readFileSync(intentFile, 'utf8');
      const m = text.match(/Status:\s*\**\s*([a-z][a-z-]*)/i);
      if (m) status = m[1].toLowerCase();
    } catch { /* unreadable intent: keep unknown */ }
    changes.push({
      id: entry.name,
      status,
      spec: fs.existsSync(path.join(folder, 'spec.md')),
      plan: fs.existsSync(path.join(folder, 'plan.md'))
    });
  }
  return changes.sort((a, b) => a.id.localeCompare(b.id));
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

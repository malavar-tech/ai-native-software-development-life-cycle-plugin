#!/usr/bin/env node
// PostToolUse hook: run the project's per-file formatter after each edit so drift never
// accumulates (build-time guardrail). Only runs when commands.format is configured.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readInput, projectDir, loadConfig, relPath, matches, shellQuote, emit } from './lib.mjs';

const input = await readInput();
const dir = projectDir(input);
const cfg = loadConfig(dir);
const format = cfg.initialized ? String(cfg.commands.format || '').trim() : '';
if (!format) process.exit(0);

const file = (input.tool_input || {}).file_path || '';
const rel = relPath(dir, file);
if (!rel || matches(rel, cfg.paths.secrets) || matches(rel, cfg.paths.protected)) process.exit(0);

const abs = path.resolve(dir, rel);
const cmd = format.includes('{file}') ? format.replaceAll('{file}', shellQuote(abs)) : `${format} ${shellQuote(abs)}`;
const res = spawnSync('sh', ['-c', cmd], { cwd: dir, encoding: 'utf8', timeout: 50_000 });

if (res.status !== 0) {
  const tail = `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n').slice(-15).join('\n');
  emit({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `[sdlc] Formatter failed on ${rel} (\`${cmd}\`):\n${tail || res.error?.message || 'no output'}`
    }
  });
}

// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../plugins/sdlc/skills/init/templates/ops/detect.mjs';

const DETECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/sdlc/skills/init/templates/ops/detect.mjs');
// Stable baseline around 10 with small noise.
const base = Array.from({ length: 30 }, (_, i) => 10 + ((i * 7) % 5) - 2);

test('inside bands → tier 0', () => {
  assert.equal(evaluate([...base, 10]).tier, 0);
});

test('spike beyond 3σ → tier 3 (R1)', () => {
  const r = evaluate([...base, 30]);
  assert.equal(r.tier, 3);
  assert.match(r.rule, /R1/);
});

test('two of three beyond 2σ → tier 2 (R2)', () => {
  const sd = Math.sqrt(base.reduce((a, v) => a + (v - 10) ** 2, 0) / 29);
  const r = evaluate([...base, 10 + 2.5 * sd, 10, 10 + 2.6 * sd], { window: 30 });
  assert.equal(r.tier, 2);
});

test('slow drift: 8 consecutive above the mean → tier 2 (R4)', () => {
  const r = evaluate([...base, 11, 11, 11, 11, 11, 11, 11, 11]);
  assert.equal(r.tier, 2);
  assert.match(r.rule, /R4/);
});

test('not enough history → insufficient-data', () => {
  assert.equal(evaluate([1, 2, 3, 50]).rule, 'insufficient-data');
});

test('direction "up" ignores drops', () => {
  assert.equal(evaluate([...base, -20], { direction: 'up' }).tier, 0);
});

test('CLI reads bands.json and reports the tier action', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-'));
  const cfg = { metrics: [{ name: 'errors', baselineWindow: 30, minSamples: 20, direction: 'up', tiers: { '1sigma': { action: 'log' }, '2sigma': { action: 'diagnose' }, '3sigma': { action: 'propose' } } }] };
  fs.writeFileSync(path.join(dir, 'bands.json'), JSON.stringify(cfg));
  const res = spawnSync('node', [DETECT, '--metric', 'errors', '--config', path.join(dir, 'bands.json')], { input: JSON.stringify([...base, 30]), encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.tier, 3);
  assert.equal(out.action, 'propose');
});

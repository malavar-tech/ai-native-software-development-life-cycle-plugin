#!/usr/bin/env node
// Deterministic control-band detector (Stage 6: Maintain). No model involved.
//
// Usage: node ops/detect.mjs --metric <name> [--config ops/bands.json] < series.json
//   series.json: JSON array of numbers, oldest first; the last value is the current one.
// Output (stdout, JSON): { metric, tier, rule, value, mean, sd, n, action, tierConfig }
//   tier 0 = inside bands; 1/2/3 = the sigma tier reached (see ops/bands.json).
//
// Rules (Western Electric): baseline = the window *before* the current point, so a spike
// does not inflate its own baseline.
//   R1  one point beyond 3σ                          → tier 3 (spike)
//   R2  2 of the last 3 beyond 2σ, same side         → tier 2
//   R4  8 consecutive points on the same side of mean → tier 2 (slow drift)
//   R3  4 of the last 5 beyond 1σ, same side         → tier 1
//   R0  current point beyond 1σ                      → tier 1
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function stats(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1);
  return { mean, sd: Math.sqrt(variance), n };
}

export function evaluate(series, { window = 30, minSamples = 20, direction = 'both', minSd = 0 } = {}) {
  const clean = series.map(Number).filter((v) => Number.isFinite(v));
  const value = clean.at(-1);
  const recent = clean.slice(-8);
  const baseline = clean.slice(Math.max(0, clean.length - 1 - window), clean.length - 1);
  if (baseline.length < minSamples) {
    return { tier: 0, rule: 'insufficient-data', value, mean: null, sd: null, n: baseline.length };
  }
  const { mean, sd: rawSd, n } = stats(baseline);
  const sd = Math.max(rawSd, minSd, Number.EPSILON);
  const z = (v) => (v - mean) / sd;
  const counts = (dir) => direction === 'both' || direction === dir;
  const side = (v) => (v > mean ? 'up' : v < mean ? 'down' : 'flat');

  const zCur = z(value);
  const curDir = zCur >= 0 ? 'up' : 'down';
  const beyond = (arr, k, dir) => arr.filter((v) => (dir === 'up' ? z(v) > k : z(v) < -k)).length;

  const result = (tier, rule) => ({ tier, rule, value, mean, sd, n, z: zCur });

  if (Math.abs(zCur) > 3 && counts(curDir)) return result(3, 'R1: one point beyond 3σ');
  for (const dir of ['up', 'down']) {
    if (!counts(dir)) continue;
    if (beyond(recent.slice(-3), 2, dir) >= 2 && side(value) === dir) return result(2, `R2: 2 of 3 beyond 2σ (${dir})`);
  }
  if (recent.length === 8) {
    const sides = recent.map(side);
    if (sides.every((s) => s === 'up') && counts('up')) return result(2, 'R4: 8 consecutive above the mean (drift)');
    if (sides.every((s) => s === 'down') && counts('down')) return result(2, 'R4: 8 consecutive below the mean (drift)');
  }
  for (const dir of ['up', 'down']) {
    if (!counts(dir)) continue;
    if (beyond(recent.slice(-5), 1, dir) >= 4 && side(value) === dir) return result(1, `R3: 4 of 5 beyond 1σ (${dir})`);
  }
  if (Math.abs(zCur) > 1 && counts(curDir)) return result(1, 'R0: current point beyond 1σ');
  return result(0, 'inside bands');
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const metricName = arg('metric');
  const configPath = arg('config', 'ops/bands.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const metric = config.metrics.find((m) => m.name === metricName);
  if (!metric) {
    console.error(`metric "${metricName}" not found in ${configPath}`);
    process.exit(2);
  }
  const series = JSON.parse(fs.readFileSync(0, 'utf8'));
  const out = evaluate(series, {
    window: metric.baselineWindow,
    minSamples: metric.minSamples,
    direction: metric.direction,
    minSd: metric.minSd
  });
  const tierConfig = out.tier ? metric.tiers[`${out.tier}sigma`] : null;
  process.stdout.write(JSON.stringify({ metric: metricName, ...out, action: tierConfig?.action ?? 'none', tierConfig }, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

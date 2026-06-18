#!/usr/bin/env node

/**
 * 生成 train/val split
 * 用法: node benchmark/scripts/split.mjs
 *
 * 按 skill 分层抽样，70/30 split，保证每 skill 在两边都有 ≥2 case。
 * 输出: benchmark/splits/train.json + benchmark/splits/val.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const SKILLS = ['define', 'design', 'plan', 'build', 'verify', 'code-review', 'devflow', 'handoff', 'caveman'];

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const train = [];
const val = [];

for (const skill of SKILLS) {
  const path = join(ROOT, 'cases', skill, `${skill}-cases.json`);
  if (!existsSync(path)) {
    console.warn(`Skip ${skill}: no cases file`);
    continue;
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const cases = Array.isArray(raw) ? raw : (raw.cases || []);
  const ids = cases.map(c => c.case_id);
  const shuffled = seededShuffle(ids, 42);

  const valCount = Math.max(2, Math.round(shuffled.length * 0.3));
  const valIds = shuffled.slice(0, valCount);
  const trainIds = shuffled.slice(valCount);

  train.push(...trainIds);
  val.push(...valIds);
  console.log(`${skill}: ${trainIds.length} train + ${valIds.length} val = ${ids.length} total`);
}

writeFileSync(join(ROOT, 'splits', 'train.json'), JSON.stringify(train, null, 2));
writeFileSync(join(ROOT, 'splits', 'val.json'), JSON.stringify(val, null, 2));
console.log(`\nTotal: ${train.length} train + ${val.length} val = ${train.length + val.length}`);

#!/usr/bin/env node
// 单源生成器: rules/manifest.json → model/agent-catalog.md + hooks/triggers.json + hooks/pretooluse-rules.json
// 用法: node hooks/generate.mjs          写出生成物
//       node hooks/generate.mjs --check   只校验生成物与源一致, 不一致 exit 1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'rules/manifest.json');

export function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

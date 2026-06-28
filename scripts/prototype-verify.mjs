#!/usr/bin/env node

/**
 * prototype-verify.mjs — Playwright-based prototype verification for pd-ui Step 8
 *
 * Delegates to Python playwright (must be installed: pip install playwright).
 *
 * Usage:
 *   node scripts/prototype-verify.mjs <prototype-dir> [--interactions interactions.json] [--out verify-output] [--viewport 1440x900]
 *
 * Output:
 *   <out>/screenshots/       — all screenshots (PNG)
 *   <out>/verify-report.json — structured report
 *   stdout                   — human-readable summary
 *
 * interactions.json format:
 *   [
 *     {
 *       "file": "library.html",
 *       "label": "导入对话框",
 *       "steps": [
 *         { "action": "click", "selector": "button:has-text('导入')", "screenshot": "import-dialog-open" },
 *         { "action": "click", "selector": "#import-dialog button:has-text('取消')", "screenshot": "import-dialog-closed" }
 *       ]
 *     }
 *   ]
 */

import { execFileSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    interactions: { type: 'string', short: 'i' },
    out: { type: 'string', short: 'o', default: '' },
    viewport: { type: 'string', default: '1440x900' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || positionals.length === 0) {
  console.log(`Usage: node scripts/prototype-verify.mjs <prototype-dir> [--interactions file.json] [--out dir] [--viewport WxH]`);
  process.exit(0);
}

const pyScript = join(__dirname, '_prototype-verify-impl.py');
const args = [pyScript, resolve(positionals[0])];
if (values.interactions) args.push('--interactions', resolve(values.interactions));
if (values.out) args.push('--out', resolve(values.out));
args.push('--viewport', values.viewport);

try {
  execFileSync('python3', args, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}

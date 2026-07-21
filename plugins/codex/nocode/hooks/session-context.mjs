#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { detectPlatform, encodeSessionContext } from './lib/hook-codecs.mjs';
import { loadContextBudget, renderDynamicContext } from '../scripts/lib/context-budget.mjs';

const content = readFileSync(0, 'utf8');
const platform = detectPlatform();
const budgetFile = [
  new URL(`../skills/using-nocode/scripts/providers/${platform}-hooks/context-budget.json`, import.meta.url),
  new URL(`../providers/${platform}-hooks/context-budget.json`, import.meta.url),
  new URL(`../core/domains/lifecycle/providers/${platform}-hooks/context-budget.json`, import.meta.url),
].find((candidate) => existsSync(candidate));
if (!budgetFile) throw Object.assign(new Error(`context budget missing for ${platform}`), {
  code: 'CONTEXT_BUDGET_MISSING',
});
const checked = renderDynamicContext(content, loadContextBudget(budgetFile), 'SessionStart stdin');
process.stdout.write(JSON.stringify(encodeSessionContext(checked, platform)));

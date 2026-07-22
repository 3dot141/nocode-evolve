#!/usr/bin/env node
import { readFileSync } from 'node:fs';

export class ContextBudgetError extends Error {
  constructor(code, message, source) {
    super(`${code}: ${message}`);
    this.code = code;
    this.source = source;
  }
}

export function utf8Bytes(value) { return Buffer.byteLength(String(value), 'utf8'); }

export function splitStaticContext(content, { safeBytes }, source = '<context>') {
  if (!Number.isInteger(safeBytes) || safeBytes < 1) {
    throw new ContextBudgetError('CONTEXT_BUDGET_INVALID', 'safeBytes must be positive', source);
  }
  const chunks = [];
  let current = '';
  for (const line of String(content).split(/(?<=\n)/)) {
    if (utf8Bytes(line) > safeBytes) {
      throw new ContextBudgetError(
        'CONTEXT_SEGMENT_TOO_LARGE', `unsplittable line exceeds ${safeBytes} bytes`, source,
      );
    }
    if (current && utf8Bytes(current + line) > safeBytes) {
      chunks.push(current.replace(/\n+$/, ''));
      current = '';
    }
    current += line;
  }
  if (current || chunks.length === 0) chunks.push(current.replace(/\n+$/, ''));
  return chunks;
}

export function renderDynamicContext(content, { safeBytes, dynamicOverflow = 'omit' }, source) {
  if (utf8Bytes(content) <= safeBytes) return String(content);
  if (dynamicOverflow === 'passthrough') return String(content);
  return `CONTEXT_SEGMENT_TOO_LARGE: omitted ${source}; ${utf8Bytes(content)} bytes exceeds ${safeBytes}`;
}

export function loadContextBudget(file) {
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (!Number.isInteger(value.safeBytes) || value.safeBytes < 1) {
    throw new ContextBudgetError('CONTEXT_BUDGET_INVALID', 'safeBytes must be positive', file);
  }
  if (value.dynamicOverflow != null && !['omit', 'passthrough'].includes(value.dynamicOverflow)) {
    throw new ContextBudgetError(
      'CONTEXT_BUDGET_INVALID', 'dynamicOverflow must be omit or passthrough', file,
    );
  }
  return value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [command, budgetFile, source, rawIndex = '1'] = process.argv.slice(2);
    let content = '';
    for await (const chunk of process.stdin) content += chunk;
    const budget = loadContextBudget(budgetFile);
    const rendered = command === 'dynamic'
      ? renderDynamicContext(content, budget, source)
      : splitStaticContext(content, budget, source)[Number(rawIndex) - 1] || '';
    process.stdout.write(rendered);
  } catch (error) {
    process.stderr.write(`${error.code || 'CONTEXT_BUDGET_FAILED'}: ${error.source || ''} ${error.message}\n`);
    process.exitCode = 2;
  }
}

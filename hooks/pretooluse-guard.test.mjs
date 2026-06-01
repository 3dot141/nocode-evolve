import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRules, decide } from './pretooluse-guard.mjs';

const RULES = [
  { rule: 'finishing-branch', pattern: 'gh\\s+pr\\s+create', decision: 'inject', reason: '提 PR 前先 Read rule-finishing-branch.md 走 Gate TB/PR' },
  { rule: 'finishing-branch', pattern: 'bkt\\s+api\\s+.*--method\\s+PUT', decision: 'block', reason: '禁 bkt api PUT 改 PR 元数据, 用 bkt pr edit' },
];

test('matchRules: gh pr create 命中 inject 靶', () => {
  const hits = matchRules('gh pr create --fill', RULES);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].decision, 'inject');
});

test('matchRules: 无关命令不命中', () => {
  assert.equal(matchRules('git status -sb', RULES).length, 0);
});

test('decide: inject → allow + additionalContext', () => {
  const out = decide([RULES[0]]);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.match(out.hookSpecificOutput.additionalContext, /finishing-branch/);
});

test('decide: block 优先于 inject → deny', () => {
  const out = decide([RULES[0], RULES[1]]);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /禁 bkt api PUT/);
});

test('decide: 无命中 → null', () => {
  assert.equal(decide([]), null);
});

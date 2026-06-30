import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideReminder, REMINDER_TEXT } from './skill-entry-reminder.mjs';

// 内联名单, 不依赖真实 workflow-skills.json 文件 (可能尚未生成)。
const SKILL_LIST = [
  'nocode-evolve:devflow',
  'nocode-evolve:dev-plan',
  'nocode-evolve:dev-build',
];

test('skill 在名单 + 主 agent (无 agent_id) → 返回 inject, 含关键词, 无 permissionDecision', () => {
  const out = decideReminder({ tool_name: 'Skill', tool_input: { skill: 'nocode-evolve:dev-plan' } }, SKILL_LIST);
  assert.ok(out, '应返回 inject 对象');
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, undefined, 'inject 不该带 permissionDecision (否则跳过权限框)');
  assert.match(out.hookSpecificOutput.additionalContext, /TaskCreate/);
  assert.match(out.hookSpecificOutput.additionalContext, /跳步/);
});

test('skill 不在名单 → null', () => {
  assert.equal(decideReminder({ tool_name: 'Skill', tool_input: { skill: 'nocode-evolve:bkt' } }, SKILL_LIST), null);
});

test('tool_name 非 Skill → null', () => {
  assert.equal(decideReminder({ tool_name: 'Bash', tool_input: { command: 'gh pr create' } }, SKILL_LIST), null);
});

test('agent_id 存在 (fork) → null, 即便 skill 在名单', () => {
  assert.equal(decideReminder({ agent_id: 'sub-123', tool_name: 'Skill', tool_input: { skill: 'nocode-evolve:dev-plan' } }, SKILL_LIST), null);
});

test('tool_input.skill 缺失 → null', () => {
  assert.equal(decideReminder({ tool_name: 'Skill', tool_input: {} }, SKILL_LIST), null);
});

test('空名单 → 一律 null (loadSkillList 读不到时的退化)', () => {
  assert.equal(decideReminder({ tool_name: 'Skill', tool_input: { skill: 'nocode-evolve:dev-plan' } }, []), null);
});

test('REMINDER_TEXT 长度 < 10000 字符 (additionalContext 上限)', () => {
  assert.ok(REMINDER_TEXT.length < 10000, `REMINDER_TEXT 应 <10000, 实际 ${REMINDER_TEXT.length}`);
});

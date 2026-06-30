#!/usr/bin/env node
// PreToolUse hook (matcher: Skill): 进了 workflow skill 时 inject 一道防跳步提醒（默认放行，不带 permissionDecision）。
// fork/subagent (agent_id 非空) 不触发；非 Skill 工具不触发；不在 15 skill 名单不触发。
// 名单来自 hooks/workflow-skills.json (由 manifest 生成, 禁手改)；读不到/解析失败 → 空名单 → 全放行 (不阻断 Skill 调用)。
// 设计: docs/superpowers/specs/3dot141/260630-anti-skip-hook-design.md §7.1 (Hook A / BF1 / SA2)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_LIST_FILE = path.join(__dirname, 'workflow-skills.json');

// 固定常量, 构建期保证 < 10000 字符 (additionalContext 上限); 单测断言长度。
export const REMINDER_TEXT = `[防跳步提醒] 你进了一个 workflow skill, 动手前先记牢三条:
① Step 0 先 TaskCreate 把这个 skill 的全部 task 一次建齐 (别边走边补)。
② 走完所有 Step——用户说"简单/概览/继续"都不是跳步授权, 一步都不能略。
③ 最后一个 task 调用下一阶段 skill 完成交接。
详见 agent-catalog-using.md「进了 skill 就走完」。`;

// 纯函数: 按 BF1 伪代码决定是否 inject 提醒。
export function decideReminder(payload, skillList) {
  if (payload.agent_id) return null;                  // fork/subagent 不触发 [P3]
  if (payload.tool_name !== 'Skill') return null;     // 只管 Skill 工具
  const skill = payload.tool_input?.skill;            // spike 确认字段名 = skill
  if (!skill || !skillList.includes(skill)) return null;  // 不在 15 名单 → 不提醒 [P1 负例]
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: REMINDER_TEXT,               // inject (不带 permissionDecision)
    },
  };
}

// 同步读 workflow-skills.json (生成物), 解析 { skills:[...] }; 失败返回 [] → decideReminder 一律放行。
export function loadSkillList() {
  try {
    const obj = JSON.parse(fs.readFileSync(SKILL_LIST_FILE, 'utf8'));
    return Array.isArray(obj.skills) ? obj.skills : [];
  } catch {
    return [];
  }
}

// CLI driver
if (import.meta.url === `file://${process.argv[1]}`) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

  const skillList = loadSkillList();
  const out = decideReminder(payload, skillList);
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

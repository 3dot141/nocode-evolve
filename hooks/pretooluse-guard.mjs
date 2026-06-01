#!/usr/bin/env node
// PreToolUse hook (matcher: Bash): 匹配真实绕过点 → inject 提醒(默认放行) 或 block(高危靶 deny)。
// 命中即记一条 bypass 观测 (.bypass-observations.jsonl), 供 eval / 人工复核——验主因假设:
// "深度负载下 agent 真的会走绕过点而没先加载 rule" 的发生率。
// 靶来自 hooks/pretooluse-rules.json (由 manifest 生成, 禁手改)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_FILE = path.join(ROOT, 'hooks/pretooluse-rules.json');
const BYPASS_LOG = path.join(ROOT, '.bypass-observations.jsonl');

export function matchRules(command, rules) {
  // 规范化: 折叠所有空白(含换行/行续)为单空格, 防 line-wrap 绕过 (Codex review)
  const norm = String(command).replace(/\\\n/g, ' ').replace(/\s+/g, ' ');
  return rules.filter((r) => {
    try { return new RegExp(r.pattern, 'i').test(norm); } catch { return false; }
  });
}

export function decide(hits) {
  if (!hits.length) return null;
  const block = hits.find((h) => h.decision === 'block');
  if (block) {
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[rule:${block.rule}] ${block.reason}` } };
  }
  const lines = hits.map((h) => `⚠️ [rule:${h.rule}] ${h.reason}`).join('\n');
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: `[PreToolUse 规则提醒] 你即将跑的命令命中真实绕过点, 动手前先确认:\n${lines}` } };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
  if (payload.tool_name !== 'Bash') process.exit(0);
  const command = payload.tool_input?.command || '';
  if (!command) process.exit(0);

  let rules = [];
  try { rules = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')); } catch { process.exit(0); }

  const hits = matchRules(command, rules);
  if (!hits.length) process.exit(0);

  try {
    const rec = { ts: new Date().toISOString(), session: payload.session_id || '', cmd: command.slice(0, 200), hits: hits.map((h) => h.rule), decision: hits.some((h) => h.decision === 'block') ? 'block' : 'inject' };
    fs.appendFileSync(BYPASS_LOG, JSON.stringify(rec) + '\n');
  } catch (e) {
    process.stderr.write(`pretooluse-guard: bypass 观测写入失败 (${e.code || e.message}), 决策不受影响\n`);
  }

  const out = decide(hits);
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

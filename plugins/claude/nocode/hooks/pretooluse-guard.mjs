#!/usr/bin/env node
// PreToolUse hook (matcher: Bash): 匹配真实绕过点 → inject 提醒(默认放行) 或 block(高危靶 deny)。
// bypass 观测 (.bypass-observations.jsonl) 默认**关闭** (opt-in: 设环境变量 NOCODE_EVOLVE_OBSERVE=1 启用),
// 避免命令片段隐式持久化 (cmd.slice(0,200) 可能含 token / URL / 路径等敏感信息).
// 启用后供 eval / 人工复核——验主因假设:
// "深度负载下 agent 真的会走绕过点而没先加载 rule" 的发生率。
// 靶来自 hooks/pretooluse-rules.json (由 scripts/compile.hooks.js 生成, 禁手改)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidePretool, matchRules } from './lib/pretool-decision.mjs';
import { detectPlatform, encodePretoolDecision } from './lib/hook-codecs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_FILE = path.join(ROOT, 'hooks/pretooluse-rules.json');
const BYPASS_LOG = path.join(ROOT, '.bypass-observations.jsonl');

export { matchRules };

export function decide(hits, platform = 'claude') {
  return encodePretoolDecision(decidePretool(hits), platform);
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

  // bypass 观测: 默认 **不落盘** (避免命令片段隐式持久化); 设 NOCODE_EVOLVE_OBSERVE=1 启用 eval 用.
  if (process.env.NOCODE_EVOLVE_OBSERVE === '1') {
    try {
      const rec = { ts: new Date().toISOString(), session: payload.session_id || '', cmd: command.slice(0, 200), hits: hits.map((h) => h.rule), decision: hits.some((h) => h.decision === 'block') ? 'block' : 'inject' };
      fs.appendFileSync(BYPASS_LOG, JSON.stringify(rec) + '\n');
    } catch (e) {
      process.stderr.write(`pretooluse-guard: bypass 观测写入失败 (${e.code || e.message}), 决策不受影响\n`);
    }
  }

  const out = decide(hits, detectPlatform());
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

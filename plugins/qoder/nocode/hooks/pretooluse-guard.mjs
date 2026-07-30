#!/usr/bin/env node
// PreToolUse hook (matcher: Bash): 匹配真实绕过点 →
// execute 执行规则检查 / inject 提醒(默认放行) / block(高危靶 deny)。
// bypass 观测 (.bypass-observations.jsonl) 默认**关闭** (opt-in: 设环境变量 NOCODE_EVOLVE_OBSERVE=1 启用),
// 避免命令片段隐式持久化 (cmd.slice(0,200) 可能含 token / URL / 路径等敏感信息).
// 启用后供 eval / 人工复核——验主因假设:
// "深度负载下 agent 真的会走绕过点而没先加载 rule" 的发生率。
// 靶来自 hooks/pretooluse-rules.json (由 scripts/compile.hooks.js 生成, 禁手改)。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync as nodeSpawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decidePretool, matchRules } from './lib/pretool-decision.mjs';
import { detectPlatform, encodePretoolDecision } from './lib/hook-codecs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES_FILE = path.join(ROOT, 'hooks/pretooluse-rules.json');
const BYPASS_LOG = path.join(ROOT, '.bypass-observations.jsonl');
const FRESHNESS_SCRIPT = path.join(ROOT, 'scripts/freshness-check.mjs');

export { matchRules };

function failureHit(hit, detail) {
  return {
    ...hit,
    decision: 'block',
    reason: `freshness-check 执行失败，已停止代码搜索: ${detail}`,
  };
}

export function executeRuleChecks(hits, {
  cwd = process.cwd(),
  spawnSync = nodeSpawnSync,
} = {}) {
  const checkedRules = new Set();
  const remainingHits = [];

  for (const hit of hits) {
    if (hit.decision !== 'execute') {
      remainingHits.push(hit);
      continue;
    }
    if (checkedRules.has(hit.rule)) continue;
    checkedRules.add(hit.rule);

    if (hit.rule !== 'git-freshness') {
      remainingHits.push({
        ...hit,
        decision: 'block',
        reason: `未配置 execute 规则处理器: ${hit.rule}`,
      });
      continue;
    }

    let result;
    try {
      result = spawnSync(
        process.execPath,
        [FRESHNESS_SCRIPT, '--max-behind=5', '--ttl=7200'],
        { cwd, encoding: 'utf8' },
      );
    } catch (error) {
      remainingHits.push(failureHit(hit, error?.message || 'unknown error'));
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(result.stdout || '');
    } catch {
      payload = null;
    }

    if (result.status === 0 && payload?.gate === 'ok') continue;
    if (result.status === 2 && payload?.gate === 'gate' && payload.message) {
      remainingHits.push({ ...hit, decision: 'block', reason: payload.message });
      continue;
    }

    const detail = result.error?.message
      || String(result.stderr || '').trim()
      || `exit=${result.status ?? 'unknown'}, output=${String(result.stdout || '').trim() || '(empty)'}`;
    remainingHits.push(failureHit(hit, detail));
  }

  return remainingHits;
}

export function decide(hits, platform = 'claude', options = {}) {
  const evaluatedHits = executeRuleChecks(hits, options);
  return encodePretoolDecision(decidePretool(evaluatedHits), platform);
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

  const out = decide(hits, detectPlatform(), { cwd: payload.cwd || process.cwd() });
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

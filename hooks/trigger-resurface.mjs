#!/usr/bin/env node
// UserPromptSubmit hook: 用户消息命中 catalog 触发词 → stdout 注入即时提醒(成为 context),
// 对抗"深度负载下知道却没在那刻行动"(本会话实证的真实失败)。
// 触发词在 hooks/triggers.json, 与 model/agent-catalog.md 的触发行保持一致。
// 非阻断: 只追加提醒, 误触发代价低(多一行提醒而已)。
import fs from 'node:fs';

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }

let prompt = '';
try { prompt = (JSON.parse(raw).prompt || '').toString(); } catch { process.exit(0); }
if (!prompt.trim()) process.exit(0);

let triggers = [];
try {
  triggers = JSON.parse(fs.readFileSync(new URL('./triggers.json', import.meta.url), 'utf8'));
} catch { process.exit(0); }

const hits = triggers.filter((t) =>
  (t.patterns || []).some((p) => {
    try { return new RegExp(p, 'i').test(prompt); } catch { return false; }
  })
);
if (!hits.length) process.exit(0);

const lines = hits.map(
  (h) =>
    `⚠️ 触发规则【${h.rule}】: 你这条消息命中了它的触发条件。**动手前先 Read ${h.rule_file} 并按它走**, 不要凭当前任务动量直接执行。${h.note ? ' ' + h.note : ''}`
);
process.stdout.write('[规则触发提醒]\n' + lines.join('\n') + '\n');
process.exit(0);

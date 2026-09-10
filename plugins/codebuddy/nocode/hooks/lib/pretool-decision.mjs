export function matchRules(command, rules) {
  const normalized = String(command).replace(/\\\n/g, ' ').replace(/\s+/g, ' ');
  return rules.filter((rule) => {
    try {
      return new RegExp(rule.pattern, 'i').test(normalized);
    } catch {
      return false;
    }
  });
}

export function decidePretool(hits) {
  if (!hits.length) return null;
  const block = hits.find((hit) => hit.decision === 'block');
  if (block) {
    const message = `[rule:${block.rule}] ${block.reason}`;
    return { effect: 'deny', reason: message, context: message };
  }
  const lines = hits.map((hit) => `⚠️ [rule:${hit.rule}] ${hit.reason}`).join('\n');
  return {
    effect: 'remind',
    reason: `Command matched ${hits.length} nocode rule${hits.length === 1 ? '' : 's'}`,
    context: `[PreToolUse 规则提醒] 你即将跑的命令命中真实绕过点, 动手前先确认:\n${lines}`,
  };
}

export function renderClaudeContent({ targetPath, content, contextPlan = new Map() }) {
  if (targetPath.startsWith('agents/') || targetPath.startsWith('commands/')) return null;
  if (targetPath === 'hooks/inject-nocode.sh') {
    return content.toString('utf8').replaceAll(
      '__NOCODE_CONTEXT_BUDGET__',
      '${PLUGIN_ROOT}/skills/using-nocode/scripts/providers/claude-hooks/context-budget.json',
    );
  }
  if (targetPath === 'hooks/hooks.json') {
    const config = JSON.parse(content.toString('utf8'));
    if (Array.isArray(config.hooks.SessionStart)) {
      for (const group of config.hooks.SessionStart) {
        group.hooks = (group.hooks || []).flatMap((hook) => {
          const segment = /inject-nocode\.sh\s+([a-z0-9-]+)/.exec(hook.command)?.[1];
          const count = contextPlan.get(segment)?.chunks || 1;
          return Array.from({ length: count }, (_, index) => ({
            ...hook,
            command: count > 1 ? `${hook.command} ${index + 1}` : hook.command,
          }));
        });
      }
    }
    for (const groups of Object.values(config.hooks || {})) {
      for (const group of groups || []) {
        for (const hook of group.hooks || []) {
          const argv = hook.command.trim().split(/\s+/);
          if (argv.some((part) => !/^[A-Za-z0-9_./${}-]+$/.test(part))) {
            throw new Error(`unsupported hook command token: ${hook.command}`);
          }
          const command = argv.map((part) => part.includes('${CLAUDE_PLUGIN_ROOT}') ? `"${part}"` : part);
          hook.command = argv.at(-1) === '${CLAUDE_PLUGIN_ROOT}/hooks/session-open.mjs'
            ? [
              'node', '"${CLAUDE_PLUGIN_ROOT}/skills/using-nocode/scripts/providers/claude-plugin-data/scripts/entry.mjs"', '--',
              ...command,
            ].join(' ')
            : command.join(' ');
        }
      }
    }
    return `${JSON.stringify(config, null, 2)}\n`;
  }
  return content;
}

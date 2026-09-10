export function renderCodebuddyMarkdown(text) {
  return String(text)
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', '${CODEBUDDY_PLUGIN_ROOT}')
    .replaceAll('{CLAUDE_PLUGIN_ROOT}', '{CODEBUDDY_PLUGIN_ROOT}')
    .replaceAll('${NOCODE_SKILL_REF}', '${CODEBUDDY_PLUGIN_ROOT}/skills/references')
    .replaceAll('{NOCODE_SKILL_REF}', '{CODEBUDDY_PLUGIN_ROOT}/skills/references')
    .replaceAll('CLAUDE_PROJECT_DIR', 'CODEBUDDY_PROJECT_DIR');
}

export function renderCodebuddyContent({ targetPath, content, contextPlan = new Map() }) {
  if (targetPath.startsWith('agents/') || targetPath.startsWith('commands/')) return null;
  if (targetPath === 'hooks/inject-nocode.sh') {
    return content.toString('utf8')
      .replaceAll('__NOCODE_PLATFORM__', 'codebuddy')
      .replaceAll(
        '__NOCODE_CONTEXT_BUDGET__',
        '${CODEBUDDY_PLUGIN_ROOT}/runtime/context-budget.json',
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
          // CodeBuddy 提供 CLAUDE_PLUGIN_ROOT 兼容变量，但发布物统一使用
          // CODEBUDDY_PLUGIN_ROOT，避免同一份 manifest 混用两套前缀。
          const argv = hook.command
            .replaceAll('${CLAUDE_PLUGIN_ROOT}', '${CODEBUDDY_PLUGIN_ROOT}')
            .trim().split(/\s+/);
          if (argv.some((part) => !/^[A-Za-z0-9_./${}-]+$/.test(part))) {
            throw new Error(`unsupported hook command token: ${hook.command}`);
          }
          const command = argv.map((part) => part.includes('${CODEBUDDY_PLUGIN_ROOT}') ? `"${part}"` : part);
          hook.command = argv.at(-1) === '${CODEBUDDY_PLUGIN_ROOT}/hooks/session-open.mjs'
            ? [
              'node', '"${CODEBUDDY_PLUGIN_ROOT}/runtime/plugin-data-entry.mjs"', '--',
              ...command,
            ].join(' ')
            : command.join(' ');
        }
      }
    }
    return `${JSON.stringify(config, null, 2)}\n`;
  }
  if (!targetPath.endsWith('.md')) return content;
  return renderCodebuddyMarkdown(content.toString('utf8'));
}

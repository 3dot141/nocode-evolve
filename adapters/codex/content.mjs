import { compactDescription } from '../shared/markdown.mjs';

function compactSkillFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return text;
  const lines = match[1].split('\n');
  for (let line = lines.length - 1; line >= 0; line--) {
    if (/^disable[-_]model[-_]invocation:\s*true\s*$/.test(lines[line])) lines.splice(line, 1);
  }
  const index = lines.findIndex((line) => /^description:/.test(line));
  if (index < 0) return text;

  const rawValue = lines[index].replace(/^description:\s*/, '');
  let end = index + 1;
  let description = rawValue;
  if (/^[>|][+-]?$/.test(rawValue)) {
    const parts = [];
    while (end < lines.length && (/^\s+/.test(lines[end]) || lines[end] === '')) {
      parts.push(lines[end].trim());
      end++;
    }
    description = parts.join(' ');
  }
  lines.splice(index, end - index, `description: ${JSON.stringify(compactDescription(description))}`);
  return `---\n${lines.join('\n')}\n---\n${text.slice(match[0].length)}`;
}

export function renderCodexMarkdown(text, { skill = false } = {}) {
  let rendered = String(text)
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', '${PLUGIN_ROOT}')
    .replaceAll('{CLAUDE_PLUGIN_ROOT}', '{PLUGIN_ROOT}')
    .replaceAll('${NOCODE_SKILL_REF}', '${PLUGIN_ROOT}/skills/references')
    .replaceAll('{NOCODE_SKILL_REF}', '${PLUGIN_ROOT}/skills/references')
    .replaceAll('CLAUDE_PROJECT_DIR', 'cwd');
  if (skill) rendered = compactSkillFrontmatter(rendered);
  return rendered;
}

export function renderCodexContent({ targetPath, content, contextPlan = new Map() }) {
  if (targetPath.startsWith('agents/') || targetPath.startsWith('commands/')) return null;
  if (targetPath === 'hooks/inject-nocode.sh') {
    return content.toString('utf8')
      .replaceAll('__NOCODE_PLATFORM__', 'codex')
      .replaceAll(
        '__NOCODE_CONTEXT_BUDGET__',
        '${PLUGIN_ROOT}/runtime/context-budget.json',
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
    if (Array.isArray(config.hooks.PostToolUse)) {
      for (const group of config.hooks.PostToolUse) {
        if (group.matcher === 'TaskCreate|TaskUpdate') group.matcher = 'update_plan';
      }
    }
    for (const groups of Object.values(config.hooks || {})) {
      for (const group of groups || []) {
        for (const hook of group.hooks || []) {
          const argv = hook.command
            .replaceAll('${CLAUDE_PLUGIN_ROOT}', '${PLUGIN_ROOT}')
            .trim().split(/\s+/);
          if (argv.some((part) => !/^[A-Za-z0-9_./${}-]+$/.test(part))) {
            throw new Error(`unsupported hook command token: ${hook.command}`);
          }
          const command = argv.map((part) => part.includes('${PLUGIN_ROOT}') ? `"${part}"` : part);
          hook.command = argv.at(-1) === '${PLUGIN_ROOT}/hooks/session-open.mjs'
            ? [
              'node', '"${PLUGIN_ROOT}/runtime/plugin-data-entry.mjs"', '--',
              ...command,
            ].join(' ')
            : command.join(' ');
        }
      }
    }
    return `${JSON.stringify(config, null, 2)}\n`;
  }
  if (!targetPath.endsWith('.md')) return content;
  return renderCodexMarkdown(content.toString('utf8'), {
    skill: targetPath.endsWith('/SKILL.md'),
  });
}

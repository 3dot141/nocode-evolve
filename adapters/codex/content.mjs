const DESCRIPTION_LIMIT = 96;

export function compactDescription(value, limit = DESCRIPTION_LIMIT) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  const firstSentence = normalized.split(/(?<=[。！？.!?])\s+/u)[0] || normalized;
  if (firstSentence.length <= limit) return firstSentence;
  return `${firstSentence.slice(0, limit - 1).trimEnd()}…`;
}

export function extractDescription(text) {
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(String(text));
  if (!frontmatter) return '';
  const lines = frontmatter[1].split('\n');
  const index = lines.findIndex((line) => /^description:/.test(line));
  if (index < 0) return '';
  const rawValue = lines[index].replace(/^description:\s*/, '');
  if (!/^[>|][+-]?$/.test(rawValue)) return rawValue.trim();
  const parts = [];
  for (let line = index + 1; line < lines.length; line++) {
    if (!/^\s+/.test(lines[line]) && lines[line] !== '') break;
    parts.push(lines[line].trim());
  }
  return parts.join(' ').trim();
}

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
    .replaceAll('${CLAUDE_PLUGIN_DATA}', '${PLUGIN_DATA}')
    .replaceAll('{CLAUDE_PLUGIN_DATA}', '{PLUGIN_DATA}')
    .replaceAll('${NOCODE_SKILL_REF}', '${PLUGIN_ROOT}/shared/references')
    .replaceAll('{NOCODE_SKILL_REF}', '${PLUGIN_ROOT}/shared/references')
    .replaceAll('CLAUDE_PROJECT_DIR', 'cwd')
    .replaceAll('CLAUDE_ENV_FILE', 'PLUGIN_DATA')
    .replace(/Skill\(nocode:([^),]+)(?:,[^)]*)?\)/g, (_match, name) => `$${name.trim()}`)
    .replace(/\/nocode:([a-z0-9-]+)/gi, (_match, name) => `$${name}`)
    .replace(/\bAskUserQuestion\b/g, 'request_user_input')
    .replace(/\bTask(?:Create|Update|List|Get)\b/g, 'update_plan')
    .replace(/\bAgent\(/g, 'spawn_agent(')
    .replace(/\bEnterWorktree\b/g, 'Codex workdir')
    .replace(/\bExitWorktree\b/g, 'return to the main workdir');
  if (skill) rendered = compactSkillFrontmatter(rendered);
  return rendered;
}

export function renderCodexContent({ targetPath, content }) {
  if (targetPath.startsWith('skills/references/')) return null;
  if (/^commands\/[^/]+\.md$/.test(targetPath)) return null;
  if (targetPath === 'hooks/hooks.json') {
    const config = JSON.parse(content.toString('utf8'));
    delete config.hooks.Stop;
    if (Array.isArray(config.hooks.PostToolUse)) {
      config.hooks.PostToolUse = config.hooks.PostToolUse.filter(
        (group) => !JSON.stringify(group).includes('usage-tracker.mjs'),
      );
    }
    return `${JSON.stringify(config, null, 2).replaceAll('${CLAUDE_PLUGIN_ROOT}', '${PLUGIN_ROOT}')}\n`;
  }
  if (!targetPath.endsWith('.md')) return content;
  return renderCodexMarkdown(content.toString('utf8'), {
    skill: targetPath.endsWith('/SKILL.md'),
  });
}

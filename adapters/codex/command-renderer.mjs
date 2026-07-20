import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compactDescription, renderCodexMarkdown } from './content.mjs';

function commandFrontmatter(raw, file) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(raw);
  if (!match) throw new Error(`Codex command ${file} is missing frontmatter`);
  const description = /^description:\s*(.+)$/m.exec(match[1])?.[1]?.trim();
  if (!description) throw new Error(`Codex command ${file} is missing description`);
  return { description, body: raw.slice(match[0].length) };
}

export function renderCommandSkill(name, raw, file = `${name}.md`) {
  const { description, body } = commandFrontmatter(raw, file);
  const renderedBody = renderCodexMarkdown(body)
    .replaceAll('$ARGUMENTS', '用户本次调用参数');
  return [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(compactDescription(description))}`,
    '---',
    '',
    '> Codex 入口：原命令参数统一称为“用户本次调用参数”。',
    '',
    renderedBody.trimStart(),
  ].join('\n');
}

export function generateCommandSkills(root) {
  const commandRoot = path.join(root, 'commands');
  const output = new Map();
  for (const file of readdirSync(commandRoot).sort()) {
    if (!file.endsWith('.md') || ['AGENTS.md', 'README.md'].includes(file)) continue;
    const name = path.basename(file, '.md');
    const raw = readFileSync(path.join(commandRoot, file), 'utf8');
    output.set(`skills/${name}/SKILL.md`, renderCommandSkill(name, raw, file));
  }
  return output;
}

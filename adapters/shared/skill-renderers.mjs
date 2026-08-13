import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compactDescription } from './markdown.mjs';

function parseFrontmatter(raw, kind, file) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(raw);
  if (!match) throw new Error(`${kind} ${file} is missing frontmatter`);
  const lines = match[1].split('\n');
  const name = /^name:\s*(.+)$/m.exec(match[1])?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(match[1])?.[1]?.trim();
  if (!description) throw new Error(`${kind} ${file} is missing description`);
  return { name, description, lines, body: raw.slice(match[0].length) };
}

function commandSkillFrontmatter(name, source) {
  const preserved = source.lines.filter(
    (line) => !/^(?:name|description|command|implementation):/.test(line),
  );
  return [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(compactDescription(source.description))}`,
    ...preserved,
    '---',
  ].join('\n');
}

export function renderCommandSkill(name, raw, {
  file = `${name}.md`,
  renderMarkdown = String,
  argumentLabel = '用户本次调用参数',
} = {}) {
  const source = parseFrontmatter(raw, 'Command skill', file);
  const sourceBody = source.body.replaceAll(
    `${'${CLAUDE_PLUGIN_ROOT}'}/commands/${name}-reference/`,
    `${'${CLAUDE_PLUGIN_ROOT}'}/skills/${name}/scripts/`,
  );
  const renderedBody = renderMarkdown(sourceBody).replaceAll('$ARGUMENTS', argumentLabel);
  return [
    commandSkillFrontmatter(name, source),
    '',
    renderedBody.trimStart(),
  ].join('\n');
}

function commandPromptFrontmatter(source) {
  const preserved = source.lines.filter(
    (line) => !/^(?:name|command|implementation):/.test(line),
  );
  return ['---', ...preserved, '---'].join('\n');
}

export function renderCommandPrompt(name, raw, {
  file = `${name}.md`,
  renderMarkdown = String,
} = {}) {
  const source = parseFrontmatter(raw, 'Command prompt', file);
  const sourceBody = source.body.replaceAll(
    `${'${CLAUDE_PLUGIN_ROOT}'}/commands/${name}-reference/`,
    `${'${CLAUDE_PLUGIN_ROOT}'}/scripts/${name}/`,
  );
  return [
    commandPromptFrontmatter(source),
    '',
    renderMarkdown(sourceBody).trimStart(),
  ].join('\n');
}

function copyCommandReferenceFiles(root, name, output, { targetPrefix }) {
  const privateRoot = path.join(root, 'commands', `${name}-reference`);
  if (!existsSync(privateRoot)) return;
  for (const entry of readdirSync(privateRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile()) continue;
    const privateFile = entry.name;
    if (/\.(?:test|spec)\./.test(privateFile)
      || /^(?:test|spec)[_-]/.test(privateFile)
      || /_(?:test|spec)\.[^.]+$/.test(privateFile)) continue;
    output.set(`${targetPrefix}/${privateFile}`, readFileSync(path.join(privateRoot, privateFile)));
  }
}

export function generateCommandPrompts(root, {
  isExcluded = () => false,
  renderMarkdown = String,
} = {}) {
  const commandRoot = path.join(root, 'commands');
  const output = new Map();
  for (const file of readdirSync(commandRoot).sort()) {
    if (!file.endsWith('.md') || ['AGENTS.md', 'README.md'].includes(file)) continue;
    if (isExcluded(`commands/${file}`)) continue;
    const name = path.basename(file, '.md');
    const raw = readFileSync(path.join(commandRoot, file), 'utf8');
    output.set(`prompts/${name}.md`, renderCommandPrompt(name, raw, { file, renderMarkdown }));
    copyCommandReferenceFiles(root, name, output, { targetPrefix: `scripts/${name}` });
  }
  return output;
}

export function generateCommandSkills(root, {
  isExcluded = () => false,
  renderMarkdown = String,
  argumentLabel,
} = {}) {
  const commandRoot = path.join(root, 'commands');
  const output = new Map();
  for (const file of readdirSync(commandRoot).sort()) {
    if (!file.endsWith('.md') || ['AGENTS.md', 'README.md'].includes(file)) continue;
    if (isExcluded(`commands/${file}`)) continue;
    const name = path.basename(file, '.md');
    const raw = readFileSync(path.join(commandRoot, file), 'utf8');
    output.set(`skills/${name}/SKILL.md`, renderCommandSkill(name, raw, {
      file, renderMarkdown, argumentLabel,
    }));
    copyCommandReferenceFiles(root, name, output, { targetPrefix: `skills/${name}/scripts` });
  }
  return output;
}

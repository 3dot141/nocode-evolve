import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compactDescription, extractDescription } from '../shared/markdown.mjs';

export function generateSkillPolicies(root, { isExcluded = () => false } = {}) {
  const skillsRoot = path.join(root, 'skills');
  const output = new Map();
  if (!existsSync(skillsRoot)) return output;
  const skillDirs = [];
  function visit(directory, relative = '') {
    if (existsSync(path.join(directory, 'SKILL.md'))) skillDirs.push(relative);
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
      visit(path.join(directory, entry.name), relative ? `${relative}/${entry.name}` : entry.name);
    }
  }
  visit(skillsRoot);
  for (const relative of skillDirs.filter(Boolean).sort()) {
    if (isExcluded(`skills/${relative}`)) continue;
    const skillFile = path.join(skillsRoot, relative, 'SKILL.md');
    const raw = readFileSync(skillFile, 'utf8');
    if (!/^disable-model-invocation:\s*true\s*$/m.test(raw) &&
        !/^disable_model_invocation:\s*true\s*$/m.test(raw)) continue;
    const declaredName = /^name:\s*["']?([^\n"']+)["']?\s*$/m.exec(raw)?.[1]?.trim();
    const name = declaredName || relative.replaceAll('/', '-');
    const description = extractDescription(raw) || name;
    output.set(
      `skills/${relative}/agents/openai.yaml`,
      [
        'interface:',
        `  display_name: ${JSON.stringify(name)}`,
        `  short_description: ${JSON.stringify(compactDescription(description, 80))}`,
        'policy:',
        '  allow_implicit_invocation: false',
        '',
      ].join('\n'),
    );
  }
  return output;
}

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compactDescription, extractDescription } from './content.mjs';

export function generateSkillPolicies(root) {
  const skillsRoot = path.join(root, 'skills');
  const output = new Map();
  if (!existsSync(skillsRoot)) return output;
  for (const name of readdirSync(skillsRoot).sort()) {
    const skillFile = path.join(skillsRoot, name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const raw = readFileSync(skillFile, 'utf8');
    if (!/^disable-model-invocation:\s*true\s*$/m.test(raw) &&
        !/^disable_model_invocation:\s*true\s*$/m.test(raw)) continue;
    const description = extractDescription(raw) || name;
    output.set(
      `skills/${name}/agents/openai.yaml`,
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

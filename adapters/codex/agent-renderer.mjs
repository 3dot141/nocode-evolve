import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compactDescription, renderCodexMarkdown } from './content.mjs';

function parseAgent(raw, file) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(raw);
  if (!match) throw new Error(`Codex agent ${file} is missing frontmatter`);
  const name = /^name:\s*(.+)$/m.exec(match[1])?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(match[1])?.[1]?.trim();
  if (!name || !description) throw new Error(`Codex agent ${file} needs name and description`);
  return { name, description };
}

export function generateAgentProfiles(root) {
  const agentRoot = path.join(root, 'agents');
  const output = new Map();
  const profiles = [];
  for (const file of readdirSync(agentRoot).sort()) {
    if (!file.endsWith('.md') || ['AGENTS.md', 'README.md'].includes(file)) continue;
    const raw = readFileSync(path.join(agentRoot, file), 'utf8');
    const profile = parseAgent(raw, file);
    profiles.push(profile);
    output.set(
      `skills/agent-profiles/references/${profile.name}.md`,
      renderCodexMarkdown(raw),
    );
  }
  const routes = profiles.map(
    ({ name, description }) => `- \`${name}\`: ${compactDescription(description, 120)}`,
  );
  output.set('skills/agent-profiles/SKILL.md', [
    '---',
    'name: agent-profiles',
    'description: Dispatch a nocode specialist profile with spawn_agent when isolated work is useful.',
    '---',
    '',
    '# nocode agent profiles',
    '',
    'Select the closest profile below, read its private reference, then call `spawn_agent` with that role intent and the concrete task. If collaboration is unavailable, execute the profile in the main session and state the degradation.',
    '',
    ...routes,
    '',
  ].join('\n'));
  return output;
}

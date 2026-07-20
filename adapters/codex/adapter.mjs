import { generateAgentProfiles } from './agent-renderer.mjs';
import { generateCommandSkills } from './command-renderer.mjs';
import { renderCodexContent } from './content.mjs';
import { renderCodexManifest } from './manifest.mjs';
import { generateSkillPolicies } from './skill-policy-renderer.mjs';

const capabilities = [
  'skill.invoke',
  'agent.dispatch',
  'agent.wait',
  'plan.create',
  'plan.update',
  'user.ask',
  'workspace.enter',
  'hook.session_context',
  'hook.pretool_decision',
  'hook.stop_decision',
];

export const codexAdapter = {
  platform: 'codex',
  capabilities,
  sourceRoots: [
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'skills/references', target: 'shared/references' },
  ],
  manifestPath: '.codex-plugin/plugin.json',
  renderManifest: renderCodexManifest,
  transformFile: renderCodexContent,
  generateFiles({ root }) {
    return new Map([
      ...generateCommandSkills(root),
      ...generateAgentProfiles(root),
      ...generateSkillPolicies(root),
    ]);
  },
};

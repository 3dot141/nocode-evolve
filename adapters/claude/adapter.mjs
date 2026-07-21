import { renderClaudeContent } from './content.mjs';
import { renderClaudeManifest } from './manifest.mjs';
import { generateAgentReferences, generateCommandSkills } from '../shared/skill-renderers.mjs';

export const claudeAdapter = {
  platform: 'claude',
  providerSupport: [
    'claude-control', 'claude-hooks', 'claude-native', 'claude-plugin-data',
    'claude-workspace', 'inline', 'local-html', 'open-design', 'project-wiki',
  ],
  sourceRoots: [
    { source: 'agents', target: 'agents' },
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
  ],
  manifestPath: '.claude-plugin/plugin.json',
  renderManifest: renderClaudeManifest,
  transformFile: renderClaudeContent,
  generateFiles({ root, isExcluded = () => false }) {
    return new Map([
      ...generateCommandSkills(root, {
        isExcluded,
        argumentLabel: '$ARGUMENTS',
      }),
      ...generateAgentReferences(root, { isExcluded }),
    ]);
  },
};

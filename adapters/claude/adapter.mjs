import { renderClaudeContent } from './content.mjs';
import { renderClaudeManifest } from './manifest.mjs';
import { generateCommandSkills } from '../shared/skill-renderers.mjs';

export const claudeAdapter = {
  platform: 'claude',
  sourceRoots: [
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'platform/claude/runtime', target: 'runtime' },
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
      ['.mcp.json', `${JSON.stringify({
        mcpServers: {
          'open-design': {
            command: 'node',
            args: ['${CLAUDE_PLUGIN_ROOT}/scripts/open-design-launch.mjs'],
          },
        },
      }, null, 2)}\n`],
    ]);
  },
};

import { renderCodebuddyContent } from './content.mjs';
import { renderCodebuddyManifest } from './manifest.mjs';
import { generateCommandSkills } from '../shared/skill-renderers.mjs';

export const codebuddyAdapter = {
  platform: 'codebuddy',
  sourceRoots: [
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'platform/codebuddy/runtime', target: 'runtime' },
  ],
  manifestPath: '.codebuddy-plugin/plugin.json',
  renderManifest: renderCodebuddyManifest,
  transformFile: renderCodebuddyContent,
  generateFiles({ root, isExcluded = () => false }) {
    return new Map(generateCommandSkills(root, {
      isExcluded,
      argumentLabel: '$ARGUMENTS',
      renderMarkdown: (text) => renderCodebuddyContent({
        targetPath: 'generated-command.md', content: Buffer.from(text),
      }),
    }));
  },
};

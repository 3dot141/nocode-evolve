import { renderQoderContent } from './content.mjs';
import { renderQoderManifest } from './manifest.mjs';
import { generateCommandSkills } from '../shared/skill-renderers.mjs';

export const qoderAdapter = {
  platform: 'qoder',
  sourceRoots: [
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'platform/qoder/runtime', target: 'runtime' },
  ],
  manifestPath: '.qoder-plugin/plugin.json',
  renderManifest: renderQoderManifest,
  transformFile: renderQoderContent,
  generateFiles({ root, isExcluded = () => false }) {
    return new Map(generateCommandSkills(root, {
      isExcluded,
      argumentLabel: '$ARGUMENTS',
      renderMarkdown: (text) => renderQoderContent({
        targetPath: 'generated-command.md', content: Buffer.from(text),
      }),
    }));
  },
};

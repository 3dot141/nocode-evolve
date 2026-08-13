import { renderPiContent, renderPiMarkdown } from './content.mjs';
import { renderPiManifest } from './manifest.mjs';
import { generateCommandPrompts } from '../shared/skill-renderers.mjs';

export const piAdapter = {
  platform: 'pi',
  sourceRoots: [
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'platform/pi/runtime', target: 'runtime' },
    { source: 'platform/pi/extensions', target: 'extensions' },
  ],
  manifestPath: 'package.json',
  renderManifest: renderPiManifest,
  transformFile: renderPiContent,
  generateFiles({ root, isExcluded = () => false }) {
    return new Map(generateCommandPrompts(root, {
      isExcluded,
      renderMarkdown: renderPiMarkdown,
    }));
  },
};

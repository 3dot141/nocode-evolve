import { renderDeepSeekContent, renderDeepSeekMarkdown } from './content.mjs';
import { renderDeepSeekManifest } from './manifest.mjs';
import { generateCommandSkills } from '../shared/skill-renderers.mjs';

export const deepseekAdapter = {
  platform: 'deepseek',
  sourceRoots: [
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'platform/deepseek/runtime', target: 'runtime' },
    { source: 'platform/deepseek/plugin', target: '.' },
  ],
  manifestPath: 'package.json',
  renderManifest: renderDeepSeekManifest,
  transformFile: renderDeepSeekContent,
  generateFiles({ root, isExcluded = () => false }) {
    return new Map(generateCommandSkills(root, {
      isExcluded,
      argumentLabel: '用户本次调用参数',
      renderMarkdown: renderDeepSeekMarkdown,
    }));
  },
};

import { renderCodexContent } from './content.mjs';
import { renderCodexManifest } from './manifest.mjs';
import { generateSkillPolicies } from './skill-policy-renderer.mjs';
import { generateCommandSkills } from '../shared/skill-renderers.mjs';

export const codexAdapter = {
  platform: 'codex',
  sourceRoots: [
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'platform/codex/runtime', target: 'runtime' },
  ],
  manifestPath: '.codex-plugin/plugin.json',
  renderManifest: renderCodexManifest,
  transformFile: renderCodexContent,
  generateFiles({ root, isExcluded = () => false }) {
    return new Map([
      ...generateCommandSkills(root, {
        isExcluded,
        renderMarkdown: (text) => renderCodexContent({
          targetPath: 'generated-command.md', content: Buffer.from(text),
        }),
      }),
      ...generateSkillPolicies(root, { isExcluded }),
    ]);
  },
};

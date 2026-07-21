import { renderCodexContent } from './content.mjs';
import { renderCodexManifest } from './manifest.mjs';
import { generateSkillPolicies } from './skill-policy-renderer.mjs';
import { generateAgentReferences, generateCommandSkills } from '../shared/skill-renderers.mjs';
import { readFileSync } from 'node:fs';

const CODEX_RUNTIME_ENTRY = readFileSync(new URL('./runtime-entry.mjs', import.meta.url));
const PACKAGED_CODEX_RUNTIME_ENTRY = Buffer.from(
  CODEX_RUNTIME_ENTRY.toString('utf8').replaceAll('../../scripts/', '../../../scripts/'),
);

export const codexAdapter = {
  platform: 'codex',
  providerSupport: [
    'codex-agents', 'codex-control', 'codex-hooks', 'codex-plugin-data',
    'codex-workspace', 'inline', 'local-html', 'open-design', 'project-wiki',
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
      ...generateAgentReferences(root, {
        isExcluded,
        renderMarkdown: (text) => renderCodexContent({
          targetPath: 'generated-agent.md', content: Buffer.from(text),
        }),
      }),
      ...generateSkillPolicies(root, { isExcluded }),
      ['skills/using-nocode/scripts/runtime-entry.mjs', PACKAGED_CODEX_RUNTIME_ENTRY],
    ]);
  },
};

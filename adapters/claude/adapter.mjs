import { renderClaudeContent } from './content.mjs';
import { renderClaudeManifest } from './manifest.mjs';

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

export const claudeAdapter = {
  platform: 'claude',
  capabilities,
  sourceRoots: [
    { source: 'agents', target: 'agents' },
    { source: 'commands', target: 'commands' },
    { source: 'hooks', target: 'hooks' },
    { source: 'model', target: 'model' },
    { source: 'references', target: 'references' },
    { source: 'rules', target: 'rules' },
    { source: 'scripts', target: 'scripts' },
    { source: 'skills', target: 'skills' },
    { source: 'vendor/codex', target: 'vendor/codex' },
  ],
  manifestPath: '.claude-plugin/plugin.json',
  renderManifest: renderClaudeManifest,
  transformFile: renderClaudeContent,
};

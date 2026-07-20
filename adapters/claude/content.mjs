const DISCOVERY_DOCS = new Set([
  'agents/AGENTS.md',
  'agents/README.md',
  'commands/AGENTS.md',
  'commands/README.md',
]);

export function renderClaudeContent({ targetPath, content }) {
  if (DISCOVERY_DOCS.has(targetPath)) return null;
  return content;
}

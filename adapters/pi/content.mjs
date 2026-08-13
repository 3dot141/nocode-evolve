export function renderPiMarkdown(text) {
  return String(text)
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', '${NOCODE_PLUGIN_ROOT}')
    .replaceAll('{CLAUDE_PLUGIN_ROOT}', '{NOCODE_PLUGIN_ROOT}')
    .replaceAll('${PLUGIN_ROOT}', '${NOCODE_PLUGIN_ROOT}')
    .replaceAll('{PLUGIN_ROOT}', '{NOCODE_PLUGIN_ROOT}')
    .replaceAll('${NOCODE_SKILL_REF}', '${NOCODE_PLUGIN_ROOT}/skills/references')
    .replaceAll('{NOCODE_SKILL_REF}', '{NOCODE_PLUGIN_ROOT}/skills/references')
    .replaceAll('CLAUDE_PROJECT_DIR', 'NOCODE_PROJECT_DIR');
}

export function renderPiContent({ targetPath, content }) {
  if (targetPath.startsWith('agents/') || targetPath.startsWith('commands/')) return null;
  if (targetPath === 'hooks/hooks.json') return null;
  if (targetPath === 'hooks/inject-nocode.sh') {
    return content.toString('utf8')
      .replaceAll('__NOCODE_PLATFORM__', 'pi')
      .replaceAll(
        '__NOCODE_CONTEXT_BUDGET__',
        '${NOCODE_PLUGIN_ROOT}/runtime/context-budget.json',
      );
  }
  if (!targetPath.endsWith('.md')) return content;
  return renderPiMarkdown(content.toString('utf8'));
}

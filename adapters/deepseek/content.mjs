export function renderDeepSeekMarkdown(text) {
  return String(text)
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', '${DSH_NOCODE_ROOT}')
    .replaceAll('{CLAUDE_PLUGIN_ROOT}', '{DSH_NOCODE_ROOT}')
    .replaceAll('${PLUGIN_ROOT}', '${DSH_NOCODE_ROOT}')
    .replaceAll('{PLUGIN_ROOT}', '{DSH_NOCODE_ROOT}')
    .replaceAll('${QODER_PLUGIN_ROOT}', '${DSH_NOCODE_ROOT}')
    .replaceAll('{QODER_PLUGIN_ROOT}', '{DSH_NOCODE_ROOT}')
    .replaceAll('${NOCODE_PLUGIN_ROOT}', '${DSH_NOCODE_ROOT}')
    .replaceAll('{NOCODE_PLUGIN_ROOT}', '{DSH_NOCODE_ROOT}')
    .replaceAll('${NOCODE_SKILL_REF}', '${DSH_NOCODE_SKILL_REF}')
    .replaceAll('{NOCODE_SKILL_REF}', '{DSH_NOCODE_SKILL_REF}')
    .replaceAll('CLAUDE_PROJECT_DIR', 'DSH_NOCODE_PROJECT_DIR')
    .replaceAll('/skill:', '/');
}

export function renderDeepSeekContent({ targetPath, content }) {
  if (targetPath.startsWith('agents/') || targetPath.startsWith('commands/')) return null;
  if (targetPath.startsWith('hooks/') && targetPath !== 'hooks/pretooluse-rules.json') return null;
  if (!targetPath.endsWith('.md')) return content;
  return renderDeepSeekMarkdown(content.toString('utf8'));
}

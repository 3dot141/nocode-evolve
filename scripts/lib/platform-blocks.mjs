const OPEN = /^<!-- nocode:platform (claude|codex|qoder|pi|deepseek) -->$/;
const CLOSE = '<!-- /nocode:platform -->';

export function renderPlatformBlocks(source, { platform, file = '<markdown>' }) {
  if (!['claude', 'codex', 'qoder', 'pi', 'deepseek'].includes(platform)) {
    throw new Error(`${file}: unknown target platform: ${platform}`);
  }

  const output = [];
  let active = null;
  for (const [index, line] of String(source).split('\n').entries()) {
    const match = OPEN.exec(line);
    if (match) {
      if (active) throw new Error(`${file}:${index + 1}: nested platform block`);
      active = { platform: match[1], line: index + 1 };
      continue;
    }
    if (line === CLOSE) {
      if (!active) throw new Error(`${file}:${index + 1}: unexpected platform block close`);
      active = null;
      continue;
    }
    if (/^<!-- \/?nocode:platform\b/.test(line)) {
      throw new Error(`${file}:${index + 1}: invalid platform block`);
    }
    if (!active || active.platform === platform
      || (platform === 'qoder' && active.platform === 'claude')
      || (platform === 'deepseek' && active.platform === 'pi')) output.push(line);
  }

  if (active) {
    throw new Error(`${file}:${active.line}: unclosed ${active.platform} platform block`);
  }
  return output.join('\n');
}

const OPEN = /^<!-- nocode:platform (claude|codex|codebuddy|qoder|pi|deepseek) -->$/;
const CLOSE = '<!-- /nocode:platform -->';

export function renderPlatformBlocks(source, { platform, file = '<markdown>' }) {
  if (!['claude', 'codex', 'codebuddy', 'qoder', 'pi', 'deepseek'].includes(platform)) {
    throw new Error(`${file}: unknown target platform: ${platform}`);
  }

  const sourceLines = String(source).split('\n');
  // 兜底的前置条件：本文件没有该平台的专属块。否则专属块与兜底块会同时渲染
  // （实测 codebuddy 拿到 claude 块的旧指令 + 自己的新指令，两行互相矛盾）
  const dedicatedPlatforms = new Set();
  for (const line of sourceLines) {
    const dedicated = OPEN.exec(line);
    if (dedicated) dedicatedPlatforms.add(dedicated[1]);
  }

  const output = [];
  let active = null;
  for (const [index, line] of sourceLines.entries()) {
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
    const inheritsFallback = (platform === 'qoder' && active?.platform === 'claude')
      || (platform === 'codebuddy' && active?.platform === 'claude')
      || (platform === 'deepseek' && active?.platform === 'pi');
    if (!active || active.platform === platform
      || (inheritsFallback && !dedicatedPlatforms.has(platform))) output.push(line);
  }

  if (active) {
    throw new Error(`${file}:${active.line}: unclosed ${active.platform} platform block`);
  }
  return output.join('\n');
}

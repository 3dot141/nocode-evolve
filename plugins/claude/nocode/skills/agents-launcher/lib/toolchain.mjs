import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

// FX_AGENTS_DIR 仓的工具链声明按此顺序取第一个命中的文件。
const TOOLCHAIN_FILES = [
  { name: 'mise.toml', parse: parseTomlTools },
  { name: '.mise.toml', parse: parseTomlTools },
  { name: '.tool-versions', parse: parseToolVersions },
];

// mise.toml / .mise.toml 只解析 [tools] 段的 node/pnpm 键（值可能带引号或行尾注释）。
function parseTomlTools(text) {
  const versions = {};
  let inTools = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inTools = line === '[tools]';
      continue;
    }
    if (!inTools) continue;
    const match = line.match(/^(node|pnpm)\s*=\s*"?([^"\s#]+)/);
    if (match) versions[match[1]] = match[2];
  }
  return versions;
}

// .tool-versions 每行 `tool version [version...]`，取第一个版本。
function parseToolVersions(text) {
  const versions = {};
  for (const raw of text.split('\n')) {
    const [tool, version] = raw.trim().split(/\s+/);
    if ((tool === 'node' || tool === 'pnpm') && version) versions[tool] = version;
  }
  return versions;
}

// 为什么存在：mise 机器上 pnpm 常落在 shims 垫片，垫片注入的是全局 default node
// 而非项目声明版本（实测项目声明 node+pnpm 后垫片仍给 default、reshim 无效；
// mise exec 在 nohup 后台不注入 PATH）。唯一可靠姿势是把真身 bin 目录显式
// 前置到子进程 PATH，绕过垫片。
export function resolveToolchainBins({
  agentsDir,
  env = process.env,
  exists = existsSync,
  read = readFileSync,
  home = homedir(),
} = {}) {
  for (const { name, parse } of TOOLCHAIN_FILES) {
    const file = join(agentsDir, name);
    if (!exists(file)) continue;
    const versions = parse(read(file, 'utf8'));
    if (!versions.node && !versions.pnpm) continue;
    const miseData = env.MISE_DATA_DIR || join(home, '.local', 'share', 'mise');
    const dirs = [];
    if (versions.node) {
      // 版本可为前缀/别名（"22.14"、"lts-jod"），mise installs 下有同名 symlink，直接拼即命中。
      const nodeBin = join(miseData, 'installs', 'node', versions.node, 'bin');
      if (exists(nodeBin)) dirs.push(nodeBin);
    }
    if (versions.pnpm) {
      // pnpm 是 mise 独立 backend，真身文件直接在版本目录下（无 bin 子目录）。
      const pnpmDir = join(miseData, 'installs', 'pnpm', versions.pnpm);
      if (exists(join(pnpmDir, 'pnpm'))) dirs.push(pnpmDir);
    }
    if (dirs.length > 0) return { dirs, node: versions.node, pnpm: versions.pnpm, source: name };
  }
  return null;
}

// 就地把项目工具链 bin 前置到 env.PATH（launcher 的 spawn 均继承该 env）。
// 命不中声明或 installs 时不动 PATH——非 mise 机器保持调用方现场。
export function pinToolchainPath({
  agentsDir,
  env = process.env,
  log = () => {},
  resolveBins = resolveToolchainBins,
} = {}) {
  const hit = resolveBins({ agentsDir, env });
  if (!hit) {
    log('[toolchain] 未命中可前置的项目工具链目录（无声明或非 mise 环境），PATH 保持现场');
    return false;
  }
  const existing = (env.PATH || '').split(delimiter);
  const head = [...new Set(hit.dirs)].filter((dir) => !existing.includes(dir));
  if (head.length === 0) {
    log(`[toolchain] PATH 已含项目工具链目录（${hit.source}），无需前置`);
    return true;
  }
  env.PATH = `${head.join(delimiter)}${delimiter}${env.PATH || ''}`;
  log(`[toolchain] PATH 前置 node@${hit.node ?? '-'} pnpm@${hit.pnpm ?? '-'}（来自 ${hit.source}，绕过 mise shims）`);
  return true;
}

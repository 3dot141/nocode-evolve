import { existsSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';

const MARKERS = {
  AGENTS_DIR: 'packages/server/conf/config.example.yaml',
  WEB_DIR: 'packages/jsy-web/src/entry/config.ts',
  SERVER_DIR: 'gradlew',
};
const OVERRIDE_HINT = { AGENTS_DIR: 'FX_AGENTS_DIR', WEB_DIR: 'FX_WEB_DIR', SERVER_DIR: 'FX_SERVER_DIR' };
const AGENTS_BASE = 'fx-data-agents';

// AGENTS 仓目录名形如 fx-data-agents / fx-data-agents-release / fx-data-agents-<variant>。
// 磁盘上兄弟仓通常没有裸名（只有 fx-data-web-release 等变体），推导优先同变体、回退裸名。
// 名字不匹配 fx-data-agents 前缀时不猜——兄弟推导是约定不是碰运气。
function siblingCandidates(agentsDir, repoBase) {
  const name = basename(resolve(agentsDir));
  if (name === AGENTS_BASE) return [repoBase];
  if (name.startsWith(`${AGENTS_BASE}-`)) {
    return [`${repoBase}-${name.slice(AGENTS_BASE.length + 1)}`, repoBase];
  }
  return [];
}

// 从 AGENTS_DIR 同目录挑第一个「目录存在且标志文件命中」的候选仓；挑不出返回 null。
function pickSiblingRepo(agentsDir, repoBase, marker) {
  for (const candidate of siblingCandidates(agentsDir, repoBase)) {
    const dir = join(dirname(resolve(agentsDir)), candidate);
    if (existsSync(dir) && existsSync(join(dir, marker))) return dir;
  }
  return null;
}

export function resolveRepos({ toolDir, env = process.env } = {}) {
  // launcher 随 nocode 插件分发, toolDir = `<plugin>/skills/agents-launcher`,
  // 不在任何 fx 仓内 → `../../..` 推到插件父目录 (非 fx 仓), 这条 auto 分支必然过不了 validateRepos.
  // 所以真实启动靠下面的 FX_*_DIR 显式指定; auto 仅作 fail-loud 兜底 (无 env 时报"目录不像有效仓").
  // (`../../..` 的算术由 paths.test.mjs 校验, 这里不依赖它真能命中 fx 仓.)
  const AGENTS_DIR = env.FX_AGENTS_DIR ? resolve(env.FX_AGENTS_DIR) : resolve(toolDir, '../../..');
  // WEB/SERVER 未显式指定时不猜裸名 (裸名必 miss): 从 AGENTS_DIR 同目录按同变体后缀推导,
  // 过 marker 校验才算数 (标 auto, dev-orchestrator 会要求确认); 推不出留 null, validateRepos 报"未设置".
  const WEB_DIR = env.FX_WEB_DIR ? resolve(env.FX_WEB_DIR) : pickSiblingRepo(AGENTS_DIR, 'fx-data-web', MARKERS.WEB_DIR);
  const SERVER_DIR = env.FX_SERVER_DIR ? resolve(env.FX_SERVER_DIR) : pickSiblingRepo(AGENTS_DIR, 'fx-data-server', MARKERS.SERVER_DIR);
  const sources = {
    AGENTS_DIR: env.FX_AGENTS_DIR ? 'env' : 'auto',
    WEB_DIR: env.FX_WEB_DIR ? 'env' : WEB_DIR ? 'auto' : 'none',
    SERVER_DIR: env.FX_SERVER_DIR ? 'env' : SERVER_DIR ? 'auto' : 'none',
  };
  return { AGENTS_DIR, WEB_DIR, SERVER_DIR, sources };
}

export function validateRepos(repos, { need }) {
  for (const key of need) {
    const dir = repos[key];
    if (!dir) {
      throw new Error(`${key} 未设置，且无法从 AGENTS_DIR 推导（设置 ${OVERRIDE_HINT[key]} 指定）`);
    }
    if (!existsSync(dir)) {
      throw new Error(`${key} 目录不存在: ${dir}（用 ${OVERRIDE_HINT[key]} 覆盖）`);
    }
    const marker = join(dir, MARKERS[key]);
    if (!existsSync(marker)) {
      throw new Error(`${key}=${dir} 不像有效仓：缺标志文件 ${MARKERS[key]}（用 ${OVERRIDE_HINT[key]} 覆盖）`);
    }
  }
}

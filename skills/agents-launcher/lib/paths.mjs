import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

export function resolveRepos({ toolDir, env = process.env } = {}) {
  // launcher 随 nocode-evolve 插件分发, toolDir = `<plugin>/skills/agents-launcher`,
  // 不在任何 fx 仓内 → `../../..` 推到插件父目录 (非 fx 仓), 这条 auto 分支必然过不了 validateRepos.
  // 所以真实启动靠下面的 FX_*_DIR 显式指定; auto 仅作 fail-loud 兜底 (无 env 时报"目录不像有效仓").
  // (`../../..` 的算术由 paths.test.mjs 校验, 这里不依赖它真能命中 fx 仓.)
  const AGENTS_DIR = env.FX_AGENTS_DIR ? resolve(env.FX_AGENTS_DIR) : resolve(toolDir, '../../..');
  const WEB_DIR = env.FX_WEB_DIR ? resolve(env.FX_WEB_DIR) : resolve(AGENTS_DIR, '../fx-data-web');
  const SERVER_DIR = env.FX_SERVER_DIR ? resolve(env.FX_SERVER_DIR) : resolve(AGENTS_DIR, '../fx-data-server');
  const sources = {
    AGENTS_DIR: env.FX_AGENTS_DIR ? 'env' : 'auto',
    WEB_DIR: env.FX_WEB_DIR ? 'env' : 'auto',
    SERVER_DIR: env.FX_SERVER_DIR ? 'env' : 'auto',
  };
  return { AGENTS_DIR, WEB_DIR, SERVER_DIR, sources };
}

const MARKERS = {
  AGENTS_DIR: 'packages/server/conf/config.example.yaml',
  WEB_DIR: 'packages/jsy-web/server/config.ts',
  SERVER_DIR: 'gradlew',
};
const OVERRIDE_HINT = { AGENTS_DIR: 'FX_AGENTS_DIR', WEB_DIR: 'FX_WEB_DIR', SERVER_DIR: 'FX_SERVER_DIR' };

export function validateRepos(repos, { need }) {
  for (const key of need) {
    const dir = repos[key];
    if (!dir || !existsSync(dir)) {
      throw new Error(`${key} 目录不存在: ${dir}（用 ${OVERRIDE_HINT[key]} 覆盖）`);
    }
    const marker = join(dir, MARKERS[key]);
    if (!existsSync(marker)) {
      throw new Error(`${key}=${dir} 不像有效仓：缺标志文件 ${MARKERS[key]}（用 ${OVERRIDE_HINT[key]} 覆盖）`);
    }
  }
}

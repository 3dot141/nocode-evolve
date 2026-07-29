#!/usr/bin/env node
// web (fx-data-web vite :10001) 独立 dev CLI。收编 SKILL.md Step 1/Gate 1.5/Step 2 的三个
// 手工 prose 步骤（cp .env.local / corepack 版本 patch / fork 对齐 reset）+ 现有 .env.local 写入。
// 契约（红蓝裁决 B）：start() 返回 ChildProcess 且不等待健康——健康等待归调用方
// （orchestrator waitHealthy / CLI main 前台跟随）。
// 破坏性动作（alignReset）对应 SKILL.md Gate 2.2 askUser——CLI 层要求显式 --reset flag 才可达。
// 用法: FX_WEB_DIR=<repo> [FX_AGENTS_DIR=<repo>] node web-cli.mjs {prepare|env|pkgmgr|align|start|stop|status}
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { tcpOpen, pidOnPort } from './lib/probe.mjs';
import { spawnPrefixed, runToEnd } from './lib/proc.mjs';
import { upsertEnv } from './lib/env-file.mjs';
import { PORTS } from './lib/ports.mjs';   // 端口单源（Review W1）
const COREPACK_PNPM_DIR = join(process.env.HOME || '', '.cache/node/corepack/v1/pnpm');

// ---- 纯函数 ----

export function envLocalPath(webDir) {
  return join(webDir, 'packages/jsy-web/server/.env.local');
}

// 与 lib/ports.mjs buildWriteTargets 的 webEnv 四键保持一致（回归锚见测试）。
// 不改 lib/ports.mjs 现有导出——旧导出的清理/收敛统一放 Task 7/8（orchestrator 瘦身时一并处理）。
export function buildWebEnv({ agentsDir, ports = PORTS }) {
  return {
    AGENTS_LOCAL_SERVER: `http://127.0.0.1:${ports.agents}`,
    USER_CLIENT: 'localDebugger',
    AGENTS_LOCAL_SRC: agentsDir,
    DEV_SERVER_PORT: String(ports.web),
  };
}

export function viteCacheDir(webDir) {
  return join(webDir, 'packages/jsy-web/node_modules/.vite');
}

export function cleanViteCache({ webDir, fs: _fs = { existsSync, rmSync } } = {}) {
  const dir = viteCacheDir(webDir);
  if (!_fs.existsSync(dir)) return { action: 'none', path: dir };
  _fs.rmSync(dir, { recursive: true, force: true });
  return { action: 'removed', path: dir };
}

export function killCommands({ ports = PORTS } = {}) {
  const sh = (s) => ['sh', ['-c', s]];
  return [sh(`lsof -ti tcp:${ports.web} | xargs kill -9 2>/dev/null || true`)];
}

// ---- 有副作用（接受注入）----

export function prepare({ webDir, fromDir, fs = { existsSync, mkdirSync, copyFileSync } } = {}) {
  const dst = envLocalPath(webDir);
  if (fs.existsSync(dst)) return { action: 'exists', path: dst };

  if (fromDir) {
    const src = envLocalPath(fromDir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      return { action: 'copied', path: dst, from: src };
    }
  }
  throw new Error(`web .env.local 不存在: ${dst}\n请从可用来源 cp 一份，或用 --from-dir 指定`);
}

export function writeEnv({ webDir, agentsDir, ports = PORTS }) {
  const path = envLocalPath(webDir);
  upsertEnv(path, buildWebEnv({ agentsDir, ports }));
  return { path };
}

export function pkgmgrCheck({ webDir, corepackDir = COREPACK_PNPM_DIR, fs = { readFileSync, readdirSync, existsSync } } = {}) {
  const pkg = JSON.parse(fs.readFileSync(join(webDir, 'package.json'), 'utf8'));
  const locked = pkg.packageManager || null;   // "pnpm@10.10.0"
  const lockedVersion = locked ? locked.split('@')[1] : null;
  const cached = fs.existsSync(corepackDir) ? fs.readdirSync(corepackDir) : [];
  const needsPatch = Boolean(lockedVersion) && !cached.includes(lockedVersion);
  return { locked, lockedVersion, cached, needsPatch };
}

export function pkgmgrPatch({ webDir, version, fs = { readFileSync, writeFileSync } } = {}) {
  const path = join(webDir, 'package.json');
  const raw = fs.readFileSync(path, 'utf8');
  const pkg = JSON.parse(raw);
  const oldLine = `"packageManager": "${pkg.packageManager}"`;
  const newLine = `"packageManager": "pnpm@${version}"`;
  if (!raw.includes(oldLine)) {
    throw new Error(`package.json 里没找到精确匹配的 packageManager 行，拒绝定向替换（避免误改）: ${oldLine}`);
  }
  // 定向字符串替换而非 JSON.stringify 整体重写——避免 key 顺序 / 缩进 / 尾随逗号风格被重排
  const patched = raw.replace(oldLine, newLine);
  fs.writeFileSync(path, patched);
  return { path, from: pkg.packageManager, to: `pnpm@${version}` };
}

export function alignCheck({ webDir, targetSha, exec = execFileSync }) {
  const headSha = exec('git', ['-C', webDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { aligned: headSha === targetSha, headSha };
}

// 对应 SKILL.md Gate 2.2：破坏性动作，只有 skill 层拿到用户 askUser 确认后才应调用本函数。
// CLI 分发层同样要求显式 --reset flag 才可达（见 main() verb='align'），防止裸跑误触发。
export function alignReset({ webDir, targetSha, exec = execFileSync }) {
  exec('git', ['-C', webDir, 'reset', '--hard', targetSha], { encoding: 'utf8' });
  return { reset: true, targetSha };
}

export function start({ webDir, spawn = spawnPrefixed, clean = cleanViteCache, log = console.log } = {}) {
  // 清缓存放 start() 内而非各调用方——orchestrator 与 CLI start 两条启动路径共享，
  // 任一条绕过都会复现"切 worktree 后 Vite 预构建缓存路径失效"
  const vc = clean({ webDir });
  if (vc.action === 'removed') log(`[web] 已清 Vite 预构建缓存: ${vc.path}`);
  // BROWSER=none: vite server.open 遵循该约定跳过自动开浏览器——launcher 是后台编排场景，
  // 弹浏览器是干扰（web 仓 vite.home.config.ts 配了 open，交互式裸跑 pnpm dev 不受本行影响）
  return spawn('web', 'pnpm', ['dev'], { cwd: webDir, env: { ...process.env, JSY_DEV_MODE: 'vite', BROWSER: 'none' } });
}

export async function status({ ports = PORTS, probes = { tcpOpen, pidOnPort } } = {}) {
  const up = await probes.tcpOpen(ports.web);
  const pid = up ? await probes.pidOnPort(ports.web) : '-';
  return { name: 'web', port: ports.web, up, pid };
}

// ---- CLI 分发 ----

async function main() {
  const toolDir = dirname(fileURLToPath(import.meta.url));
  const verb = process.argv[2];
  const repos = resolveRepos({ toolDir });

  if (verb === 'status') {
    const s = await status({});
    console.log(`[status] web :${s.port} ${s.up ? 'UP  ' : 'DOWN'} pid=${s.pid}`);
    return;
  }

  validateRepos(repos, { need: ['WEB_DIR'] });

  if (verb === 'prepare') {
    const r = prepare({ webDir: repos.WEB_DIR, fromDir: process.env.FX_WEB_FROM });
    console.log(`[prepare] ${r.action} -> ${r.path}`);
    return;
  }
  if (verb === 'env') {
    validateRepos(repos, { need: ['AGENTS_DIR'] });
    const r = writeEnv({ webDir: repos.WEB_DIR, agentsDir: repos.AGENTS_DIR });
    console.log(`[env] 已写入 ${r.path}（目标文件: ${r.path}）`);
    return;
  }
  if (verb === 'pkgmgr') {
    const check = pkgmgrCheck({ webDir: repos.WEB_DIR });
    if (!check.needsPatch) { console.log(`[pkgmgr] ${check.locked} 已在本机缓存，无需 patch`); return; }
    const patchTo = process.argv[3];   // e.g. --patch=10.33.0，由 skill 层 askUser 确认后传入
    if (!patchTo || !patchTo.startsWith('--patch=')) {
      console.log(`[pkgmgr] ${check.locked} 本机未缓存（已缓存: ${check.cached.join(', ') || '无'}）。需 patch 请传 --patch=<version>`);
      return;
    }
    const r = pkgmgrPatch({ webDir: repos.WEB_DIR, version: patchTo.slice('--patch='.length) });
    console.log(`[pkgmgr] ${r.from} -> ${r.to}（目标文件: ${r.path}，worktree 销毁时改动一起没）`);
    return;
  }
  if (verb === 'align') {
    const targetSha = process.argv[3];
    if (!targetSha) { console.error('用法: web-cli.mjs align <target-sha> [--reset]'); process.exit(1); }
    const check = alignCheck({ webDir: repos.WEB_DIR, targetSha });
    if (check.aligned) { console.log(`[align] 已对齐 HEAD=${check.headSha}`); return; }
    if (process.argv.includes('--reset')) {
      alignReset({ webDir: repos.WEB_DIR, targetSha });
      console.log(`[align] 已 reset --hard 到 ${targetSha}（目标仓: ${repos.WEB_DIR}，Gate 1.5 若改过 package.json 需重做）`);
    } else {
      console.log(`[align] 未对齐: HEAD=${check.headSha} != target=${targetSha}。需 reset 请加 --reset（仅限 worktree，禁止对主仓用）`);
    }
    return;
  }
  if (verb === 'stop') {
    for (const [cmd, args] of killCommands({})) await runToEnd('stop', cmd, args);
    return;
  }
  if (verb === 'start') {
    start({ webDir: repos.WEB_DIR });   // 前台跟随（Ctrl-C 停），编排场景走 orchestrator
    return;
  }
  console.error('用法: web-cli.mjs {prepare|env|pkgmgr|align|start|stop|status}');
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(`[web-cli] 失败: ${e.message}`); process.exit(1); });
}

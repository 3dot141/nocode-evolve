#!/usr/bin/env node
// portal (fx-data-web packages/jsy-portal-react vite :10002) 独立 dev CLI。
// 契约同 web-cli：start() 返回 ChildProcess 且不等待健康——健康等待归调用方
// （orchestrator waitHealthy / CLI main 前台跟随）。
// 用法: FX_WEB_DIR=<repo> node portal-cli.mjs {start|stop|status}
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { tcpOpen, pidOnPort } from './lib/probe.mjs';
import { spawnPrefixed, runToEnd } from './lib/proc.mjs';
import { PORTS } from './lib/ports.mjs';   // 端口单源（与 web-cli 同一约束）

export function killCommands({ ports = PORTS } = {}) {
  const sh = (s) => ['sh', ['-c', s]];
  return [sh(`lsof -ti tcp:${ports.portal} | xargs kill -9 2>/dev/null || true`)];
}

export function start({ webDir, spawn = spawnPrefixed } = {}) {
  // BROWSER=none 同 web-cli：vite server.open 遵循该约定跳过自动开浏览器。
  // USER_CLIENT=localDebugger 与 web 仓现行 .env.local 对齐——portal 经 :10001 反代访问时
  // API 走 jsy-web 的 proxy，该值只影响 :10002 直连入口的后端指向。
  return spawn('portal', 'pnpm', ['--filter', '@jsy/portal-react', 'dev'], {
    cwd: webDir,
    env: {
      ...process.env,
      VITE_DEV_SERVER_PORT: String(PORTS.portal),
      USER_CLIENT: 'localDebugger',
      BROWSER: 'none',
    },
  });
}

export async function status({ ports = PORTS, probes = { tcpOpen, pidOnPort } } = {}) {
  const up = await probes.tcpOpen(ports.portal);
  const pid = up ? await probes.pidOnPort(ports.portal) : '-';
  return { name: 'portal', port: ports.portal, up, pid };
}

// ---- CLI 分发 ----

async function main() {
  const toolDir = dirname(fileURLToPath(import.meta.url));
  const verb = process.argv[2];
  const repos = resolveRepos({ toolDir });

  if (verb === 'status') {
    const s = await status({});
    console.log(`[status] portal :${s.port} ${s.up ? 'UP  ' : 'DOWN'} pid=${s.pid}`);
    return;
  }

  validateRepos(repos, { need: ['WEB_DIR'] });

  if (verb === 'stop') {
    for (const [cmd, args] of killCommands({})) await runToEnd('stop', cmd, args);
    return;
  }
  if (verb === 'start') {
    start({ webDir: repos.WEB_DIR });   // 前台跟随（Ctrl-C 停），编排场景走 orchestrator
    return;
  }
  console.error('用法: portal-cli.mjs {start|stop|status}');
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

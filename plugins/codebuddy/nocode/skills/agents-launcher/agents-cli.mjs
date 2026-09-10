#!/usr/bin/env node
// agents (fx-data-agents Hono :8070) 独立 dev CLI。收编原 orchestrator 内联的 agents 专属逻辑
// （config.yaml 校验、CSS 产物检查、pnpm dev:server 启动、kill 命令）+ SKILL.md Step 1 的
// cp config.yaml 手工步骤。
// 契约（红蓝裁决 B）：start() 返回 ChildProcess 且不等待健康——健康等待归调用方
// （orchestrator waitHealthy / CLI main 前台跟随）。
// 用法: FX_AGENTS_DIR=<repo> node agents-cli.mjs {prepare|start|stop|status} [FX_AGENTS_FROM=<主仓> 供 prepare cp]
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { httpOk, pidOnPort } from './lib/probe.mjs';
import { spawnPrefixed, runToEnd } from './lib/proc.mjs';
import { PORTS } from './lib/ports.mjs';   // 端口单源（Review W1）

// ---- 纯函数：路径/命令构造，不碰 fs/进程 ----

export function configPath(agentsDir) {
  return join(agentsDir, 'packages/server/conf/config.yaml');
}

export function killCommands({ ports = PORTS } = {}) {
  const sh = (s) => ['sh', ['-c', s]];
  return [
    ['pkill', ['-f', 'telemetry/preload.ts']],          // tsx watch 父进程，只杀子 node 会被父 watch 重启
    sh(`lsof -ti tcp:${ports.agents} | xargs kill -9 2>/dev/null || true`),
  ];
}

// ---- 有副作用：fs / 进程，接受注入方便测试 ----

export function prepare({ agentsDir, fromDir, fs = { existsSync, mkdirSync, copyFileSync } } = {}) {
  const dst = configPath(agentsDir);
  if (fs.existsSync(dst)) return { action: 'exists', path: dst };

  if (fromDir) {
    const src = configPath(fromDir);
    if (fs.existsSync(src)) {
      fs.mkdirSync(dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      return { action: 'copied', path: dst, from: src };
    }
  }

  const example = join(agentsDir, 'packages/server/conf/config.example.yaml');
  throw new Error(
    `agents config.yaml 不存在: ${dst}\n请先 cp ${example} ${dst} 并填 pg/minio/LLM`,
  );
}

export async function ensureCss({ agentsDir, run = runToEnd } = {}) {
  const cssOk = existsSync(join(agentsDir, 'packages/desktop/dist/style.css'))
    && existsSync(join(agentsDir, 'packages/ui/dist/agent-ui.css'));
  if (cssOk) return { action: 'skipped' };
  await run('build:css', 'pnpm', ['build:css'], { cwd: agentsDir });
  return { action: 'built' };
}

export function start({ agentsDir, spawn = spawnPrefixed } = {}) {
  return spawn('agents', 'pnpm', ['dev:server'], { cwd: agentsDir });
}

export async function status({ ports = PORTS, probes = { httpOk, pidOnPort } } = {}) {
  const up = await probes.httpOk(`http://127.0.0.1:${ports.agents}/health`);
  const pid = up ? await probes.pidOnPort(ports.agents) : '-';
  return { name: 'agents', port: ports.agents, up, pid };
}

// ---- CLI 分发（仅被直接执行时跑）----

async function main() {
  const toolDir = dirname(fileURLToPath(import.meta.url));
  const verb = process.argv[2];
  const repos = resolveRepos({ toolDir });

  if (verb === 'status') {
    const s = await status({});
    console.log(`[status] agents :${s.port} ${s.up ? 'UP  ' : 'DOWN'} pid=${s.pid}`);
    return;
  }

  validateRepos(repos, { need: ['AGENTS_DIR'] });

  if (verb === 'prepare') {
    const r = prepare({ agentsDir: repos.AGENTS_DIR, fromDir: process.env.FX_AGENTS_FROM });
    console.log(`[prepare] ${r.action} -> ${r.path}`);
    return;
  }
  if (verb === 'stop') {
    for (const [cmd, args] of killCommands({})) await runToEnd('stop', cmd, args);
    return;
  }
  if (verb === 'start') {
    await ensureCss({ agentsDir: repos.AGENTS_DIR });
    start({ agentsDir: repos.AGENTS_DIR });   // 前台跟随（Ctrl-C 停），编排场景走 orchestrator
    return;
  }
  console.error('用法: agents-cli.mjs {prepare|start|stop|status}');
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(`[agents-cli] 失败: ${e.message}`); process.exit(1); });
}

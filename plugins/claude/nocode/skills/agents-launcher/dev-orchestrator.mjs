import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from './lib/cli.mjs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { PORTS } from './lib/ports.mjs';
import { tcpOpen, httpOk, pidOnPort } from './lib/probe.mjs';
import { waitHealthy, runToEnd, spawnPrefixed } from './lib/proc.mjs';
import * as agentsCli from './agents-cli.mjs';
import * as webCli from './web-cli.mjs';
import * as serverCli from './server-cli.mjs';

const toolDir = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const repos = resolveRepos({ toolDir });

// ---- 运维子命令（不起服务，不要求仓路径有效）----
// --status：各服务端口健康 + 监听 PID，一次调用替代手工 lsof/curl 轮询。
// 显式决策（红蓝裁决 D）：保持旧五行输出（probe+PORTS 直接投影），不改调 CLI status——
// 行为不回归优先；CLI 的 status verb 是 standalone 视图，两者共享 lib/probe.mjs 与 PORTS
// 单源，不构成杀法/健康语义双写。
if (args.status) {
  const row = (name, port, up) =>
    console.log(`[status] ${name.padEnd(6)} :${String(port).padEnd(5)} ${up ? 'UP  ' : 'DOWN'} pid=${up ? (pidOnPort(port) || '-') : '-'}`);
  row('web', PORTS.web, await tcpOpen(PORTS.web));
  row('agents', PORTS.agents, await httpOk(`http://127.0.0.1:${PORTS.agents}/health`));
  row('server', PORTS.server, await tcpOpen(PORTS.server));
  row('pg', 5432, await tcpOpen(5432));
  row('minio', 9000, await tcpOpen(9000));
  process.exit(0);
}

// 三服务 kill 段组合：per-service 杀法单源在各 CLI，这里只做拼装
function killCommands() {
  const cmds = [];
  if (args.services.agents) cmds.push(...agentsCli.killCommands({ ports: PORTS }));
  if (args.services.web) cmds.push(...webCli.killCommands({ ports: PORTS }));
  if (args.services.server) cmds.push(...serverCli.killCommands({ ports: PORTS, serverDir: repos.SERVER_DIR }));
  return cmds;
}

// --stop：按 --workspace 的 services 范围杀进程后退出（docker 一律不动）
if (args.stop) {
  for (const [cmd, a] of killCommands()) await runToEnd('stop', cmd, a);
  console.log('[stop] 完成（docker 未动，需要停 docker 请显式 docker compose down）');
  process.exit(0);
}

// ---- 前置校验（fail loud）----
const need = ['AGENTS_DIR'];
if (args.services.web) need.push('WEB_DIR');
if (args.services.server || args.services.docker) need.push('SERVER_DIR');
validateRepos(repos, { need });

if (args.services.agents) {
  const cfg = agentsCli.configPath(repos.AGENTS_DIR);
  if (!existsSync(cfg)) {
    const msg = `agents config.yaml 不存在: ${cfg}\n请先 cp packages/server/conf/config.example.yaml packages/server/conf/config.yaml 并填 pg/minio/LLM（worktree 场景用 agents-cli prepare + FX_AGENTS_FROM=<主仓>）`;
    if (args.dryRun) console.warn(`[debug] ⚠️  ${msg}`);   // dry-run 只 warn，能预览计划
    else throw new Error(msg);
  }
}

let dockerScriptPath = process.env.FX_DOCKER_START_SCRIPT;
if (args.services.docker && !args.dryRun) {
  try {
    dockerScriptPath = serverCli.validatePreparedDockerScript({ scriptPath: dockerScriptPath });
  } catch (error) {
    console.error(`[debug] 失败: ${error.message}`);
    process.exit(1);
  }
}

async function confirm(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { const a = (await rl.question(q)).trim().toLowerCase(); return a === 'y' || a === 'yes'; }
  finally { rl.close(); }
}

// 长驻子进程集合 + 统一清理（信号退出 & 失败退出都用，避免孤儿 crash-loop）
const children = [];
let tearingDown = false;
function teardown(downDocker) {
  if (tearingDown) return;
  tearingDown = true;
  for (const c of children) { try { c.kill('SIGTERM'); } catch {} }
  for (const [cmd, a] of killCommands()) {
    try { execFileSync(cmd, a); } catch {}
  }
  if (downDocker && args.services.docker) {
    try { execFileSync('sh', ['-c', `cd ${repos.SERVER_DIR} && docker compose down`]); } catch {}
  }
}
process.on('SIGINT', () => { console.log('\n[debug] 收到中断，清理中…'); teardown(args.dockerDownOnExit); process.exit(0); });
process.on('SIGTERM', () => { teardown(args.dockerDownOnExit); process.exit(0); });

async function main() {
  console.log(`[debug] workspace=${args.workspace} services=${JSON.stringify(args.services)}${args.dryRun ? ' (DRY-RUN)' : ''}`);
  console.log(`[debug] AGENTS=${repos.AGENTS_DIR} [${repos.sources.AGENTS_DIR}]`);
  console.log(`[debug] WEB=${repos.WEB_DIR} [${repos.sources.WEB_DIR}]`);
  console.log(`[debug] SERVER=${repos.SERVER_DIR} [${repos.sources.SERVER_DIR}]`);

  // ---- 路径确认：相关路径有 auto（未用 FX_*_DIR 指定）则起前 y/N 确认；全 env 指定 / --yes / dry-run 跳过 ----
  const relevant = [
    'AGENTS_DIR',
    ...(args.services.web ? ['WEB_DIR'] : []),
    ...(args.services.server || args.services.docker ? ['SERVER_DIR'] : []),
  ];
  const hasAuto = relevant.some((k) => repos.sources[k] === 'auto');
  if (!args.dryRun && !args.yes && hasAuto) {
    const ok = await confirm('[debug] 以上路径含自动解析项（[auto]）。确认按此继续? (y/N) ');
    if (!ok) {
      console.log('[debug] 已取消。可用 FX_AGENTS_DIR / FX_WEB_DIR / FX_SERVER_DIR 显式指定，或加 --yes 跳过确认。');
      return;
    }
  }

  // ---- Step 0: 杀干净上一轮 ----
  const killCmds = killCommands();
  if (args.dryRun) {
    console.log('[debug] would KILL:'); killCmds.forEach((c) => console.log('   ', c[0], c[1].join(' ')));
  } else {
    for (const [cmd, a] of killCmds) await runToEnd('kill', cmd, a);
  }

  // ---- 写 .env.local（per-service 知识在 web-cli）----
  if (args.dryRun) {
    if (args.services.web) console.log('[debug] would WRITE .env.local:', JSON.stringify(webCli.buildWebEnv({ agentsDir: repos.AGENTS_DIR, ports: PORTS })), '->', webCli.envLocalPath(repos.WEB_DIR));
  } else if (args.services.web) {
    webCli.writeEnv({ webDir: repos.WEB_DIR, agentsDir: repos.AGENTS_DIR, ports: PORTS });
  }

  // ---- CSS 产物检查（agents 知识在 agents-cli）----
  if (args.services.web) {
    await agentsCli.ensureCss({
      agentsDir: repos.AGENTS_DIR,
      run: args.dryRun
        ? async () => console.log('[debug] would RUN pnpm build:css')
        : (label, cmd, a) => runToEnd(label, cmd, a, { cwd: repos.AGENTS_DIR }),
    });
  }

  if (args.dryRun && args.services.docker) {
    console.log('[debug] would REQUIRE an Agent-generated Docker script via FX_DOCKER_START_SCRIPT');
  }
  if (args.dryRun) { console.log('[debug] dry-run 结束，未起任何服务'); return; }

  // ---- Step 1: docker ----
  // Docker 脚本由 Agent 按 references/server.md 读取当前 dockerstart.sh 后生成。
  // launcher 只校验、执行、清理临时脚本，并负责后续健康检查。
  if (args.services.docker) {
    await serverCli.infra({
      serverDir: repos.SERVER_DIR,
      dockerScriptPath,
    });
  }

  // ---- Step 2: agents + server ----
  if (args.services.agents && !args.services.docker) {
    // ui 档不管 docker，但 agents 硬依赖 pg/minio —— 未就绪会 silent 卡到健康超时，预检 fail loud
    const pgUp = await tcpOpen(5432);
    const minioUp = await tcpOpen(9000);
    if (!pgUp || !minioUp) {
      throw new Error(`agents 依赖的中间件未就绪: pg5432=${pgUp ? 'UP' : 'DOWN'} minio9000=${minioUp ? 'UP' : 'DOWN'}。改用 --workspace=agents 让 launcher 起 docker，或先手动 docker compose up -d`);
    }
  }
  if (args.services.agents) {
    children.push(agentsCli.start({ agentsDir: repos.AGENTS_DIR }));
    await waitHealthy('agents', () => httpOk(`http://127.0.0.1:${PORTS.agents}/health`), { tries: 60, intervalMs: 1000 });
  }
  if (args.services.server) {
    // server 启动知识单源在 server-cli。docker 已在 Step 1 显式完成时不重复执行；
    // 仅启动 server 的 standalone 场景仍由 server-cli.start 默认补齐 infra。
    // killOld:true = 沿用旧行为（orchestrator Step 0 已杀旧，这里是二道保险，start 内不再交互确认）。
    await serverCli.start({
      serverDir: repos.SERVER_DIR,
      ports: PORTS,
      killOld: true,
      ensureInfra: !args.services.docker,
    });
    await waitHealthy('server', () => httpOk(`http://127.0.0.1:${PORTS.server}/`), { tries: 30, intervalMs: 2000 });
  }

  // ---- Step 3: web ----
  if (args.services.web) {
    if (args.cssWatch) children.push(spawnPrefixed('css', 'pnpm', ['build:css:watch'], { cwd: repos.AGENTS_DIR }));
    children.push(webCli.start({ webDir: repos.WEB_DIR }));   // 清 Vite 缓存已内聚在 start()
    await waitHealthy('web', () => tcpOpen(PORTS.web), { tries: 120, intervalMs: 1000 });
    console.log(`\n[debug] ✅ 就绪 → http://localhost:${PORTS.web}/decision/home\n`);
  }
}

main().catch((e) => {
  console.error(`[debug] 失败: ${e.message}`);
  teardown(false);   // 失败也清理已起的子进程，避免孤儿 crash-loop；docker 保留供排查
  process.exit(1);
});

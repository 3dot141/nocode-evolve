import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import net from 'node:net';
import { parseArgs } from './lib/cli.mjs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { PORTS, buildWriteTargets } from './lib/ports.mjs';
import { upsertEnv } from './lib/env-file.mjs';
import { buildKillCommands, waitHealthy, runToEnd, spawnPrefixed } from './lib/proc.mjs';

const toolDir = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const repos = resolveRepos({ toolDir });

// ---- 前置校验（fail loud）----
const need = ['AGENTS_DIR'];
if (args.services.web) need.push('WEB_DIR');
if (args.services.server) need.push('SERVER_DIR');
validateRepos(repos, { need });

if (args.services.agents) {
  const cfg = join(repos.AGENTS_DIR, 'packages/server/conf/config.yaml');
  if (!existsSync(cfg)) {
    const msg = `agents config.yaml 不存在: ${cfg}\n请先 cp packages/server/conf/config.example.yaml packages/server/conf/config.yaml 并填 pg/minio/LLM`;
    if (args.dryRun) console.warn(`[debug] ⚠️  ${msg}`);   // dry-run 只 warn，能预览计划
    else throw new Error(msg);
  }
}

const targets = buildWriteTargets({ agentsDir: repos.AGENTS_DIR, ports: PORTS });
const webEnvFile = join(repos.WEB_DIR, 'packages/jsy-web/server/.env.local');

function tcpOpen(port) {
  return new Promise((res) => {
    const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(800, () => { s.destroy(); res(false); });
  });
}
async function httpOk(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.status >= 200 && r.status < 500; }
  catch { return false; }
}
function detectJdk21() {
  try { return execFileSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' }).trim(); }
  catch { return null; }
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
  for (const [cmd, a] of buildKillCommands({ ports: PORTS, serverDir: repos.SERVER_DIR, services: args.services })) {
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
  const relevant = ['AGENTS_DIR', ...(args.services.web ? ['WEB_DIR'] : []), ...(args.services.server ? ['SERVER_DIR'] : [])];
  const hasAuto = relevant.some((k) => repos.sources[k] === 'auto');
  if (!args.dryRun && !args.yes && hasAuto) {
    const ok = await confirm('[debug] 以上路径含自动解析项（[auto]）。确认按此继续? (y/N) ');
    if (!ok) {
      console.log('[debug] 已取消。可用 FX_AGENTS_DIR / FX_WEB_DIR / FX_SERVER_DIR 显式指定，或加 --yes 跳过确认。');
      return;
    }
  }

  // ---- Step 0: 杀干净上一轮 ----
  const killCmds = buildKillCommands({ ports: PORTS, serverDir: repos.SERVER_DIR, services: args.services });
  if (args.dryRun) {
    console.log('[debug] would KILL:'); killCmds.forEach((c) => console.log('   ', c[0], c[1].join(' ')));
  } else {
    for (const [cmd, a] of killCmds) await runToEnd('kill', cmd, a);
  }

  // ---- 写 .env.local（匹配引擎扇出，gitignored 纯文本）----
  if (args.dryRun) {
    if (args.services.web) console.log('[debug] would WRITE .env.local:', targets.webEnv, '->', webEnvFile);
  } else if (args.services.web) {
    upsertEnv(webEnvFile, targets.webEnv);
  }

  // ---- CSS 产物检查 ----
  const cssOk = existsSync(join(repos.AGENTS_DIR, 'packages/desktop/dist/style.css'))
    && existsSync(join(repos.AGENTS_DIR, 'packages/ui/dist/agent-ui.css'));
  if (args.services.web && !cssOk) {
    console.log('[debug] CSS 产物缺失，跑 pnpm build:css');
    if (!args.dryRun) await runToEnd('build:css', 'pnpm', ['build:css'], { cwd: repos.AGENTS_DIR });
  }

  if (args.dryRun) { console.log('[debug] dry-run 结束，未起任何服务'); return; }

  // ---- Step 1: docker（down 旧 → up 全栈但用 --scale 不创建内置 fx-data-agents）----
  // 不走 dockerstart.sh 的 up（它写死 up 全栈含 fx-data-agents, 且该服务 pull_policy:always 每次重拉）。
  // 这里复用 cp template + 按分支算 IMAGE_PREFIX，跳过 harbor login（依赖已缓存镜像；首次未缓存先手动 ./dockerstart.sh 拉一次）。
  if (args.services.docker) {
    const scaleArg = args.services.agents ? '--scale fx-data-agents=0' : '';   // 起本地 agents 就不创建 docker 上那个
    const up = [
      `cd ${repos.SERVER_DIR}`,
      `[ -f docker-compose.yml ] && docker compose down || true`,             // 关旧
      `[ -f docker-compose.yml ] || cp docker-compose.template.yml docker-compose.yml`,
      `BR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)`,
      `case "$BR" in *release*) PFX=test;; *persist*) PFX=prod;; *) PFX=dev;; esac`,
      `IMAGE_PREFIX=$PFX docker compose up -d ${scaleArg}`,                    // 起新
    ].join(' && ');
    await runToEnd('docker', 'sh', ['-c', up]);
    await waitHealthy('docker', async () => (await tcpOpen(5432)) && (await tcpOpen(9000)), { tries: 60, intervalMs: 1000 });
  }

  // ---- Step 2: agents + server（并行启动，分别等健康）----
  if (args.services.agents) {
    children.push(spawnPrefixed('agents', 'pnpm', ['dev:server'], { cwd: repos.AGENTS_DIR }));
    await waitHealthy('agents', () => httpOk(`http://127.0.0.1:${PORTS.agents}/health`), { tries: 60, intervalMs: 1000 });
  }
  if (args.services.server) {
    const jdk = detectJdk21();
    if (!jdk) throw new Error('未找到 JDK 21（/usr/libexec/java_home -v 21）。Gradle 8.5 不支持 Java 26，必须 JDK21。');
    children.push(spawnPrefixed('server', './gradlew', ['clean', 'bootRun'], {
      cwd: repos.SERVER_DIR,
      env: { ...process.env, JAVA_HOME: jdk, SERVER_PORT: targets.serverEnv.SERVER_PORT },
    }));
    await waitHealthy('server', () => httpOk(`http://127.0.0.1:${PORTS.server}/`), { tries: 180, intervalMs: 2000 });
  }

  // ---- Step 3: web ----
  if (args.services.web) {
    if (args.cssWatch) children.push(spawnPrefixed('css', 'pnpm', ['build:css:watch'], { cwd: repos.AGENTS_DIR }));
    children.push(spawnPrefixed('web', 'pnpm', ['dev'], { cwd: repos.WEB_DIR, env: { ...process.env, JSY_DEV_MODE: 'vite' } }));
    await waitHealthy('web', () => tcpOpen(PORTS.web), { tries: 120, intervalMs: 1000 });
    console.log(`\n[debug] ✅ 就绪 → http://localhost:${PORTS.web}/decision/home\n`);
  }
}

main().catch((e) => {
  console.error(`[debug] 失败: ${e.message}`);
  teardown(false);   // 失败也清理已起的子进程，避免孤儿 crash-loop；docker 保留供排查
  process.exit(1);
});

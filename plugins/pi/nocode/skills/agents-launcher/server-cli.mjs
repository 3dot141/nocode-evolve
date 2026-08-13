#!/usr/bin/env node
// server (fx-data-server Spring Boot) 独立 dev CLI。取代 scripts/dev-start.sh 的 app 相关子命令
// （ui/sync/fresh/remote/all/restart 不迁移，见设计文档 Out of Scope）。
// 用法: FX_SERVER_DIR=<repo> node server-cli.mjs <verb> [--yes] [--kill-old]
//   verb: prepare（infra/start/stop/status 由 T3/T4/T4b 渐进挂载）
import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateRepos } from './lib/paths.mjs';
import { detectGraalvm, resolveJdk21ForBuild } from './lib/server/graalvm.mjs';
import { startInfra } from './lib/server/infra.mjs';
import { startApp } from './lib/server/boot.mjs';
import { localInfraEnv, loadDotEnv } from './lib/server/env.mjs';
import { stopApp, serverStatus } from './lib/server/lifecycle.mjs';

const ANTLR_MODULE = 'fx-agent-workspace';
// 新旧两代 fx-agent-workspace build.gradle.kts 接线不同，产物目录不同，两个都探测。
const ANTLR_OUTPUT_DIRS = ['src/main/antlr-generated', 'src/main/generated'];

export async function prepare({ serverDir, exec = execFileSync, log = console.log } = {}) {
  const moduleDir = join(serverDir, ANTLR_MODULE);
  if (!existsSync(moduleDir)) {
    throw new Error(`ANTLR 预热失败：模块目录不存在 ${moduleDir}（fx-agent-workspace 模块缺失或路径不对）`);
  }

  log(`[prepare] 检测 GraalVM...`);
  const graalvm = detectGraalvm({ serverDir, exec });
  if (graalvm.mode === 'local') log(`[prepare] GraalVM: ${graalvm.javaHome}`);
  else if (graalvm.mode === 'container') log(`[prepare] 本地无 GraalVM，start 阶段将用容器方案（${graalvm.image}）`);
  else log(`[prepare] ⚠️ 未找到 GraalVM 且无 docker，start 阶段会失败`);

  // gradle 需要兼容的 JDK（本机默认 java 可能过新，如 JDK 26 会 build 失败）——显式解析 JAVA_HOME
  const jdk = resolveJdk21ForBuild({ graalvm, exec });
  if (!jdk) log('[prepare] ⚠️ 未解析到 JDK 21，gradle 将用环境默认 JDK（过新版本可能失败）');
  const gradleEnv = jdk ? { ...process.env, JAVA_HOME: jdk, PATH: `${jdk}/bin:${process.env.PATH}` } : process.env;

  log(`[prepare] 跑 ANTLR 语法生成（gradlew :${ANTLR_MODULE}:generateGrammarSource）...`);
  exec('./gradlew', [`:${ANTLR_MODULE}:generateGrammarSource`], { cwd: serverDir, stdio: 'inherit', env: gradleEnv });

  const producedDir = ANTLR_OUTPUT_DIRS.find((rel) => dirHasFiles(join(moduleDir, rel)));
  if (!producedDir) {
    throw new Error(
      `ANTLR 预热跑完但未检出产物（检查过 ${ANTLR_OUTPUT_DIRS.join(' / ')}），` +
      `生成目录是 gitignored 的，新 worktree 首次必须跑这一步，IDE 才不会对 Lexer/Parser/Visitor 类报红`,
    );
  }
  log(`[prepare] ANTLR 产物就绪: ${moduleDir}/${producedDir}`);
  return { graalvm, antlrOutputDir: producedDir };
}

function dirHasFiles(dir) {
  if (!existsSync(dir)) return false;
  try {
    // fs 递归遍历（不依赖 shell find，可测且跨平台；node 18.17+ 支持 recursive）
    return readdirSync(dir, { recursive: true, withFileTypes: true }).some((e) => e.isFile());
  } catch {
    return false;
  }
}

// bash force_local_infra 里带 ${VAR:-default} 语义（尊重已有环境变量）的 key；其余 key 强制覆盖为 localhost。
const RESPECT_EXISTING = ['DB_USERNAME', 'DB_PASSWORD', 'CACHE_MONGO_USERNAME', 'CACHE_MONGO_PASSWORD', 'DATASOURCE_MONGO_USERNAME', 'DATASOURCE_MONGO_PASSWORD', 'POLARS_MASTER_CONFIG_STR'];

export async function infra({
  serverDir,
  env = process.env,
  log = console.log,
  startInfraFn = startInfra,
} = {}) {
  return startInfraFn({
    serverDir,
    env,
    log,
  });
}


// 完整 app 链（standalone 默认包含 infra；orchestrator 已显式起过 docker 时传 ensureInfra:false）。
export async function start({
  serverDir,
  ports,
  killOld = false,
  ensureInfra = true,
  log = console.log,
  baseEnv = process.env,
  infraFn = infra,
  detectGraalvmFn = detectGraalvm,
  startAppFn = startApp,
} = {}) {
  // 局部 env：不污染 process.env——orchestrator 同进程直调，后续起 web 不能继承 server 的
  // DB/S3/代理配置（红蓝裁决 E；bash 时代 dev-start.sh 是子进程天然隔离，node 直调必须显式隔离）
  const env = {
    ...baseEnv,
    // fx-data-server 的 dev profile 默认执行 `open http://localhost/decision`。
    // launcher 是后台编排入口，每次显式关闭，且覆盖调用环境里可能残留的 true。
    OPENPROJECT_ISOPEN: 'false',
  };
  loadDotEnv({ serverDir, env });   // 原 60-64 行：.env 先载入（不覆盖已有值）
  Object.assign(env, localInfraEnv({
    overrides: Object.fromEntries(RESPECT_EXISTING.filter((k) => env[k] !== undefined).map((k) => [k, env[k]])),
  }));   // 原 force_local_infra：本地模式强制基础设施指向 localhost
  if (ensureInfra) await infraFn({ env, log, serverDir });
  const graalvm = detectGraalvmFn({ serverDir, env });
  return startAppFn({ serverDir, appPort: ports?.server ?? 8081, graalvm, env, killOld, log });
}

// teardown 用的同步 kill 命令段（orchestrator execFileSync 逐条跑）。
// 完整停服（pid 文件/等待释放）走 stopApp；这里是 gradlew --stop + 容器清理 + 端口兜底三层。
export function killCommands({ ports, serverDir }) {
  return [
    ['sh', ['-c', `cd ${serverDir} && ./gradlew --stop || true`]],
    // 容器模式启动的 server（.dev-start.pid='container'）gradlew/端口 kill 都够不着——幂等清理（红蓝裁决 C）
    ['sh', ['-c', `docker rm -f dev-backend 2>/dev/null || true`]],
    ['sh', ['-c', `lsof -ti tcp:${ports.server} | xargs kill -9 2>/dev/null || true`]],
  ];
}

// 渐进挂载清单：T3/T4/T4b 各自补一个 case 时同步 push 自己的动词名，default 报错文案据此动态生成，
// 避免声明未实现的假契约（红蓝裁决 A）。
const SUPPORTED_VERBS = ['prepare'];
SUPPORTED_VERBS.push('infra');   // T3 挂载
SUPPORTED_VERBS.push('start');   // T4 挂载
SUPPORTED_VERBS.push('stop', 'status');   // T4b 挂载

async function main() {
  const [verb, ...flags] = process.argv.slice(2);
  const serverDir = process.env.FX_SERVER_DIR;
  if (!serverDir) throw new Error('FX_SERVER_DIR 未设置');
  validateRepos({ SERVER_DIR: serverDir }, { need: ['SERVER_DIR'] });

  switch (verb) {
    case 'prepare':
      await prepare({ serverDir });
      break;
    case 'infra':
      await infra({ serverDir });
      break;
    case 'start':
      await start({ serverDir, killOld: flags.includes('--kill-old') });
      break;
    case 'stop':
      stopApp({ serverDir });
      break;
    case 'status': {
      const s = serverStatus();
      for (const row of Object.values(s)) {
        console.log(`[status] ${row.name.padEnd(4)} :${row.port} ${row.up ? 'UP  ' : 'DOWN'} pid=${row.pid}`);
      }
      break;
    }
    default:
      console.error(`不支持的 verb: ${verb}（当前支持: ${SUPPORTED_VERBS.join('|')}）`);
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`[server-cli] 失败: ${e.message}`); process.exit(1); });
}

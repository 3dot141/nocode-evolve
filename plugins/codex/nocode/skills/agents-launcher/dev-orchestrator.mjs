#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from './lib/cli.mjs';
import { loadLauncherConfig } from './lib/launcher-config.mjs';
import { resolveRepos, validateRepos } from './lib/paths.mjs';
import { PORTS } from './lib/ports.mjs';
import { httpOk, pidOnPort, tcpOpen } from './lib/probe.mjs';
import { spawnPrefixed } from './lib/proc.mjs';
import {
  ADAPTER_CAPABILITIES,
  ADAPTER_NAMES,
  createServiceAdapters,
} from './lib/service-adapters.mjs';
import { ServiceRuntime } from './lib/service-runtime.mjs';
import {
  buildServicePlan,
  topologyCatalog,
} from './lib/topology.mjs';
import * as agentsCli from './agents-cli.mjs';
import * as serverCli from './server-cli.mjs';
import * as webCli from './web-cli.mjs';

const defaultToolDir = dirname(fileURLToPath(import.meta.url));

function identityAdapterNames() {
  return Object.entries(ADAPTER_CAPABILITIES)
    .filter(([, capability]) => capability.supportsIdentity)
    .map(([adapterName]) => adapterName);
}

export function prepareLaunch({
  argv,
  toolDir,
  loadConfig = loadLauncherConfig,
} = {}) {
  const { config, sourcePath } = loadConfig({
    path: join(toolDir, 'agents-launcher.yml'),
    adapterNames: ADAPTER_NAMES,
    identityAdapterNames: identityAdapterNames(),
  });
  const args = parseArgs(argv, topologyCatalog(config));
  const plan = buildServicePlan(config, args);
  return { args, config, plan, sourcePath };
}

async function askConfirmation(question) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = (await readline.question(question)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    readline.close();
  }
}

async function printStatus({ log, probes, ports }) {
  const rows = [
    ['web', ports.web, await probes.tcpOpen(ports.web)],
    ['agents', ports.agents, await probes.httpOk(`http://127.0.0.1:${ports.agents}/health`)],
    ['server', ports.server, await probes.tcpOpen(ports.server)],
    ['pg', 5432, await probes.tcpOpen(5432)],
    ['minio', 9000, await probes.tcpOpen(9000)],
  ];
  for (const [name, port, healthy] of rows) {
    const pid = healthy ? probes.pidOnPort(port) || '-' : '-';
    log(`[status] ${name.padEnd(6)} :${String(port).padEnd(5)} ${healthy ? 'UP  ' : 'DOWN'} pid=${pid}`);
  }
}

async function runPreflight({
  args,
  plan,
  repos,
  env,
  deps,
}) {
  const selected = new Set(plan.selected);
  const need = ['AGENTS_DIR'];
  if (selected.has('web')) need.push('WEB_DIR');
  if (selected.has('server') || selected.has('docker')) need.push('SERVER_DIR');
  deps.validateRepos(repos, { need });

  if (selected.has('agents')) {
    const configPath = deps.agentsApi.configPath(repos.AGENTS_DIR);
    if (!deps.existsSync(configPath)) {
      throw new Error(
        `agents config.yaml 不存在: ${configPath}\n`
        + '请先复制 packages/server/conf/config.example.yaml 为 config.yaml 并填写 pg/minio/LLM',
      );
    }
  }

  let dockerScriptPath = env.FX_DOCKER_START_SCRIPT;
  if (selected.has('docker')) {
    dockerScriptPath = deps.serverApi.validatePreparedDockerScript({
      scriptPath: dockerScriptPath,
    });
  }

  const relevant = [
    'AGENTS_DIR',
    ...(selected.has('web') ? ['WEB_DIR'] : []),
    ...(selected.has('server') || selected.has('docker') ? ['SERVER_DIR'] : []),
  ];
  const hasAuto = relevant.some((key) => repos.sources[key] === 'auto');
  if (!args.yes && hasAuto) {
    const confirmed = await deps.confirm(
      '[debug] 以上路径含自动解析项（[auto]）。确认按此继续? (y/N) ',
    );
    if (!confirmed) return { cancelled: true, dockerScriptPath };
  }

  if (selected.has('web')) {
    deps.webApi.writeEnv({
      webDir: repos.WEB_DIR,
      agentsDir: repos.AGENTS_DIR,
      ports: PORTS,
    });
    await deps.agentsApi.ensureCss({ agentsDir: repos.AGENTS_DIR });
  }

  if (selected.has('agents') && !selected.has('docker')) {
    const [pgUp, minioUp] = await Promise.all([
      deps.tcpOpen(5432),
      deps.tcpOpen(9000),
    ]);
    if (!pgUp || !minioUp) {
      throw new Error(
        `agents 依赖的中间件未就绪: pg5432=${pgUp ? 'UP' : 'DOWN'} minio9000=${minioUp ? 'UP' : 'DOWN'}`,
      );
    }
  }
  return { cancelled: false, dockerScriptPath };
}

export function installSignalHandlers({
  runtime,
  downDocker,
  processLike = process,
  log = console.log,
} = {}) {
  let shutdownPromise = null;
  const shutdown = (signal) => {
    if (!shutdownPromise) {
      log(`[debug] 收到 ${signal}，清理中`);
      shutdownPromise = runtime.close({ downDocker })
        .finally(() => processLike.exit(0));
    }
    return shutdownPromise;
  };
  processLike.once('SIGINT', () => { void shutdown('SIGINT'); });
  processLike.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  return shutdown;
}

export async function runLauncher({
  argv = process.argv.slice(2),
  env = process.env,
  toolDir = defaultToolDir,
  deps: overrides = {},
} = {}) {
  const deps = {
    loadLauncherConfig,
    resolveRepos,
    validateRepos,
    existsSync,
    createServiceAdapters,
    createRuntime: (options) => new ServiceRuntime(options),
    agentsApi: agentsCli,
    serverApi: serverCli,
    webApi: webCli,
    tcpOpen,
    httpOk,
    pidOnPort,
    spawnPrefixed,
    confirm: askConfirmation,
    installSignals: installSignalHandlers,
    log: console.log,
    ...overrides,
  };
  const launch = prepareLaunch({
    argv,
    toolDir,
    loadConfig: deps.loadLauncherConfig,
  });
  const {
    args,
    config,
    plan,
    sourcePath,
  } = launch;
  const emit = (event, payload) => {
    deps.log(`[${event}] ${JSON.stringify(payload)}`);
  };

  if (args.status) {
    await printStatus({
      log: deps.log,
      probes: deps,
      ports: PORTS,
    });
    return { mode: 'status', ...launch };
  }
  emit('topology.loaded', {
    sourcePath,
    schemaVersion: config.schema_version,
    workspace: plan.workspace,
    selected: plan.selected,
  });
  emit('plan.created', {
    startOrder: plan.startOrder,
    stopOrder: plan.stopOrder,
    omittedOptionalDependencies: plan.omittedOptionalDependencies,
    propagationEdges: plan.propagationEdges,
  });
  if (args.dryRun) {
    deps.log('[debug] dry-run 结束，未写配置、未停止或启动任何进程');
    return { mode: 'dry-run', ...launch };
  }

  const repos = deps.resolveRepos({ toolDir, env });
  if (args.stop) {
    const adapters = deps.createServiceAdapters({
      repos,
      ports: PORTS,
      services: {
        agents: deps.agentsApi,
        server: deps.serverApi,
        web: deps.webApi,
      },
      io: deps,
    });
    const runtime = deps.createRuntime({
      plan,
      adapters,
      supervision: config.supervision,
      log: emit,
    });
    await runtime.stopSelected({ includeDocker: false });
    deps.log('[stop] 完成（docker 未动，需要停 docker 请显式 docker compose down）');
    return {
      mode: 'stop',
      runtime,
      repos,
      ...launch,
    };
  }

  deps.log(`[debug] AGENTS=${repos.AGENTS_DIR} [${repos.sources.AGENTS_DIR}]`);
  deps.log(`[debug] WEB=${repos.WEB_DIR} [${repos.sources.WEB_DIR}]`);
  deps.log(`[debug] SERVER=${repos.SERVER_DIR} [${repos.sources.SERVER_DIR}]`);
  const preflight = await runPreflight({
    args,
    plan,
    repos,
    env,
    deps,
  });
  if (preflight.cancelled) {
    deps.log('[debug] 已取消。可用 FX_AGENTS_DIR / FX_WEB_DIR / FX_SERVER_DIR 显式指定，或加 --yes 跳过确认。');
    return { mode: 'cancelled', repos, ...launch };
  }

  const adapters = deps.createServiceAdapters({
    repos,
    ports: PORTS,
    options: { dockerScriptPath: preflight.dockerScriptPath },
    services: {
      agents: deps.agentsApi,
      server: deps.serverApi,
      web: deps.webApi,
    },
    io: deps,
  });
  const runtime = deps.createRuntime({
    plan,
    adapters,
    supervision: config.supervision,
    log: emit,
  });

  if (args.cssWatch && plan.selected.includes('web')) {
    runtime.registerAuxiliaryHandle(deps.spawnPrefixed(
      'css',
      'pnpm',
      ['build:css:watch'],
      { cwd: repos.AGENTS_DIR },
    ));
  }
  deps.installSignals({
    runtime,
    downDocker: args.dockerDownOnExit,
    log: deps.log,
  });

  try {
    await runtime.startSelected();
    if (runtime.phase === 'running') await runtime.startSupervisor();
  } catch (error) {
    await runtime.close({ downDocker: false });
    throw error;
  }
  if (plan.selected.includes('web')) {
    deps.log(`\n[debug] ✅ 就绪 → http://localhost:${PORTS.web}/decision/home\n`);
  }
  return {
    mode: 'running',
    runtime,
    repos,
    ...launch,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runLauncher().catch((error) => {
    console.error(`[debug] 失败: ${error.message}`);
    process.exitCode = 1;
  });
}

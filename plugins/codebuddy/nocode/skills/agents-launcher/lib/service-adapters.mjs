import * as agentsCli from '../agents-cli.mjs';
import * as serverCli from '../server-cli.mjs';
import * as webCli from '../web-cli.mjs';
import { httpOk, pidOnPort, tcpOpen } from './probe.mjs';
import { runToEnd } from './proc.mjs';
import { PORTS } from './ports.mjs';

export const ADAPTER_CAPABILITIES = Object.freeze({
  docker: Object.freeze({ lifecycle: 'oneshot', supportsIdentity: false }),
  agents: Object.freeze({ lifecycle: 'service', supportsIdentity: true }),
  server: Object.freeze({ lifecycle: 'service', supportsIdentity: true }),
  web: Object.freeze({ lifecycle: 'service', supportsIdentity: true }),
});

export const ADAPTER_NAMES = Object.freeze(Object.keys(ADAPTER_CAPABILITIES));

function handles(child) {
  return { handles: child ? [child] : [] };
}

function normalizeStatus(status) {
  const identity = status.up && status.pid && status.pid !== '-'
    ? String(status.pid)
    : null;
  return { healthy: Boolean(status.up), identity };
}

async function runCommands(label, commands, run) {
  for (const [command, args] of commands) {
    await run(label, command, args);
  }
}

export function createServiceAdapters({
  repos,
  ports = PORTS,
  options = {},
  services = { agents: agentsCli, server: serverCli, web: webCli },
  io = {},
} = {}) {
  const run = io.runToEnd ?? runToEnd;
  const probes = {
    httpOk: io.httpOk ?? httpOk,
    pidOnPort: io.pidOnPort ?? pidOnPort,
    tcpOpen: io.tcpOpen ?? tcpOpen,
  };

  const registry = {
    docker: {
      ...ADAPTER_CAPABILITIES.docker,
      async start() {
        await services.server.infra({
          serverDir: repos.SERVER_DIR,
        });
        return { handles: [] };
      },
      async stop({ downDocker = false } = {}) {
        if (!downDocker) return;
        const code = await run(
          'docker-down',
          'docker',
          ['compose', 'down'],
          { cwd: repos.SERVER_DIR },
        );
        if (code !== 0) throw new Error(`[docker-down] docker compose down failed (${code})`);
      },
      async status() {
        return { healthy: true, identity: null };
      },
    },
    agents: {
      ...ADAPTER_CAPABILITIES.agents,
      async start() {
        return handles(services.agents.start({ agentsDir: repos.AGENTS_DIR }));
      },
      async stop() {
        await runCommands('agents-stop', services.agents.killCommands({ ports }), run);
      },
      async status() {
        return normalizeStatus(await services.agents.status({ ports, probes }));
      },
    },
    server: {
      ...ADAPTER_CAPABILITIES.server,
      async start(context) {
        const child = await services.server.start({
          serverDir: repos.SERVER_DIR,
          ports,
          killOld: true,
          ensureInfra: !context.plan.selected.includes('docker'),
        });
        return handles(child);
      },
      async stop() {
        await runCommands(
          'server-stop',
          services.server.killCommands({ ports, serverDir: repos.SERVER_DIR }),
          run,
        );
      },
      async status() {
        const healthy = await probes.httpOk(`http://127.0.0.1:${ports.server}/`);
        const identity = healthy ? String(await probes.pidOnPort(ports.server) || '') : '';
        return { healthy, identity: identity || null };
      },
    },
    web: {
      ...ADAPTER_CAPABILITIES.web,
      async start() {
        // start 可能复用已有实例返回 null——无 handle 即可（stop 走 killCommands 端口杀法，不依赖 handle）
        return handles(services.web.start({ webDir: repos.WEB_DIR, ports }));
      },
      async stop() {
        await runCommands('web-stop', services.web.killCommands({ ports }), run);
      },
      async status() {
        return normalizeStatus(await services.web.status({
          ports,
          probes: {
            httpOk: probes.httpOk,
            pidOnPort: probes.pidOnPort,
          },
        }));
      },
    },
  };

  for (const adapter of Object.values(registry)) Object.freeze(adapter);
  return Object.freeze(registry);
}

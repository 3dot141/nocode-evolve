const WORKSPACES = {
  ui:     { web: true, agents: true, docker: false, server: false },
  agents: { web: true, agents: true, docker: true,  server: false },
  full:   { web: true, agents: true, docker: true,  server: true },
};

export function parseArgs(argv) {
  let workspace = 'ui';
  const flags = new Set();
  for (const arg of argv) {
    const m = arg.match(/^--workspace=(.+)$/);
    if (m) { workspace = m[1]; continue; }
    if (arg.startsWith('--')) { flags.add(arg.slice(2)); continue; }
  }
  if (!WORKSPACES[workspace]) {
    throw new Error(`未知 workspace: ${workspace}（可选 ui | agents | full）`);
  }
  const services = { ...WORKSPACES[workspace] };
  for (const s of ['web', 'agents', 'docker', 'server']) {
    if (flags.has(`no-${s}`)) services[s] = false;
  }
  return {
    workspace,
    services,
    dryRun: flags.has('dry-run'),
    cssWatch: flags.has('css-watch'),
    dockerDownOnExit: flags.has('docker-down-on-exit'),
    yes: flags.has('yes'),
    // 运维子命令：--status 查健康不起服务；--stop 按 services 杀进程不起服务
    status: flags.has('status'),
    stop: flags.has('stop'),
  };
}

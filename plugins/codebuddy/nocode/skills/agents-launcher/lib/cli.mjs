export function parseArgs(argv, catalog) {
  if (!catalog?.workspaceIds?.length || !catalog?.serviceIds?.length) {
    throw new Error('[topology] parseArgs 需要已验证的 workspace/service catalog');
  }
  let workspace = 'ui';
  const flags = new Set();
  for (const arg of argv) {
    const match = arg.match(/^--workspace=(.+)$/);
    if (match) {
      workspace = match[1];
      continue;
    }
    if (arg.startsWith('--')) flags.add(arg.slice(2));
  }
  if (!catalog.workspaceIds.includes(workspace)) {
    throw new Error(
      `[topology] 未知 workspace: ${workspace}（可选 ${catalog.workspaceIds.join(' | ')}）`,
    );
  }

  for (const flag of flags) {
    if (!flag.startsWith('no-')) continue;
    const serviceId = flag.slice('no-'.length);
    if (!catalog.serviceIds.includes(serviceId)) {
      throw new Error(`[topology] 未知 service: ${serviceId}`);
    }
  }

  return {
    workspace,
    disabled: catalog.serviceIds.filter((serviceId) => flags.has(`no-${serviceId}`)),
    dryRun: flags.has('dry-run'),
    cssWatch: flags.has('css-watch'),
    dockerDownOnExit: flags.has('docker-down-on-exit'),
    yes: flags.has('yes'),
    status: flags.has('status'),
    stop: flags.has('stop'),
  };
}

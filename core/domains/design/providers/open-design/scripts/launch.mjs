#!/usr/bin/env node
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export class OpenDesignLaunchError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

const SAFE_CHILD_ENV_KEYS = [
  'HOME', 'PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SHELL', 'USER', 'LOGNAME', 'TERM',
];

function openDesignChildEnv(env, home, dataDir, ipcPath) {
  const childEnv = {};
  for (const key of SAFE_CHILD_ENV_KEYS) {
    if (typeof env[key] === 'string') childEnv[key] = env[key];
  }
  childEnv.HOME ??= home;
  return {
    ...childEnv,
    ELECTRON_RUN_AS_NODE: '1',
    OD_DATA_DIR: dataDir,
    OD_SIDECAR_IPC_PATH: ipcPath,
  };
}

export function resolveOpenDesignLaunch({
  env = process.env, home = os.homedir(), systemApplications = '/Applications',
} = {}) {
  const namespace = env.NOCODE_OPEN_DESIGN_NAMESPACE || 'release-stable';
  if (!/^[A-Za-z0-9._-]+$/.test(namespace)) {
    throw new OpenDesignLaunchError('OD_NAMESPACE_INVALID', 'namespace contains unsupported characters');
  }
  const candidates = env.NOCODE_OPEN_DESIGN_APP_PATH
    ? [env.NOCODE_OPEN_DESIGN_APP_PATH]
    : [path.join(systemApplications, 'Open Design.app'), path.join(home, 'Applications/Open Design.app')];
  const app = candidates.find((candidate) => existsSync(candidate));
  if (!app) throw new OpenDesignLaunchError('OD_APP_NOT_FOUND', 'Open Design.app was not found');
  const helper = path.join(app,
    'Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper');
  const cli = path.join(app, 'Contents/Resources/app/prebundled/daemon/daemon-cli.mjs');
  if (![helper, cli].every((file) => existsSync(file) && statSync(file).isFile())) {
    throw new OpenDesignLaunchError('OD_LAYOUT_UNSUPPORTED', 'Open Design layout-v1 is unavailable');
  }
  const dataDir = path.join(home, 'Library/Application Support/Open Design/namespaces', namespace, 'data');
  try { accessSync(dataDir, constants.R_OK | constants.W_OK); } catch {
    throw new OpenDesignLaunchError('OD_DATA_DIR_UNAVAILABLE', 'Open Design data directory is unavailable');
  }
  const ipcPath = path.join('/tmp/open-design/ipc', namespace, 'daemon.sock');
  if (!existsSync(ipcPath)) {
    throw new OpenDesignLaunchError('OD_IPC_UNAVAILABLE', 'Open Design sidecar IPC is unavailable');
  }
  return {
    command: helper,
    args: [cli, 'mcp'],
    env: openDesignChildEnv(env, home, dataDir, ipcPath),
    shell: false,
  };
}

export function launchOpenDesign(options = {}, spawn = spawnSync) {
  const launch = resolveOpenDesignLaunch(options);
  const child = spawn(launch.command, launch.args, {
    env: launch.env, stdio: 'inherit', shell: false,
  });
  if (child.error || child.status == null || child.status !== 0) {
    throw new OpenDesignLaunchError('OD_HANDSHAKE_FAILED', 'Open Design MCP failed to start');
  }
  return child.status;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { process.exitCode = launchOpenDesign(); } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'OD_HANDSHAKE_FAILED', message: error.message })}\n`);
    process.exitCode = 2;
  }
}

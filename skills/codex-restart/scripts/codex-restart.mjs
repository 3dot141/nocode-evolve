#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile as readFileNode } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PLUGIN_NAME = 'nocode@nocode-market';

function resultError(check, exitCode = null) {
  return {
    check,
    message: exitCode === null
      ? `${check} check failed`
      : `${check} command exited with code ${exitCode}`,
  };
}

function stripFileMarker(value) {
  return typeof value === 'string' ? value.replace(/\s+\(file\)\s*$/, '') : null;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function countProxyProcesses(processList) {
  if (typeof processList !== 'string') return null;
  return processList
    .split('\n')
    .filter((line) => /^\s*(?:\d+\s+){2,3}\S*codex\s+app-server\s+proxy(?:\s|$)/.test(line))
    .length;
}

export function parsePluginList(output) {
  const fallback = {
    name: PLUGIN_NAME,
    status: 'not-found',
    version: null,
    path: null,
  };
  if (typeof output !== 'string') return fallback;

  const line = output.split('\n').find((candidate) => candidate.trimStart().startsWith(`${PLUGIN_NAME} `));
  if (!line) return fallback;

  const columns = line.trim().split(/\s{2,}/);
  if (columns.length < 4 || columns[0] !== PLUGIN_NAME) return fallback;
  return {
    name: PLUGIN_NAME,
    status: columns[1],
    version: columns[2] || null,
    path: columns.slice(3).join('  ') || null,
  };
}

export function runCommand(argv) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', () => {
      resolve({ exitCode: null, stdout, stderr: '' });
    });
    child.once('close', (code) => {
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}

async function safeCommand(argv, check, runner, errors) {
  try {
    const result = await runner(argv);
    if (result.exitCode !== 0) errors.push(resultError(check, result.exitCode));
    return result;
  } catch {
    errors.push(resultError(check));
    return { exitCode: null, stdout: '', stderr: '' };
  }
}

async function safeRead(file, check, reader, errors) {
  try {
    return await reader(file, 'utf8');
  } catch {
    errors.push(resultError(check));
    return null;
  }
}

export async function inspectCodex({
  codexPath = process.env.CODEX_CLI_PATH || 'codex',
  codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
  runCommand: runner = runCommand,
  readFile: reader = readFileNode,
  platform = process.platform,
} = {}) {
  const status = {
    schemaVersion: 1,
    daemon: {
      mode: 'unknown',
      status: 'unknown',
      version: null,
      pid: null,
    },
    remoteControl: { enabled: 'unknown' },
    connections: { proxyCount: null },
    app: { status: 'unknown' },
    plugin: {
      name: PLUGIN_NAME,
      status: 'unknown',
      version: null,
      path: null,
    },
    errors: [],
  };

  const doctorResult = await safeCommand(
    [codexPath, 'doctor', '--json'],
    'doctor',
    runner,
    status.errors,
  );
  const doctor = parseJson(doctorResult.stdout);
  const appServerDetails = doctor?.checks?.['app_server.status']?.details;
  if (appServerDetails) {
    status.daemon.mode = appServerDetails.mode ?? 'unknown';
    status.daemon.status = appServerDetails.status ?? 'unknown';
    status.daemon.version = appServerDetails['app-server version'] ?? null;
  } else if (doctorResult.stdout) {
    status.errors.push(resultError('doctor-json'));
  }

  const daemonResult = await safeCommand(
    [codexPath, 'app-server', 'daemon', 'version'],
    'daemon-version',
    runner,
    status.errors,
  );
  const daemonVersion = parseJson(daemonResult.stdout);
  if (daemonVersion) {
    status.daemon.status = daemonVersion.status ?? status.daemon.status;
    status.daemon.version = daemonVersion.appServerVersion
      ?? daemonVersion.managedCodexVersion
      ?? status.daemon.version;
  } else if (daemonResult.stdout) {
    status.errors.push(resultError('daemon-version-json'));
  }

  const settingsPath = stripFileMarker(appServerDetails?.settings)
    ?? path.join(codexHome, 'app-server-daemon', 'settings.json');
  const settingsText = await safeRead(settingsPath, 'remote-control-settings', reader, status.errors);
  const settings = parseJson(settingsText);
  if (settings && typeof settings.remoteControlEnabled === 'boolean') {
    status.remoteControl.enabled = settings.remoteControlEnabled;
  } else if (settingsText !== null) {
    status.errors.push(resultError('remote-control-settings-json'));
  }

  const pidPath = stripFileMarker(appServerDetails?.['pid file'])
    ?? path.join(codexHome, 'app-server-daemon', 'app-server.pid');
  const pidText = await safeRead(pidPath, 'daemon-pid', reader, status.errors);
  if (pidText !== null) {
    const pidFile = parseJson(pidText);
    const pid = Number.isSafeInteger(pidFile?.pid)
      ? pidFile.pid
      : Number.parseInt(pidText.trim(), 10);
    if (Number.isSafeInteger(pid) && pid > 0) status.daemon.pid = pid;
    else status.errors.push(resultError('daemon-pid-format'));
  }

  const processResult = await safeCommand(
    ['ps', '-axo', 'pid=,ppid=,command='],
    'process-list',
    runner,
    status.errors,
  );
  if (processResult.exitCode === 0) {
    status.connections.proxyCount = countProxyProcesses(processResult.stdout);
  }

  if (platform === 'darwin') {
    const appResult = await safeCommand(
      ['osascript', '-e', 'application "Codex" is running'],
      'codex-app',
      runner,
      status.errors,
    );
    if (appResult.exitCode === 0) {
      const appRunning = appResult.stdout.trim();
      if (appRunning === 'true') status.app.status = 'running';
      if (appRunning === 'false') status.app.status = 'stopped';
    }
  }

  const pluginResult = await safeCommand(
    [codexPath, 'plugin', 'list'],
    'plugin-list',
    runner,
    status.errors,
  );
  if (pluginResult.exitCode === 0) {
    status.plugin = parsePluginList(pluginResult.stdout);
  }

  return status;
}

function waitForSpawn(child) {
  return new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', () => reject(new Error('failed to submit restart command')));
  });
}

async function defaultProcessList() {
  const result = await runCommand(['ps', '-axo', 'pid=,ppid=,command=']);
  return result.exitCode === 0 ? result.stdout : null;
}

export async function scheduleRestart({
  confirmed,
  codexPath = process.env.CODEX_CLI_PATH || 'codex',
  listProcesses = defaultProcessList,
  spawnCommand = spawn,
} = {}) {
  if (!confirmed) {
    throw new Error('restart requires --confirmed after immediate user confirmation');
  }

  const proxyCount = countProxyProcesses(await listProcesses());
  const child = spawnCommand(codexPath, ['app-server', 'daemon', 'restart'], {
    detached: true,
    stdio: 'ignore',
  });
  await waitForSpawn(child);
  child.unref();

  return {
    schemaVersion: 1,
    action: 'restart',
    status: 'scheduled',
    proxyCount,
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  const [command, ...options] = argv;
  if (command === 'inspect') {
    process.stdout.write(`${JSON.stringify(await inspectCodex(), null, 2)}\n`);
    return 0;
  }
  if (command === 'restart') {
    try {
      const receipt = await scheduleRestart({ confirmed: options.includes('--confirmed') });
      process.stdout.write(`${JSON.stringify(receipt)}\n`);
      return 0;
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        schemaVersion: 1,
        action: 'restart',
        status: 'error',
        message: error.message,
      })}\n`);
      return options.includes('--confirmed') ? 1 : 2;
    }
  }
  process.stderr.write('Usage: codex-restart.mjs inspect | restart --confirmed\n');
  return 2;
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.exitCode = await runCli();
}

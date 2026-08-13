import { existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PLATFORM_DATA_NAMES = [
  'CLAUDE_PLUGIN_DATA', 'CODEX_PLUGIN_DATA', 'QODER_PLUGIN_DATA', 'PLUGIN_DATA', 'NOCODE_PLUGIN_DATA', 'NOCODE_ROUTE_KEY',
];

export class RuntimeEntryError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'RuntimeEntryError';
    this.code = code;
  }

  toJSON() {
    return { code: this.code, message: this.message.replace(/^[A-Z0-9_]+:\s*/, '') };
  }
}

function validateRuntimeData(value, sourceName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RuntimeEntryError('RUNTIME_DATA_MISSING', `${sourceName} is required`);
  }
  if (!path.isAbsolute(value)) {
    throw new RuntimeEntryError('RUNTIME_DATA_INVALID', `${sourceName} must name an absolute directory path`);
  }
  const runtimeData = path.resolve(value);
  if (existsSync(runtimeData) && !statSync(runtimeData).isDirectory()) {
    throw new RuntimeEntryError('RUNTIME_DATA_INVALID', `${sourceName} must name a directory path`);
  }
  return runtimeData;
}

export function platformDataRoot(platform, env = process.env) {
  if (platform !== 'claude' && platform !== 'codex' && platform !== 'qoder' && platform !== 'pi') {
    throw new RuntimeEntryError('RUNTIME_PLATFORM_INVALID', `unsupported platform: ${platform}`);
  }
  if (platform === 'qoder' && typeof env.QODER_PLUGIN_DATA === 'string' && env.QODER_PLUGIN_DATA.trim()) {
    return validateRuntimeData(env.QODER_PLUGIN_DATA, 'qoder data directory');
  }
  const userHome = env.HOME || env.USERPROFILE || os.homedir();
  return validateRuntimeData(path.join(userHome, '.nocode', platform, 'data'), `${platform} data directory`);
}

export function createRuntimeEnv({ value, sourceName, targetName, baseEnv = {} }) {
  const runtimeData = validateRuntimeData(value, sourceName);
  const output = { ...baseEnv };
  for (const name of PLATFORM_DATA_NAMES) delete output[name];
  output[targetName] = runtimeData;
  return output;
}

export function runRuntimeEntry({
  value, sourceName, targetName, argv, baseEnv = {}, spawn = spawnSync,
}) {
  if (!Array.isArray(argv) || argv.length === 0
    || argv.some((item) => typeof item !== 'string' || !item)) {
    throw new RuntimeEntryError('RUNTIME_TARGET_INVALID', 'target argv must be a non-empty string array');
  }
  const child = spawn(argv[0], argv.slice(1), {
    env: createRuntimeEnv({ value, sourceName, targetName, baseEnv }),
    stdio: 'inherit',
    shell: false,
  });
  if (child.error || child.status == null) {
    throw new RuntimeEntryError('RUNTIME_LAUNCH_FAILED', 'runtime target did not complete normally');
  }
  return child.status;
}

export function targetArgv(args) {
  if (args[0] !== '--') {
    throw new RuntimeEntryError('RUNTIME_TARGET_INVALID', 'target argv must follow --');
  }
  return args.slice(1);
}

export function reportRuntimeEntryError(error, io = process) {
  const routed = error instanceof RuntimeEntryError
    ? error
    : new RuntimeEntryError('RUNTIME_ENTRY_FAILED', 'runtime entry failed');
  io.stderr.write(`${JSON.stringify(routed.toJSON())}\n`);
  return 2;
}

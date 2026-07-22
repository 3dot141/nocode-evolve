#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  platformDataRoot, reportRuntimeEntryError, runRuntimeEntry, targetArgv,
} from '../../../../../../scripts/lib/runtime-entry.mjs';

export function main(args = process.argv.slice(2), env = process.env, io = process, spawn = spawnSync) {
  return runRuntimeEntry({
    value: platformDataRoot('codex', env),
    sourceName: 'codex data directory',
    targetName: 'NOCODE_PLUGIN_DATA',
    argv: targetArgv(args),
    baseEnv: env,
    spawn,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { process.exitCode = main(); } catch (error) { process.exitCode = reportRuntimeEntryError(error); }
}

import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync,
  rmSync, statSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function requireDataRoot(dataRoot = process.env.NOCODE_PLUGIN_DATA) {
  if (typeof dataRoot !== 'string' || !path.isAbsolute(dataRoot)) {
    const error = new Error('NOCODE_PLUGIN_DATA must be an absolute path');
    error.code = 'PLUGIN_DATA_MISSING';
    throw error;
  }
  mkdirSync(dataRoot, { recursive: true });
  return path.resolve(dataRoot);
}

export function sessionDirectory(dataRoot, sessionId) {
  if (!SESSION_ID.test(sessionId || '')) {
    const error = new Error('invalid session id');
    error.code = 'SESSION_ID_INVALID';
    throw error;
  }
  return path.join(requireDataRoot(dataRoot), 'sessions', sessionId);
}

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function atomicWriteJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  let fd;
  let committed = false;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, file);
    committed = true;
    const directory = openSync(path.dirname(file), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } catch (error) {
    if (committed) {
      error.committed = true;
      error.retrySafe = false;
    }
    throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temporary, { force: true });
  }
  return value;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function withFileLock(file, timeoutMs, timeoutCode, fn) {
  mkdirSync(path.dirname(file), { recursive: true });
  const started = Date.now();
  let fd;
  while (Date.now() - started <= timeoutMs) {
    try {
      fd = openSync(file, 'wx', 0o600);
      writeSync(fd, `${process.pid}\n`);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(file).mtimeMs > 30_000) rmSync(file, { force: true });
      } catch { /* raced with lock owner */ }
      sleep(Math.min(5, Math.max(1, timeoutMs)));
    }
  }
  if (fd === undefined) {
    const error = new Error('state lock timeout');
    error.code = timeoutCode;
    throw error;
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    rmSync(file, { force: true });
  }
}

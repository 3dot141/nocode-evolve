#!/usr/bin/env node
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  atomicWriteJson, readJson, sessionDirectory, withFileLock,
} from './lib/session-store.mjs';

export class SessionStateError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

function wrap(error) {
  if (error instanceof SessionStateError) throw error;
  throw new SessionStateError(error.code || 'SESSION_STATE_FAILED', error.message);
}

function paths(sessionId, dataRoot) {
  try {
    const directory = sessionDirectory(dataRoot, sessionId);
    return {
      directory,
      state: path.join(directory, 'session.json'),
      lock: path.join(path.dirname(directory), '.locks', `${sessionId}.lock`),
    };
  } catch (error) { wrap(error); }
}

export function withSessionLock(sessionId, {
  dataRoot, lockTimeoutMs = 2000,
} = {}, fn) {
  const target = paths(sessionId, dataRoot);
  try {
    return withFileLock(target.lock, lockTimeoutMs, 'SESSION_LOCK_TIMEOUT', () => fn(target));
  } catch (error) { wrap(error); }
}

export function readSession(sessionId, { dataRoot } = {}) {
  const { state } = paths(sessionId, dataRoot);
  const session = readJson(state, null);
  if (!session) throw new SessionStateError('SESSION_NOT_FOUND', 'session is not open');
  return session;
}

export function openSession(input, { dataRoot, lockTimeoutMs = 2000 } = {}) {
  if (typeof input?.workspace !== 'string' || !path.isAbsolute(input.workspace)) {
    throw new SessionStateError('SESSION_WORKSPACE_INVALID', 'workspace must be an absolute path');
  }
  const target = paths(input.sessionId, dataRoot);
  try {
    return withFileLock(target.lock, lockTimeoutMs, 'SESSION_LOCK_TIMEOUT', () => {
      const current = readJson(target.state, null);
      if (current?.status === 'open' && current.workspace !== input.workspace) {
        throw new SessionStateError('SESSION_WORKSPACE_MISMATCH', 'open session workspace cannot change');
      }
      return atomicWriteJson(target.state, {
        sessionId: input.sessionId, workspace: input.workspace, status: 'open',
      });
    });
  } catch (error) { wrap(error); }
}

function sessionBusy(directory) {
  const handoffState = readJson(path.join(directory, 'handoff.json'), null);
  if (handoffState?.handoffs?.some((handoff) => handoff.status === 'active')) return true;
  const workflow = path.join(directory, 'workflow');
  if (!existsSync(workflow)) return false;
  if (readdirSync(workflow).some((file) => file.endsWith('.lock'))) return true;
  return readdirSync(workflow).filter((file) => file.endsWith('.json')).some((file) => {
    const state = readJson(path.join(workflow, file), null);
    return state && ['pending', 'running'].includes(state.status);
  });
}

export function closeSession(input, {
  dataRoot, lockTimeoutMs = 2000,
} = {}) {
  const target = paths(input.sessionId, dataRoot);
  try {
    return withFileLock(target.lock, lockTimeoutMs, 'SESSION_LOCK_TIMEOUT', () => {
      const current = readSession(input.sessionId, { dataRoot });
      if (sessionBusy(target.directory)) {
        throw new SessionStateError('SESSION_BUSY', 'active workflow state prevents close');
      }
      return atomicWriteJson(target.state, { ...current, status: 'closed' });
    });
  } catch (error) { wrap(error); }
}

export function cleanupSession(input, {
  dataRoot, lockTimeoutMs = 2000, nowMs = Date.now(),
} = {}) {
  const retentionMs = input?.retentionMs ?? 7 * 24 * 60 * 60 * 1000;
  if (!Number.isInteger(retentionMs) || retentionMs < 0) {
    throw new SessionStateError('SESSION_RETENTION_INVALID', 'retentionMs must be a non-negative integer');
  }
  const target = paths(input.sessionId, dataRoot);
  let receipt;
  let remove = false;
  try {
    withFileLock(target.lock, lockTimeoutMs, 'SESSION_LOCK_TIMEOUT', () => {
      const current = readSession(input.sessionId, { dataRoot });
      if (sessionBusy(target.directory)) {
        throw new SessionStateError('SESSION_BUSY', 'active workflow state prevents cleanup');
      }
      receipt = current.status === 'closed'
        ? current
        : atomicWriteJson(target.state, { ...current, status: 'closed' });
      const ageMs = Math.max(0, nowMs - statSync(target.state).mtimeMs);
      remove = ageMs >= retentionMs;
      if (remove) rmSync(target.directory, { recursive: true, force: true });
    });
    return receipt;
  } catch (error) { wrap(error); }
}

function cli() {
  const [command, raw] = process.argv.slice(2);
  const input = JSON.parse(raw || '{}');
  const result = command === 'open' ? openSession(input)
    : command === 'close' ? closeSession(input)
      : command === 'read' ? readSession(input.sessionId)
        : command === 'cleanup' ? cleanupSession(input)
          : (() => { throw new SessionStateError('SESSION_COMMAND_INVALID', 'unknown command'); })();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { cli(); } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'SESSION_STATE_FAILED', message: error.message })}\n`);
    process.exitCode = 2;
  }
}

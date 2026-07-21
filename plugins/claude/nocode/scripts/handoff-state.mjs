#!/usr/bin/env node
import path from 'node:path';
import {
  atomicWriteJson, readJson, sessionDirectory, withFileLock,
} from './lib/session-store.mjs';
import { readSession } from './session-state.mjs';

const HANDOFF_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class HandoffStateError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

function paths(sessionId, dataRoot) {
  const directory = sessionDirectory(dataRoot, sessionId);
  return {
    state: path.join(directory, 'handoff.json'),
    lock: path.join(path.dirname(directory), '.locks', `${sessionId}.handoff.lock`),
  };
}

function validateId(handoffId) {
  if (!HANDOFF_ID.test(handoffId || '')) {
    throw new HandoffStateError('HANDOFF_ID_INVALID', 'handoffId is invalid');
  }
}

function validateGeneration(generation) {
  if (!Number.isInteger(generation) || generation < 1) {
    throw new HandoffStateError('HANDOFF_GENERATION_INVALID', 'generation must be a positive integer');
  }
}

function assertOpenSession(sessionId, dataRoot) {
  const session = readSession(sessionId, { dataRoot });
  if (session.status !== 'open') throw new HandoffStateError('HANDOFF_SESSION_CLOSED', 'session is closed');
}

function readState(sessionId, dataRoot) {
  const target = paths(sessionId, dataRoot);
  return readJson(target.state, { sessionId, handoffs: [] });
}

function withState(input, options, mutate) {
  const { dataRoot, lockTimeoutMs = 2000 } = options;
  const target = paths(input.sessionId, dataRoot);
  assertOpenSession(input.sessionId, dataRoot);
  try {
    return withFileLock(target.lock, lockTimeoutMs, 'HANDOFF_LOCK_TIMEOUT', () => {
      const state = readState(input.sessionId, dataRoot);
      const result = mutate(state);
      atomicWriteJson(target.state, state);
      return result;
    });
  } catch (error) {
    if (error instanceof HandoffStateError) throw error;
    throw new HandoffStateError(error.code || 'HANDOFF_STATE_FAILED', error.message);
  }
}

export function openHandoff(input, { dataRoot, lockTimeoutMs = 2000, now = () => new Date() } = {}) {
  validateId(input?.handoffId);
  return withState(input, { dataRoot, lockTimeoutMs }, (state) => {
    const active = state.handoffs.find((handoff) => handoff.status === 'active');
    if (active) {
      if (active.handoffId === input.handoffId) return active;
      throw new HandoffStateError('HANDOFF_ACTIVE', `handoff ${active.handoffId} is already active`);
    }
    const generation = Math.max(0, ...state.handoffs
      .filter((handoff) => handoff.handoffId === input.handoffId)
      .map((handoff) => handoff.generation)) + 1;
    const timestamp = now().toISOString();
    const handoff = {
      sessionId: input.sessionId,
      handoffId: input.handoffId,
      generation,
      status: 'active',
      from: input.from ?? null,
      to: input.to ?? null,
      summary: input.summary ?? null,
      reason: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.handoffs.push(handoff);
    return handoff;
  });
}

function transitionHandoff(input, status, { dataRoot, lockTimeoutMs = 2000, now = () => new Date() } = {}) {
  validateId(input?.handoffId);
  validateGeneration(input?.generation);
  if (status === 'abandoned' && (typeof input.reason !== 'string' || !input.reason.trim())) {
    throw new HandoffStateError('HANDOFF_REASON_REQUIRED', 'abandon requires a reason');
  }
  return withState(input, { dataRoot, lockTimeoutMs }, (state) => {
    const handoff = state.handoffs.find((candidate) => (
      candidate.handoffId === input.handoffId && candidate.generation === input.generation
    ));
    if (!handoff) throw new HandoffStateError('HANDOFF_NOT_FOUND', 'handoff generation does not exist');
    if (handoff.status !== 'active') {
      if (handoff.status === status) return handoff;
      throw new HandoffStateError('HANDOFF_TRANSITION_INVALID', `${handoff.status} cannot become ${status}`);
    }
    handoff.status = status;
    handoff.reason = status === 'abandoned' ? input.reason.trim() : null;
    handoff.updatedAt = now().toISOString();
    return handoff;
  });
}

export function completeHandoff(input, options) {
  return transitionHandoff(input, 'completed', options);
}

export function abandonHandoff(input, options) {
  return transitionHandoff(input, 'abandoned', options);
}

export function handoffStatus(input, { dataRoot } = {}) {
  validateId(input?.handoffId ?? 'all');
  assertOpenSession(input.sessionId, dataRoot);
  const state = readState(input.sessionId, dataRoot);
  return {
    sessionId: input.sessionId,
    handoffs: input.handoffId
      ? state.handoffs.filter((handoff) => handoff.handoffId === input.handoffId)
      : state.handoffs,
  };
}

function cli() {
  const [command, raw] = process.argv.slice(2);
  const input = JSON.parse(raw || '{}');
  const result = command === 'open' ? openHandoff(input)
    : command === 'complete' ? completeHandoff(input)
      : command === 'abandon' ? abandonHandoff(input)
        : command === 'status' ? handoffStatus(input)
          : (() => { throw new HandoffStateError('HANDOFF_COMMAND_INVALID', 'unknown command'); })();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { cli(); } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'HANDOFF_STATE_FAILED', message: error.message })}\n`);
    process.exitCode = 2;
  }
}

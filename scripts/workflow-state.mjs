#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSession, withSessionLock } from './session-state.mjs';
import {
  atomicWriteJson, readJson, sessionDirectory, withFileLock,
} from './lib/session-store.mjs';
import { sanitizeWorkflowResult, validateTaskGraph } from './lib/workflow-provider.mjs';

export class WorkflowStateError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

const EXECUTION_STATUSES = new Set(['pending', 'running', 'completed', 'partial', 'failed', 'cancelled']);
const TASK_STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'skipped', 'cancelled']);
const TERMINAL_EXECUTION = new Set(['completed', 'partial', 'failed', 'cancelled']);

function validateTasks(tasks, expectedIds) {
  if (!Array.isArray(tasks)) throw new WorkflowStateError('EXECUTION_TASKS_INVALID', 'tasks must be an array');
  const ids = tasks.map((task) => task?.id);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length
    || tasks.some((task) => !TASK_STATUSES.has(task.status || 'pending'))) {
    throw new WorkflowStateError('EXECUTION_TASKS_INVALID', 'task ids and statuses must be valid');
  }
  if (expectedIds && (ids.length !== expectedIds.length
    || ids.some((id, index) => id !== expectedIds[index]))) {
    throw new WorkflowStateError('EXECUTION_TASK_ORDER_INVALID', 'task identity and ordering are immutable');
  }
}

function fileFor(dataRoot, sessionId, executionId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(executionId || '')) {
    throw new WorkflowStateError('EXECUTION_ID_INVALID', 'invalid execution id');
  }
  return path.join(sessionDirectory(dataRoot, sessionId), 'workflow', `${executionId}.json`);
}

function publicTask(task) {
  return {
    id: task.id, status: task.status, resultRef: task.resultRef ?? null,
    result: sanitizeWorkflowResult(task.result),
    error: task.error ? {
      code: typeof task.error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(task.error.code)
        ? task.error.code : 'TASK_FAILED',
    } : null,
    reviewMode: task.reviewMode ?? null,
  };
}

function validatePlanItems(items, expectedIds) {
  if (!Array.isArray(items) || items.some((item) =>
    typeof item?.id !== 'string' || !item.id
      || typeof item.subject !== 'string' || !item.subject
      || (item.description != null && typeof item.description !== 'string')
      || !['pending', 'in_progress', 'completed'].includes(item.status)
      || (item.handoff != null && typeof item.handoff !== 'string'))) {
    throw new WorkflowStateError('PLAN_ITEMS_INVALID', 'plan items are invalid');
  }
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new WorkflowStateError('PLAN_ITEMS_INVALID', 'plan item ids must be unique');
  }
  if (expectedIds && (ids.length !== expectedIds.length
    || ids.some((id, index) => id !== expectedIds[index]))) {
    throw new WorkflowStateError('PLAN_ITEM_ORDER_INVALID', 'plan item identity and ordering are immutable');
  }
}

function planFileFor(dataRoot, sessionId, planRef) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(planRef || '')) {
    throw new WorkflowStateError('PLAN_REF_INVALID', 'invalid planRef');
  }
  return path.join(sessionDirectory(dataRoot, sessionId), 'plans', `${planRef}.json`);
}

function publicPlan(state) {
  return {
    planRef: state.planRef, provider: state.provider,
    items: state.items.map(({ id, subject, description, status, handoff }) => ({
      id, subject, status, ...(description != null ? { description } : {}),
      ...(handoff != null ? { handoff } : {}),
    })),
    createdAt: state.createdAt, updatedAt: state.updatedAt,
  };
}

function readPlanState(input, { dataRoot } = {}) {
  const state = readJson(planFileFor(dataRoot, input.sessionId, input.planRef), null);
  if (!state) throw new WorkflowStateError('PLAN_NOT_FOUND', 'plan does not exist in this session');
  if (input.provider && state.provider !== input.provider) {
    throw new WorkflowStateError('PLAN_PROVIDER_MISMATCH', 'plan belongs to another provider');
  }
  return state;
}

export function readPlanPrivate(input, { dataRoot } = {}) {
  return readPlanState(input, { dataRoot });
}

export function createPlan(input, {
  dataRoot, planRef = randomUUID(), lockTimeoutMs = 2000, now = () => new Date().toISOString(),
} = {}) {
  if (typeof input?.provider !== 'string' || !input.provider) {
    throw new WorkflowStateError('PLAN_INPUT_INVALID', 'provider is required');
  }
  validatePlanItems(input.items);
  return withSessionLock(input.sessionId, { dataRoot, lockTimeoutMs }, () => {
    const session = readSession(input.sessionId, { dataRoot });
    if (session.status !== 'open') throw new WorkflowStateError('SESSION_CLOSED', 'plan requires an open session');
    const file = planFileFor(dataRoot, input.sessionId, planRef);
    if (existsSync(file)) throw new WorkflowStateError('PLAN_EXISTS', 'plan already exists');
    const timestamp = now();
    const state = {
      planRef, sessionId: input.sessionId, provider: input.provider,
      providerHandle: input.providerHandle || {}, items: input.items,
      createdAt: timestamp, updatedAt: timestamp,
    };
    atomicWriteJson(file, state);
    return publicPlan(state);
  });
}

export function readPlan(input, { dataRoot } = {}) {
  return publicPlan(readPlanState(input, { dataRoot }));
}

export function updatePlan(input, {
  dataRoot, lockTimeoutMs = 2000, now = () => new Date().toISOString(),
} = {}) {
  const file = planFileFor(dataRoot, input.sessionId, input.planRef);
  return withSessionLock(input.sessionId, { dataRoot, lockTimeoutMs }, () =>
    withFileLock(`${file}.lock`, lockTimeoutMs, 'PLAN_LOCK_TIMEOUT', () => {
      const session = readSession(input.sessionId, { dataRoot });
      if (session.status !== 'open') throw new WorkflowStateError('SESSION_CLOSED', 'plan update requires an open session');
      const current = readPlanState(input, { dataRoot });
      validatePlanItems(input.items, current.items.map((item) => item.id));
      const state = { ...current, items: input.items, updatedAt: now() };
      atomicWriteJson(file, state);
      return publicPlan(state);
    }));
}

export function publicExecution(state) {
  return {
    sessionId: state.sessionId,
    provider: state.provider,
    executionId: state.executionId,
    status: state.status,
    tasks: state.tasks.map(publicTask),
    degraded: state.degraded === true,
    degradedFrom: state.degradedFrom || null,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

export function createExecution(input, {
  dataRoot, lockTimeoutMs = 2000, now = () => new Date().toISOString(),
} = {}) {
  if (typeof input?.provider !== 'string' || !input.provider
    || !EXECUTION_STATUSES.has(input.status || 'pending')) {
    throw new WorkflowStateError('EXECUTION_INPUT_INVALID', 'provider and status must be valid');
  }
  validateTasks(input.tasks || []);
  try {
    validateTaskGraph(input.graph);
  } catch (error) {
    throw new WorkflowStateError('EXECUTION_GRAPH_INVALID', error.message);
  }
  const graphIds = input.graph.tasks.map((task) => task.id);
  const taskIds = (input.tasks || []).map((task) => task.id);
  if (graphIds.length !== taskIds.length || graphIds.some((id, index) => id !== taskIds[index])) {
    throw new WorkflowStateError('EXECUTION_GRAPH_TASK_MISMATCH', 'graph and task state identity must match');
  }
  return withSessionLock(input.sessionId, { dataRoot, lockTimeoutMs }, () => {
    const session = readSession(input.sessionId, { dataRoot });
    if (session.status !== 'open') throw new WorkflowStateError('SESSION_CLOSED', 'execution requires an open session');
    const executionId = input.executionId || randomUUID();
    const file = fileFor(dataRoot, input.sessionId, executionId);
    if (existsSync(file)) throw new WorkflowStateError('EXECUTION_EXISTS', 'execution already exists');
    const timestamp = now();
    const state = {
      executionId, sessionId: input.sessionId, provider: input.provider,
      status: input.status || 'pending', providerHandle: input.providerHandle || {},
      graph: structuredClone(input.graph),
      cancelReason: input.cancelReason ?? null,
      tasks: (input.tasks || []).map((task) => ({
        ...task, status: task.status || 'pending', resultRef: task.resultRef ?? null,
        result: sanitizeWorkflowResult(task.result),
        error: task.error ?? null, reviewMode: task.reviewMode ?? null,
      })),
      createdAt: timestamp, updatedAt: timestamp,
    };
    atomicWriteJson(file, state);
    return state;
  });
}

export function readExecutionPrivate(input, { dataRoot } = {}) {
  const state = readJson(fileFor(dataRoot, input.sessionId, input.executionId), null);
  if (!state) throw new WorkflowStateError('EXECUTION_NOT_FOUND', 'execution does not exist in this session');
  if (input.provider && state.provider !== input.provider) {
    throw new WorkflowStateError('EXECUTION_PROVIDER_MISMATCH', 'execution belongs to another provider');
  }
  return state;
}

export function readExecution(input, options = {}) {
  return publicExecution(readExecutionPrivate(input, options));
}

export function updateExecution(input, {
  dataRoot, lockTimeoutMs = 2000, now = () => new Date().toISOString(),
} = {}) {
  if (typeof input?.provider !== 'string' || !input.provider) {
    throw new WorkflowStateError('EXECUTION_PROVIDER_REQUIRED', 'execution update requires its provider owner');
  }
  const file = fileFor(dataRoot, input.sessionId, input.executionId);
  const lock = `${file}.lock`;
  const patch = input?.patch;
  const allowedPatch = new Set(['status', 'tasks', 'providerHandle', 'cancelReason']);
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)
    || Object.keys(patch).some((key) => !allowedPatch.has(key))
    || (patch.status != null && !EXECUTION_STATUSES.has(patch.status))
    || (patch.cancelReason != null
      && (typeof patch.cancelReason !== 'string' || !patch.cancelReason.trim()))
    || (patch.providerHandle != null
      && (typeof patch.providerHandle !== 'object' || Array.isArray(patch.providerHandle)))) {
    throw new WorkflowStateError('EXECUTION_PATCH_INVALID', 'execution patch contains invalid fields');
  }
  try {
    return withSessionLock(input.sessionId, { dataRoot, lockTimeoutMs }, () =>
      withFileLock(lock, lockTimeoutMs, 'EXECUTION_LOCK_TIMEOUT', () => {
        const session = readSession(input.sessionId, { dataRoot });
        if (session.status !== 'open') throw new WorkflowStateError('SESSION_CLOSED', 'execution update requires an open session');
        const current = readExecutionPrivate(input, { dataRoot });
        if (TERMINAL_EXECUTION.has(current.status) && patch.status && patch.status !== current.status) {
          throw new WorkflowStateError('EXECUTION_TRANSITION_INVALID', 'terminal execution status is immutable');
        }
        if (patch.tasks) validateTasks(patch.tasks, current.tasks.map((task) => task.id));
        const normalizedPatch = patch.tasks ? {
          ...patch,
          tasks: patch.tasks.map((task) => ({
            ...task, result: sanitizeWorkflowResult(task.result),
          })),
        } : patch;
        const next = { ...current, ...normalizedPatch, updatedAt: now() };
        next.executionId = current.executionId;
        next.sessionId = current.sessionId;
        next.provider = current.provider;
        next.providerHandle = patch.providerHandle ?? current.providerHandle;
        atomicWriteJson(file, next);
        return next;
      }));
  } catch (error) {
    if (error instanceof WorkflowStateError) throw error;
    throw new WorkflowStateError(error.code || 'EXECUTION_UPDATE_FAILED', error.message);
  }
}

export function cleanupExecutions({ sessionId, retentionMs = 0 }, {
  dataRoot, nowMs = () => Date.now(),
} = {}) {
  if (!Number.isInteger(retentionMs) || retentionMs < 0) {
    throw new WorkflowStateError('EXECUTION_RETENTION_INVALID', 'retentionMs must be a non-negative integer');
  }
  return withSessionLock(sessionId, { dataRoot }, () => {
    const directory = path.join(sessionDirectory(dataRoot, sessionId), 'workflow');
    const receipt = { removed: [], retained: [] };
    if (!existsSync(directory)) return receipt;
    for (const name of readdirSync(directory).filter((item) => item.endsWith('.json')).sort()) {
      const file = path.join(directory, name);
      const state = readJson(file, null);
      const terminal = TERMINAL_EXECUTION.has(state?.status);
      const age = nowMs() - Date.parse(state?.updatedAt || 0);
      if (terminal && age >= retentionMs) {
        rmSync(file, { force: true });
        receipt.removed.push(state.executionId);
      } else receipt.retained.push(state.executionId);
    }
    return receipt;
  });
}

import assert from 'node:assert/strict';
import { closeSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { openSession } from '../scripts/session-state.mjs';
import {
  cleanupExecutions, createExecution, createPlan, publicExecution, readExecution,
  readExecutionPrivate, readPlan, readPlanPrivate, updateExecution, updatePlan,
} from '../scripts/workflow-state.mjs';

function fixture(t) {
  const dataRoot = mkdtempSync(path.join(os.tmpdir(), 'nocode-workflow-state-'));
  t.after(() => rmSync(dataRoot, { recursive: true, force: true }));
  openSession({ sessionId: 's1', workspace: '/w' }, { dataRoot });
  openSession({ sessionId: 's2', workspace: '/w' }, { dataRoot });
  return dataRoot;
}

function executionGraph(ids = []) {
  return {
    tasks: ids.map((id) => ({ id, objective: id, profile: 'g', dependsOn: [], writeScope: '' })),
    maxParallel: 1, fallbackPolicy: 'inline',
  };
}

test('execution registry hides handles and rejects wrong provider/session', (t) => {
  const dataRoot = fixture(t);
  const state = createExecution({
    sessionId: 's1', executionId: 'e1', provider: 'codex-agents',
    graph: executionGraph(['b', 'a']),
    providerHandle: { agentIds: ['private'] }, tasks: [{ id: 'b' }, { id: 'a' }], status: 'running',
  }, { dataRoot, now: () => '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(state.tasks.map((task) => task.id), ['b', 'a']);
  assert.equal('providerHandle' in publicExecution(state), false);
  assert.throws(() => readExecution({ sessionId: 's2', executionId: 'e1' }, { dataRoot }),
    (error) => error.code === 'EXECUTION_NOT_FOUND');
  assert.throws(() => readExecution({
    sessionId: 's1', executionId: 'e1', provider: 'claude-native',
  }, { dataRoot }), (error) => error.code === 'EXECUTION_PROVIDER_MISMATCH');
});

test('public receipts sanitize provider errors and never expose private diagnostics', (t) => {
  const dataRoot = fixture(t);
  const state = createExecution({
    sessionId: 's1', executionId: 'unsafe', provider: 'codex-agents', status: 'failed',
    graph: executionGraph(['review']),
    tasks: [{ id: 'review', status: 'failed', result: {
      verdict: 'changes-requested', token: 'private-token', nested: { stack: 'private-stack', safe: 'evidence' },
    }, error: {
      code: 'REMOTE_FAILURE', message: 'contains secret', agentId: 'private', stack: 'private stack',
    } }],
  }, { dataRoot });
  const receipt = publicExecution(state);
  assert.deepEqual(receipt.tasks[0].error, { code: 'REMOTE_FAILURE' });
  assert.deepEqual(receipt.tasks[0].result, {
    verdict: 'changes-requested', nested: { safe: 'evidence' },
  });
  assert.equal('providerHandle' in readExecution({ sessionId: 's1', executionId: 'unsafe' }, { dataRoot }), false);
  assert.equal('graph' in readExecution({ sessionId: 's1', executionId: 'unsafe' }, { dataRoot }), false);
});

test('plan registry binds updates to a stable session-scoped planRef', (t) => {
  const dataRoot = fixture(t);
  const created = createPlan({
    sessionId: 's1', provider: 'claude-control',
    items: [{ id: 'one', subject: 'Review', status: 'pending', handoff: 'review' }],
    providerHandle: { nativeTaskIds: { one: 'private-task-id' } },
  }, { dataRoot, planRef: 'plan-one' });
  assert.equal(created.planRef, 'plan-one');
  assert.equal('providerHandle' in created, false);
  assert.deepEqual(readPlanPrivate({ sessionId: 's1', planRef: 'plan-one' }, { dataRoot }).providerHandle,
    { nativeTaskIds: { one: 'private-task-id' } });
  createPlan({
    sessionId: 's1', provider: 'claude-control', items: [],
  }, { dataRoot, planRef: 'plan-two' });
  const updated = updatePlan({
    sessionId: 's1', planRef: 'plan-one',
    items: [{ id: 'one', subject: 'Review', status: 'completed', handoff: 'review' }],
  }, { dataRoot });
  assert.equal(updated.items[0].status, 'completed');
  assert.equal(readPlan({ sessionId: 's1', planRef: 'plan-two' }, { dataRoot }).items.length, 0);
  assert.throws(() => updatePlan({ sessionId: 's2', planRef: 'plan-one', items: [] }, { dataRoot }),
    (error) => error.code === 'PLAN_NOT_FOUND');
});

test('provider-private execution recovery retains DAG and opaque handles', (t) => {
  const dataRoot = fixture(t);
  createExecution({
    sessionId: 's1', executionId: 'recover', provider: 'codex-agents', status: 'running',
    graph: executionGraph(['a']),
    providerHandle: { agentIds: { a: 'private-agent' } }, tasks: [{ id: 'a', status: 'running' }],
  }, { dataRoot });
  const state = readExecutionPrivate({ sessionId: 's1', executionId: 'recover' }, { dataRoot });
  assert.equal(state.providerHandle.agentIds.a, 'private-agent');
  assert.equal(state.graph.tasks[0].id, 'a');
  assert.equal('providerHandle' in publicExecution(state), false);
  assert.equal('graph' in publicExecution(state), false);
});

test('execution creation requires a valid graph matching public task order', (t) => {
  const dataRoot = fixture(t);
  const task = { id: 'a', objective: 'A', profile: 'g', dependsOn: [], writeScope: '' };
  assert.throws(() => createExecution({
    sessionId: 's1', provider: 'codex-agents', tasks: [{ id: 'a' }], status: 'running',
  }, { dataRoot }), (error) => error.code === 'EXECUTION_GRAPH_INVALID');
  assert.throws(() => createExecution({
    sessionId: 's1', provider: 'codex-agents', graph: { unexpected: true },
    tasks: [{ id: 'a' }], status: 'running',
  }, { dataRoot }), (error) => error.code === 'EXECUTION_GRAPH_INVALID');
  assert.throws(() => createExecution({
    sessionId: 's1', provider: 'codex-agents',
    graph: { tasks: [{ ...task, id: 'b' }], maxParallel: 1, fallbackPolicy: 'inline' },
    tasks: [{ id: 'a' }], status: 'running',
  }, { dataRoot }), (error) => error.code === 'EXECUTION_GRAPH_TASK_MISMATCH');
});

test('execution update locks fail closed and cleanup preserves running state', (t) => {
  const dataRoot = fixture(t);
  createExecution({ sessionId: 's1', executionId: 'run', provider: 'inline', graph: executionGraph(), tasks: [], status: 'running' }, {
    dataRoot, now: () => '2020-01-01T00:00:00.000Z',
  });
  createExecution({ sessionId: 's1', executionId: 'done', provider: 'inline', graph: executionGraph(), tasks: [], status: 'completed' }, {
    dataRoot, now: () => '2020-01-01T00:00:00.000Z',
  });
  const lock = path.join(dataRoot, 'sessions/s1/workflow/run.json.lock');
  const fd = openSync(lock, 'wx');
  try {
    assert.throws(() => updateExecution({
      sessionId: 's1', executionId: 'run', provider: 'inline', patch: { status: 'completed' },
    }, { dataRoot, lockTimeoutMs: 5 }), (error) => error.code === 'EXECUTION_LOCK_TIMEOUT');
  } finally { closeSync(fd); }
  assert.deepEqual(cleanupExecutions({ sessionId: 's1', retentionMs: 0 }, { dataRoot }), {
    removed: ['done'], retained: ['run'],
  });
});

test('execution patches preserve identity, task ordering and terminal state', (t) => {
  const dataRoot = fixture(t);
  createExecution({
    sessionId: 's1', executionId: 'stable', provider: 'inline', status: 'running',
    graph: executionGraph(['a', 'b']),
    tasks: [{ id: 'a' }, { id: 'b' }], providerHandle: { secret: true },
  }, { dataRoot });
  assert.throws(() => updateExecution({
    sessionId: 's1', executionId: 'stable', provider: 'inline', patch: { provider: 'other' },
  }, { dataRoot }), (error) => error.code === 'EXECUTION_PATCH_INVALID');
  assert.throws(() => updateExecution({
    sessionId: 's1', executionId: 'stable', patch: { status: 'cancelled' },
  }, { dataRoot }), (error) => error.code === 'EXECUTION_PROVIDER_REQUIRED');
  assert.throws(() => updateExecution({
    sessionId: 's1', executionId: 'stable', provider: 'codex-agents', patch: { status: 'cancelled' },
  }, { dataRoot }), (error) => error.code === 'EXECUTION_PROVIDER_MISMATCH');
  assert.throws(() => updateExecution({
    sessionId: 's1', executionId: 'stable', provider: 'inline', patch: {
      tasks: [{ id: 'b', status: 'completed' }, { id: 'a', status: 'completed' }],
    },
  }, { dataRoot }), (error) => error.code === 'EXECUTION_TASK_ORDER_INVALID');
  updateExecution({
    sessionId: 's1', executionId: 'stable', provider: 'inline', patch: {
      status: 'completed', cancelReason: 'superseded by newer execution',
    },
  }, { dataRoot });
  assert.equal(readExecutionPrivate({ sessionId: 's1', executionId: 'stable' }, { dataRoot }).cancelReason,
    'superseded by newer execution');
  assert.throws(() => updateExecution({
    sessionId: 's1', executionId: 'stable', provider: 'inline', patch: { status: 'running' },
  }, { dataRoot }), (error) => error.code === 'EXECUTION_TRANSITION_INVALID');
  assert.throws(() => cleanupExecutions({ sessionId: 's1', retentionMs: -1 }, { dataRoot }),
    (error) => error.code === 'EXECUTION_RETENTION_INVALID');
});

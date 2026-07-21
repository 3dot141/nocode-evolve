import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelExecution, collectExecution, executeTaskGraph, followupExecution,
  planTaskWaves, waitExecution,
} from '../scripts/lib/workflow-provider.mjs';

function graph(overrides = {}) {
  return {
    tasks: [
      { id: 'a', objective: 'A', profile: 'general', dependsOn: [], writeScope: 'src/a' },
      { id: 'b', objective: 'B', profile: 'general', dependsOn: [], writeScope: 'src/b' },
      { id: 'c', objective: 'C', profile: 'general', dependsOn: ['a'], writeScope: 'src/a/file' },
    ],
    maxParallel: 2, fallbackPolicy: 'inline', ...overrides,
  };
}

test('workflow scheduling honors dependencies, maxParallel and overlapping write scopes', () => {
  assert.deepEqual(planTaskWaves(graph()).map((wave) => wave.map((task) => task.id)), [['a', 'b'], ['c']]);
  const overlap = graph({ tasks: [
    { id: 'a', objective: 'A', profile: 'g', dependsOn: [], writeScope: 'src' },
    { id: 'b', objective: 'B', profile: 'g', dependsOn: [], writeScope: 'src/b' },
  ] });
  assert.deepEqual(planTaskWaves(overlap).map((wave) => wave.map((task) => task.id)), [['a'], ['b']]);
  const readOnly = graph({ tasks: [
    { id: 'a', objective: 'A', profile: 'g', dependsOn: [], writeScope: 'none' },
    { id: 'b', objective: 'B', profile: 'g', dependsOn: [], writeScope: 'none' },
  ] });
  assert.deepEqual(planTaskWaves(readOnly).map((wave) => wave.map((task) => task.id)), [['a', 'b']]);
  assert.throws(() => executeTaskGraph('agents-primary', graph({ tasks: [
    { id: 'a', objective: 'A', profile: 'g', dependsOn: ['b'], writeScope: '' },
    { id: 'b', objective: 'B', profile: 'g', dependsOn: ['a'], writeScope: '' },
  ] })), (error) => error.code === 'WORKFLOW_DEPENDENCY_CYCLE');
});

test('native and inline providers return the same public receipt semantics', () => {
  for (const provider of ['native-primary', 'agents-primary', 'inline']) {
    const receipt = executeTaskGraph(provider, graph(), {
      executionId: 'e', degradedFrom: provider === 'inline' ? 'agents-primary' : null,
      runTask: (task) => task.id === 'a'
        ? { status: 'failed', error: { code: 'TIMEOUT' } }
        : { status: 'completed', resultRef: `result/${task.id}`, result: { summary: `done-${task.id}` } },
    });
    assert.equal(receipt.executionId, 'e');
    assert.equal(receipt.status, 'partial');
    assert.equal(receipt.tasks.find((task) => task.id === 'c').status, 'skipped');
    assert.deepEqual(receipt.tasks.find((task) => task.id === 'b').result, { summary: 'done-b' });
  }
  assert.throws(() => executeTaskGraph('agents-primary', graph({ fallbackPolicy: 'none' }), { available: false }),
    (error) => error.code === 'WORKFLOW_PROVIDER_UNAVAILABLE');
});

test('collect exposes sanitized task results that can feed a later execution objective', () => {
  const firstGraph = graph({ tasks: [{
    id: 'search', objective: 'Search', profile: 'research.web', dependsOn: [], writeScope: '',
  }], maxParallel: 1 });
  const first = executeTaskGraph('agents-primary', firstGraph, {
    executionId: 'first',
    runTask: () => ({
      status: 'completed', resultRef: 'result/search',
      result: {
        findings: [{ claim: 'A', source: 'https://example.test' }],
        token: 'must-not-leak',
        accessToken: 'access-token', refresh_token: 'refresh-token', clientSecret: 'client-secret',
        credentials: 'credentials', stackTrace: 'stack-trace', provider_handle: 'provider-handle',
        agent_id: 'agent-id', authorizationHeader: 'authorization', cookieValue: 'cookie',
        nested: { stack: 'private stack', safe: true, note: 'string values are not secret-scanned' },
      },
    }),
  });
  const collected = collectExecution(first);
  assert.deepEqual(collected.tasks[0].result, {
    findings: [{ claim: 'A', source: 'https://example.test' }],
    nested: { safe: true, note: 'string values are not secret-scanned' },
  });
  const evidence = JSON.stringify(collected.tasks[0].result);
  const nextGraph = graph({ tasks: [{
    id: 'synthesize', objective: `Synthesize collected evidence: ${evidence}`,
    profile: 'research.synthesize', dependsOn: [], writeScope: '',
  }], maxParallel: 1 });
  let receivedObjective;
  executeTaskGraph('agents-primary', nextGraph, {
    runTask: (task) => { receivedObjective = task.objective; return { status: 'completed', result: { ok: true } }; },
  });
  assert.match(receivedObjective, /https:\/\/example\.test/);
  assert.doesNotMatch(receivedObjective,
    /must-not-leak|private stack|access-token|refresh-token|client-secret|credentials|stack-trace|provider-handle|agent-id|authorization|cookie/);
});

test('async tasks stay running and keep downstream work pending', () => {
  const receipt = executeTaskGraph('agents-primary', graph(), {
    executionId: 'async',
    runTask: (task) => task.id === 'a'
      ? { status: 'running', resultRef: 'private-handle-not-here' }
      : { status: 'completed', resultRef: `result/${task.id}` },
  });
  assert.equal(receipt.status, 'running');
  assert.equal(receipt.tasks.find((task) => task.id === 'a').status, 'running');
  assert.equal(receipt.tasks.find((task) => task.id === 'c').status, 'pending');
});

test('wait advances newly-ready tasks after async dependencies finish', () => {
  const taskGraph = graph();
  const initial = executeTaskGraph('agents-primary', taskGraph, {
    executionId: 'resume',
    runTask: (task) => task.id === 'a'
      ? { status: 'running', resultRef: null }
      : { status: 'completed', resultRef: `result/${task.id}` },
  });
  const resumed = waitExecution(initial, {
    graph: taskGraph,
    pollTask: (task) => task.id === 'a'
      ? { status: 'completed', resultRef: 'result/a', result: { summary: 'a done' } }
      : null,
    runTask: (task) => ({ status: 'completed', resultRef: `result/${task.id}`, result: { summary: `${task.id} done` } }),
  });
  assert.equal(resumed.status, 'completed');
  assert.equal(resumed.tasks.find((task) => task.id === 'c').status, 'completed');
  assert.deepEqual(resumed.tasks.find((task) => task.id === 'a').result, { summary: 'a done' });
});

test('running tasks consume maxParallel slots and block overlapping write scopes', () => {
  const parallel = executeTaskGraph('agents-primary', graph({
    tasks: [
      { id: 'a', objective: 'A', profile: 'g', dependsOn: [], writeScope: 'src/a' },
      { id: 'b', objective: 'B', profile: 'g', dependsOn: [], writeScope: 'src/b' },
      { id: 'c', objective: 'C', profile: 'g', dependsOn: [], writeScope: 'src/c' },
    ],
  }), { runTask: () => ({ status: 'running' }) });
  assert.deepEqual(parallel.tasks.map((task) => task.status), ['running', 'running', 'pending']);

  const overlap = executeTaskGraph('agents-primary', graph({
    tasks: [
      { id: 'a', objective: 'A', profile: 'g', dependsOn: [], writeScope: 'src' },
      { id: 'b', objective: 'B', profile: 'g', dependsOn: [], writeScope: 'src/b' },
    ],
  }), { runTask: () => ({ status: 'running' }) });
  assert.deepEqual(overlap.tasks.map((task) => task.status), ['running', 'pending']);
});

test('review tasks report whether independence is cross-model or same-model isolated', () => {
  const reviewGraph = graph({ tasks: [{
    id: 'review', objective: 'Review independently', profile: 'review.cross-model-preferred',
    dependsOn: [], writeScope: '',
  }] });
  for (const reviewMode of ['cross-model', 'isolated-same-model', 'inline-self-review']) {
    const receipt = executeTaskGraph('review-provider', reviewGraph, {
      runTask: () => ({ status: 'completed', resultRef: 'review/report', reviewMode }),
    });
    assert.equal(receipt.tasks[0].reviewMode, reviewMode);
  }
});

test('wait, collect, followup and cancel preserve provider-neutral control semantics', () => {
  const receipt = executeTaskGraph('agents-primary', graph(), { executionId: 'e' });
  assert.equal(waitExecution({ ...receipt, status: 'running' }, { timedOut: true }).status, 'running');
  assert.throws(() => collectExecution({ ...receipt, status: 'running' }),
    (error) => error.code === 'WORKFLOW_NOT_COMPLETE');
  assert.throws(() => followupExecution(receipt, { taskId: 'a', instruction: 'retry' }, () => {}),
    (error) => error.code === 'WORKFLOW_TASK_NOT_RUNNING');
  const running = executeTaskGraph('agents-primary', graph(), {
    executionId: 'running', runTask: () => ({ status: 'running' }),
  });
  let followed;
  followupExecution(running, { taskId: 'a', instruction: 'retry' }, (...args) => { followed = args; });
  assert.deepEqual(followed, ['a', 'retry']);
  assert.throws(() => cancelExecution(receipt, { reason: 'superseded' }),
    (error) => error.code === 'WORKFLOW_CANCEL_UNAVAILABLE');
  let cancelled;
  assert.equal(cancelExecution(receipt, { reason: 'superseded' }, (...args) => { cancelled = args; }).status,
    'cancelled');
  assert.deepEqual(cancelled, ['e', 'superseded']);
});

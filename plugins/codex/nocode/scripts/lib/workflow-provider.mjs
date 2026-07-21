import { randomUUID } from 'node:crypto';

export class WorkflowProviderError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

function overlaps(left, right) {
  if (!left || !right || left === 'none' || right === 'none') return false;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function sanitizeWorkflowError(error) {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
    ? error.code : 'TASK_FAILED';
  return { code };
}

// Public receipts redact by key, not by scanning arbitrary string values. Normalize
// separators/casing first so common SDK variants cannot bypass the boundary.
const SENSITIVE_RESULT_KEY_FRAGMENT = /(?:token|secret|password|credential|authorization|cookie|apikey|stack|providerhandle|agentid)/;

function isSensitiveResultKey(key) {
  return SENSITIVE_RESULT_KEY_FRAGMENT.test(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

export function sanitizeWorkflowResult(value) {
  const seen = new WeakSet();
  const visit = (current, depth) => {
    if (current == null) return null;
    if (typeof current === 'string' || typeof current === 'boolean') return current;
    if (typeof current === 'number' && Number.isFinite(current)) return current;
    if (depth > 12 || typeof current !== 'object') {
      throw new WorkflowProviderError('WORKFLOW_RESULT_INVALID', 'task result is not safe JSON');
    }
    if (seen.has(current)) throw new WorkflowProviderError('WORKFLOW_RESULT_INVALID', 'task result is cyclic');
    seen.add(current);
    let output;
    if (Array.isArray(current)) {
      if (current.length > 1000) throw new WorkflowProviderError('WORKFLOW_RESULT_INVALID', 'task result is too large');
      output = current.map((item) => visit(item, depth + 1));
    } else {
      const entries = Object.entries(current);
      if (entries.length > 256) throw new WorkflowProviderError('WORKFLOW_RESULT_INVALID', 'task result is too large');
      output = {};
      for (const [key, item] of entries) {
        if (isSensitiveResultKey(key)) continue;
        output[key] = visit(item, depth + 1);
      }
    }
    seen.delete(current);
    return output;
  };
  const sanitized = visit(value ?? null, 0);
  if (Buffer.byteLength(JSON.stringify(sanitized), 'utf8') > 131072) {
    throw new WorkflowProviderError('WORKFLOW_RESULT_INVALID', 'task result exceeds the public receipt limit');
  }
  return sanitized;
}

export function validateTaskGraph(graph) {
  if (!graph || !Array.isArray(graph.tasks) || !Number.isInteger(graph.maxParallel)
    || graph.maxParallel < 1 || !['inline', 'none'].includes(graph.fallbackPolicy)) {
    throw new WorkflowProviderError('WORKFLOW_GRAPH_INVALID', 'invalid task graph');
  }
  const ids = new Set();
  for (const task of graph.tasks) {
    if (!task?.id || typeof task.id !== 'string' || ids.has(task.id)
      || typeof task.objective !== 'string' || !task.objective
      || typeof task.profile !== 'string' || !task.profile
      || !Array.isArray(task.dependsOn) || new Set(task.dependsOn).size !== task.dependsOn.length
      || typeof task.writeScope !== 'string'
      || (task.timeoutMs != null && (!Number.isInteger(task.timeoutMs) || task.timeoutMs < 1))
      || (task.continueOnError != null && typeof task.continueOnError !== 'boolean')) {
      throw new WorkflowProviderError('WORKFLOW_GRAPH_INVALID', 'invalid or duplicate task');
    }
    ids.add(task.id);
  }
  for (const task of graph.tasks) {
    if (task.dependsOn.some((id) => !ids.has(id))) {
      throw new WorkflowProviderError('WORKFLOW_DEPENDENCY_MISSING', task.id);
    }
  }
  return graph;
}

export function planTaskWaves(graph) {
  validateTaskGraph(graph);
  const pending = new Map(graph.tasks.map((task, index) => [task.id, { task, index }]));
  const completed = new Set();
  const waves = [];
  while (pending.size) {
    const ready = [...pending.values()].filter(({ task }) => task.dependsOn.every((id) => completed.has(id)));
    if (!ready.length) throw new WorkflowProviderError('WORKFLOW_DEPENDENCY_CYCLE', 'task graph contains a cycle');
    const wave = [];
    for (const item of ready.sort((a, b) => a.index - b.index)) {
      if (wave.length >= graph.maxParallel) break;
      if (wave.some(({ task }) => overlaps(task.writeScope, item.task.writeScope))) continue;
      wave.push(item);
    }
    if (!wave.length) wave.push(ready[0]);
    waves.push(wave.map(({ task }) => task));
    for (const { task } of wave) { pending.delete(task.id); completed.add(task.id); }
  }
  return waves;
}

export function executeTaskGraph(provider, graph, {
  available = true, runTask = () => ({ status: 'completed', resultRef: null }),
  executionId = randomUUID(), degradedFrom = null,
} = {}) {
  planTaskWaves(graph); // validates the graph and rejects dependency cycles before dispatch
  if (typeof provider !== 'string' || !provider) {
    throw new WorkflowProviderError('WORKFLOW_PROVIDER_UNAVAILABLE', 'provider is required');
  }
  if (!available) {
    throw new WorkflowProviderError(
      graph.fallbackPolicy === 'inline' ? 'WORKFLOW_PRIMARY_UNAVAILABLE' : 'WORKFLOW_PROVIDER_UNAVAILABLE',
      'primary provider is unavailable before commit',
    );
  }
  const results = new Map(graph.tasks.map((task) => [task.id, {
    id: task.id, status: 'pending', resultRef: null, result: null, error: null, reviewMode: null,
  }]));
  advanceTaskResults(provider, graph, results, runTask);
  return executionReceipt(provider, executionId, graph, results, degradedFrom);
}

function advanceTaskResults(provider, graph, results, runTask) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    const running = graph.tasks.filter((task) => results.get(task.id).status === 'running');
    let availableSlots = graph.maxParallel - running.length;
    if (availableSlots < 1) break;
    for (const task of graph.tasks) {
      if (availableSlots < 1) break;
      if (results.get(task.id).status !== 'pending') continue;
      const dependencyStates = task.dependsOn.map((id) => results.get(id).status);
      const dependencyActive = dependencyStates.some((status) => ['pending', 'running'].includes(status));
      if (dependencyActive) continue;
      const dependencyFailed = dependencyStates.some((status) => status !== 'completed');
      if (dependencyFailed && !task.continueOnError) {
        results.set(task.id, { id: task.id, status: 'skipped', resultRef: null, result: null,
          error: { code: 'DEPENDENCY_FAILED' }, reviewMode: null });
        progressed = true;
        continue;
      }
      const activeScopes = graph.tasks.filter((candidate) => results.get(candidate.id).status === 'running');
      if (activeScopes.some((candidate) => overlaps(candidate.writeScope, task.writeScope))) continue;
      try {
        const result = runTask(task, { provider, timeoutMs: task.timeoutMs });
        const status = ['failed', 'running', 'completed'].includes(result?.status)
          ? result.status : 'completed';
        results.set(task.id, {
          id: task.id,
          status,
          resultRef: result?.resultRef ?? null,
          result: status === 'completed' ? sanitizeWorkflowResult(result?.result) : null,
          error: status === 'failed' ? sanitizeWorkflowError(result.error) : null,
          reviewMode: result?.reviewMode ?? null,
        });
      } catch (error) {
        results.set(task.id, { id: task.id, status: 'failed', resultRef: null, result: null,
          error: sanitizeWorkflowError(error), reviewMode: null });
      }
      progressed = true;
      if (results.get(task.id).status === 'running') availableSlots -= 1;
    }
  }
}

function executionReceipt(provider, executionId, graph, results, degradedFrom = null) {
  const tasks = graph.tasks.map((task) => results.get(task.id));
  const failures = tasks.filter((task) => ['failed', 'skipped'].includes(task.status)).length;
  const active = tasks.some((task) => ['pending', 'running'].includes(task.status));
  const status = active ? 'running' : failures === 0 ? 'completed'
    : tasks.some((task) => task.status === 'completed') ? 'partial' : 'failed';
  return {
    provider, executionId, status, tasks,
    degraded: provider === 'inline' && degradedFrom != null,
    degradedFrom: provider === 'inline' ? degradedFrom : null,
  };
}

export function waitExecution(receipt, {
  timedOut = false, graph = null, pollTask = () => null, runTask = () => ({ status: 'completed' }),
} = {}) {
  if (timedOut || !graph) return timedOut ? { ...receipt, status: 'running' } : receipt;
  planTaskWaves(graph);
  const results = new Map(receipt.tasks.map((task) => [task.id, { ...task }]));
  for (const task of graph.tasks) {
    const current = results.get(task.id);
    if (current?.status !== 'running') continue;
    const update = pollTask(task, current);
    if (!update) continue;
    const status = ['running', 'completed', 'failed'].includes(update.status)
      ? update.status : current.status;
    results.set(task.id, {
      ...current,
      status,
      resultRef: update.resultRef ?? current.resultRef,
      result: status === 'completed'
        ? sanitizeWorkflowResult(Object.hasOwn(update, 'result') ? update.result : current.result)
        : null,
      error: status === 'failed' ? sanitizeWorkflowError(update.error) : null,
      reviewMode: update.reviewMode ?? current.reviewMode,
    });
  }
  advanceTaskResults(receipt.provider, graph, results, runTask);
  return executionReceipt(receipt.provider, receipt.executionId, graph, results,
    receipt.degraded ? receipt.degradedFrom : null);
}

export function collectExecution(receipt) {
  if (['pending', 'running'].includes(receipt.status)) {
    throw new WorkflowProviderError('WORKFLOW_NOT_COMPLETE', 'execution is not terminal');
  }
  return receipt;
}

export function followupExecution(receipt, input, send) {
  const task = receipt.tasks.find((candidate) => candidate.id === input.taskId);
  if (!task) {
    throw new WorkflowProviderError('WORKFLOW_TASK_NOT_FOUND', input.taskId);
  }
  if (task.status !== 'running') {
    throw new WorkflowProviderError('WORKFLOW_TASK_NOT_RUNNING', input.taskId);
  }
  send(input.taskId, input.instruction);
  return receipt;
}

export function cancelExecution(receipt, input, cancel) {
  if (typeof input?.reason !== 'string' || !input.reason.trim()) {
    throw new WorkflowProviderError('WORKFLOW_CANCEL_REASON_INVALID', 'cancel reason is required');
  }
  if (typeof cancel !== 'function') {
    throw new WorkflowProviderError('WORKFLOW_CANCEL_UNAVAILABLE', 'provider cannot cancel this execution');
  }
  cancel(receipt.executionId, input.reason);
  return { ...receipt, status: 'cancelled', tasks: receipt.tasks.map((task) =>
    ['pending', 'running'].includes(task.status) ? { ...task, status: 'cancelled' } : task) };
}

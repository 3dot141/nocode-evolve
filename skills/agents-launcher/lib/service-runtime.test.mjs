import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceRuntime } from './service-runtime.mjs';

const fullPlan = {
  selected: ['docker', 'agents', 'server', 'web'],
  startOrder: ['docker', 'agents', 'server', 'web'],
  stopOrder: ['web', 'server', 'agents', 'docker'],
  propagationEdges: [{ upstream: 'agents', downstream: 'web' }],
};

function fakeAdapters(trace, { failStart = null } = {}) {
  return Object.fromEntries(
    fullPlan.selected.map((serviceId) => [
      serviceId,
      {
        lifecycle: serviceId === 'docker' ? 'oneshot' : 'service',
        async start() {
          trace.push(`start:${serviceId}`);
          if (serviceId === failStart) throw new Error(`${serviceId} start failed`);
          return { handles: [] };
        },
        async stop() {
          trace.push(`stop:${serviceId}`);
        },
        async status() {
          trace.push(`status:${serviceId}`);
          return { healthy: true, identity: `${serviceId}-pid` };
        },
      },
    ]),
  );
}

test('full plan 逆序清理后按拓扑顺序启动并等待 readiness', async () => {
  const trace = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters: fakeAdapters(trace),
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
  });
  await runtime.startSelected();
  assert.deepEqual(trace, [
    'stop:web',
    'stop:server',
    'stop:agents',
    'stop:docker',
    'start:docker',
    'start:agents',
    'status:agents',
    'start:server',
    'status:server',
    'start:web',
    'status:web',
  ]);
  assert.equal(runtime.phase, 'running');
});

test('中途 start 失败只逆序清理本轮已启动项', async () => {
  const trace = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters: fakeAdapters(trace, { failStart: 'server' }),
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
  });
  await assert.rejects(() => runtime.startSelected(), /server start failed/);
  assert.deepEqual(trace.slice(trace.lastIndexOf('start:server')), [
    'start:server',
    'stop:agents',
    'stop:docker',
  ]);
  assert.equal(trace.includes('start:web'), false);
});

test('readiness 超时阻止后续 service 启动', async () => {
  const trace = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters: fakeAdapters(trace),
    waitHealthyFn: async (label) => {
      if (label === 'agents') throw new Error('[agents] 健康检查超时');
    },
  });
  await assert.rejects(() => runtime.startSelected(), /agents.*健康检查超时/);
  assert.equal(trace.includes('start:server'), false);
  assert.equal(trace.includes('start:web'), false);
  assert.deepEqual(trace.slice(trace.lastIndexOf('start:agents')), [
    'start:agents',
    'stop:agents',
    'stop:docker',
  ]);
});

test('spawn 提前退出 → 健康等待立即失败，不被外部实例代答（260901 web 撞端口教训）', async () => {
  const trace = [];
  const adapters = fakeAdapters(trace);
  adapters.web.start = async () => {
    trace.push('start:web');
    // 模拟 spawn 即败：handle 已带 exitCode（如 vite 撞端口 exit 1）
    return { handles: [{ exitCode: 1 }] };
  };
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters,
    waitHealthyFn: async (_label, check) => {
      await check();
    },
  });
  await assert.rejects(() => runtime.startSelected(), /web.*提前退出/);
  // 提前退出的判定发生在健康轮询 checkFn 内——web 从未进入一轮 status 探测
  assert.equal(trace.includes('status:web'), false);
});

test('同一个 child handle 只 SIGTERM 一次', async () => {
  const trace = [];
  const killed = [];
  const adapters = fakeAdapters(trace);
  adapters.agents.start = async () => {
    trace.push('start:agents');
    return {
      handles: [{
        kill: (signal) => killed.push(signal),
      }],
    };
  };
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters,
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
  });
  await runtime.startSelected();
  await runtime.stopSelected();
  await runtime.stopSelected();
  assert.deepEqual(killed, ['SIGTERM']);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function cascadeFixture({ failWebStart = false, upstreamHealthy = true } = {}) {
  const trace = [];
  let webStarts = 0;
  let agentsStatusCalls = 0;
  const adapters = fakeAdapters(trace);
  adapters.agents.status = async () => {
    agentsStatusCalls += 1;
    const healthy = agentsStatusCalls === 1 ? true : upstreamHealthy;
    return {
      healthy,
      identity: healthy ? (agentsStatusCalls === 1 ? 'A' : 'B') : null,
    };
  };
  adapters.web.start = async () => {
    webStarts += 1;
    trace.push('start:web');
    if (failWebStart && webStarts > 1) throw new Error('web restart failed');
    return { handles: [] };
  };
  const logs = [];
  const runtime = new ServiceRuntime({
    plan: fullPlan,
    adapters,
    waitHealthyFn: async (_label, check) => {
      assert.equal((await check()), true);
    },
    log: (event, data) => logs.push([event, data]),
  });
  return { runtime, trace, logs };
}

test('一个 generation event 对 web 恰好 stop/start 一次', async () => {
  const { runtime, trace, logs } = cascadeFixture();
  await runtime.startSelected();
  trace.length = 0;
  await runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  assert.deepEqual(trace, ['stop:web', 'start:web', 'status:web']);
  assert.equal(trace.includes('stop:agents'), false);
  assert.deepEqual(logs.find(([name]) => name === 'cascade.started')[1], {
    eventId: 'agents:g1',
    upstream: 'agents',
    generation: 1,
    targets: ['web'],
  });
  assert.equal(
    typeof logs.find(([name]) => name === 'cascade.completed')[1].durationMs,
    'number',
  );
});

test('同一 in-flight generation 返回同一 cascade promise', async () => {
  const { runtime, trace } = cascadeFixture();
  await runtime.startSelected();
  trace.length = 0;
  const event = {
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  };
  const first = runtime.requestCascade(event);
  const duplicate = runtime.requestCascade(event);
  assert.equal(first, duplicate);
  await first;
  assert.equal(trace.filter((entry) => entry === 'start:web').length, 1);
});

test('上游未恢复时不停止下游', async () => {
  const { runtime, trace } = cascadeFixture({ upstreamHealthy: false });
  await runtime.startSelected();
  trace.length = 0;
  await runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  assert.equal(trace.includes('stop:web'), false);
});

test('失败 generation 终态 settle，相同 generation 不重试', async () => {
  const { runtime, trace, logs } = cascadeFixture({ failWebStart: true });
  await runtime.startSelected();
  trace.length = 0;
  const event = {
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  };
  await runtime.requestCascade(event);
  await runtime.requestCascade(event);
  assert.equal(trace.filter((entry) => entry === 'stop:web').length, 1);
  assert.equal(logs.filter(([name]) => name === 'cascade.failed').length, 1);
  assert.deepEqual(logs.find(([name]) => name === 'cascade.failed')[1], {
    eventId: 'agents:g1',
    service: 'web',
    stage: 'start',
    error: 'web restart failed',
  });
  assert.equal(trace.includes('stop:agents'), false);
});

test('失败 generation 后更高 generation 可重新尝试', async () => {
  const { runtime, trace } = cascadeFixture();
  await runtime.startSelected();
  let cascadeStarts = 0;
  const originalStart = runtime.adapters.web.start;
  runtime.adapters.web.start = async (context) => {
    cascadeStarts += 1;
    if (cascadeStarts === 1) throw new Error('first cascade failed');
    return originalStart(context);
  };
  trace.length = 0;
  await runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  await runtime.requestCascade({
    id: 'agents:g2',
    serviceId: 'agents',
    generation: 2,
    identity: 'C',
  });
  assert.equal(cascadeStarts, 2);
  assert.equal(
    runtime.settledEventsByUpstream.get('agents').status,
    'completed',
  );
});

test('cascade 期间只串行消费最新 pending generation', async () => {
  const gate = deferred();
  const entered = deferred();
  const { runtime, trace } = cascadeFixture();
  await runtime.startSelected();
  let restartNumber = 0;
  const originalStart = runtime.adapters.web.start;
  runtime.adapters.web.start = async (context) => {
    restartNumber += 1;
    if (restartNumber === 1) {
      entered.resolve();
      await gate.promise;
    }
    return originalStart(context);
  };
  trace.length = 0;
  const g1 = runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  await entered.promise;
  const g2 = runtime.requestCascade({
    id: 'agents:g2',
    serviceId: 'agents',
    generation: 2,
    identity: 'C',
  });
  const g3 = runtime.requestCascade({
    id: 'agents:g3',
    serviceId: 'agents',
    generation: 3,
    identity: 'D',
  });
  gate.resolve();
  await Promise.all([g1, g2, g3]);
  assert.equal(trace.filter((entry) => entry === 'stop:web').length, 2);
  assert.equal(trace.filter((entry) => entry === 'start:web').length, 2);
  assert.equal(
    runtime.settledEventsByUpstream.get('agents').generation,
    3,
  );
});

test('drain settle 边界到达的更高 generation 不丢失', async () => {
  const { runtime, trace } = cascadeFixture();
  await runtime.startSelected();
  trace.length = 0;
  const g1 = runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  const boundary = runtime.operationTail.then(() => runtime.requestCascade({
    id: 'agents:g2',
    serviceId: 'agents',
    generation: 2,
    identity: 'C',
  }));
  await Promise.all([g1, boundary]);
  assert.equal(
    runtime.settledEventsByUpstream.get('agents').generation,
    2,
  );
  assert.equal(trace.filter((entry) => entry === 'stop:web').length, 2);
});

test('close 复用 single-flight 且 auxiliary 只整体停止一次', async () => {
  const gate = deferred();
  const entered = deferred();
  const { runtime } = cascadeFixture();
  await runtime.startSelected();
  const originalStart = runtime.adapters.web.start;
  runtime.adapters.web.start = async (context) => {
    entered.resolve();
    await gate.promise;
    return originalStart(context);
  };
  let auxiliaryStops = 0;
  runtime.registerAuxiliaryHandle({
    kill(signal) {
      assert.equal(signal, 'SIGTERM');
      auxiliaryStops += 1;
    },
  });
  const cascading = runtime.requestCascade({
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    identity: 'B',
  });
  await entered.promise;
  const first = runtime.close({ downDocker: false });
  const second = runtime.close({ downDocker: false });
  assert.equal(first, second);
  gate.resolve();
  await Promise.all([cascading, first]);
  assert.equal(auxiliaryStops, 1);
  assert.equal(runtime.phase, 'closed');
});

test('传播源 child 的 exit/close 只 nudge 一次 supervisor tick', async () => {
  const { runtime } = cascadeFixture();
  const callbacks = {};
  let ticks = 0;
  runtime.supervisor = { tick: async () => { ticks += 1; } };
  runtime.registerHandles('agents', [{
    once(event, callback) {
      callbacks[event] = callback;
    },
  }]);
  callbacks.exit();
  callbacks.close();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(ticks, 1);
});

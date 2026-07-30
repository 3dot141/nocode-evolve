import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGenerationSupervisor,
  createGenerationState,
  observeGeneration,
} from './supervisor.mjs';

const policy = {
  serviceId: 'agents',
  stableSuccesses: 2,
  failureThreshold: 2,
};
const healthy = (identity) => ({ healthy: true, identity });
const down = { healthy: false, identity: null };

function drive(observations) {
  let state = createGenerationState();
  const events = [];
  for (const observation of observations) {
    const transition = observeGeneration(state, observation, policy);
    state = transition.state;
    if (transition.event) events.push(transition.event);
  }
  return { state, events };
}

test('首次稳定 identity 只建立 generation 0 baseline', () => {
  const result = drive([healthy('A'), healthy('A')]);
  assert.equal(result.state.phase, 'healthy');
  assert.equal(result.state.stableIdentity, 'A');
  assert.equal(result.state.generation, 0);
  assert.deepEqual(result.events, []);
});

test('单次失败不降级，两次失败后同 identity 恢复不发事件', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    down,
    healthy('A'),
    down,
    down,
    healthy('A'),
    healthy('A'),
  ]);
  assert.equal(result.state.phase, 'healthy');
  assert.equal(result.state.stableIdentity, 'A');
  assert.equal(result.state.generation, 0);
  assert.deepEqual(result.events, []);
});

test('新 identity 连续稳定只发一次 generation event', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    down,
    down,
    healthy('B'),
    healthy('B'),
    healthy('B'),
  ]);
  assert.equal(result.state.stableIdentity, 'B');
  assert.equal(result.state.generation, 1);
  assert.deepEqual(result.events, [{
    id: 'agents:g1',
    serviceId: 'agents',
    generation: 1,
    previousIdentity: 'A',
    identity: 'B',
  }]);
});

test('快速替换不需要观察到 down', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    healthy('B'),
    healthy('B'),
  ]);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, 'agents:g1');
});

test('未稳定候选被更新 identity 覆盖', () => {
  const result = drive([
    healthy('A'),
    healthy('A'),
    healthy('B'),
    healthy('C'),
    healthy('C'),
  ]);
  assert.equal(result.state.stableIdentity, 'C');
  assert.equal(result.events[0].identity, 'C');
});

test('healthy 但没有 identity 时告警且不推进 generation', () => {
  const baseline = drive([healthy('A'), healthy('A')]).state;
  const transition = observeGeneration(
    baseline,
    { healthy: true, identity: null },
    policy,
  );
  assert.equal(transition.warning, 'identity_missing');
  assert.equal(transition.state.generation, 0);
  assert.equal(transition.event, null);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('seed 只建立传播源 baseline，不发 generation event', async () => {
  const observations = [
    { healthy: true, identity: 'A' },
    { healthy: true, identity: 'A' },
  ];
  const events = [];
  const logs = [];
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: { status: async () => observations.shift() },
      web: { status: async () => { throw new Error('web 不应被探测'); } },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 2,
      failure_threshold: 2,
    },
    onGenerationChanged: (event) => events.push(event),
    log: (event, payload) => logs.push([event, payload]),
    sleep: async () => {},
  });
  await supervisor.seed();
  assert.equal(supervisor.getState('agents').stableIdentity, 'A');
  assert.deepEqual(events, []);
  assert.equal(supervisor.getState('web'), null);
  assert.deepEqual(
    logs.find(([event]) => event === 'service.state_changed')[1],
    {
      serviceId: 'agents',
      previousState: 'unobserved',
      newState: 'healthy',
      identity: 'A',
      generation: 0,
    },
  );
});

test('100 个并发 tick 共享一个 probe batch', async () => {
  const gate = deferred();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: {
        status: async () => {
          calls += 1;
          active += 1;
          maxActive = Math.max(maxActive, active);
          await gate.promise;
          active -= 1;
          return { healthy: true, identity: 'A' };
        },
      },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 1,
      failure_threshold: 2,
    },
  });
  const ticks = Array.from({ length: 100 }, () => supervisor.tick());
  gate.resolve();
  await Promise.all(ticks);
  assert.equal(calls, 1);
  assert.equal(maxActive, 1);
});

test('generation callback 拒绝被记录且不阻塞后续 observation', async () => {
  const observations = [
    { healthy: true, identity: 'A' },
    { healthy: true, identity: 'B' },
    { healthy: true, identity: 'C' },
  ];
  const logs = [];
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: { status: async () => observations.shift() },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 1,
      failure_threshold: 2,
    },
    onGenerationChanged: () => {
      throw new Error('callback failed');
    },
    log: (event, payload) => logs.push([event, payload]),
  });
  await supervisor.tick();
  await supervisor.tick();
  await supervisor.tick();
  await Promise.resolve();
  assert.equal(supervisor.getState('agents').stableIdentity, 'C');
  assert.equal(supervisor.getState('agents').generation, 2);
  assert.equal(
    logs.filter(([event]) => event === 'cascade.callback_failed').length,
    2,
  );
});

test('acceptBaseline 静默同步主动重启后的 identity', async () => {
  const events = [];
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: { status: async () => ({ healthy: true, identity: 'B' }) },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 1,
      failure_threshold: 2,
    },
    onGenerationChanged: (event) => events.push(event),
  });
  supervisor.acceptBaseline('agents', { healthy: true, identity: 'B' });
  await supervisor.tick();
  assert.equal(supervisor.getState('agents').stableIdentity, 'B');
  assert.equal(supervisor.getState('agents').generation, 0);
  assert.deepEqual(events, []);
});

test('stop 清 timer 并等待未决 tick', async () => {
  const gate = deferred();
  const cleared = [];
  const supervisor = createGenerationSupervisor({
    serviceIds: ['agents'],
    adapters: {
      agents: {
        status: async () => {
          await gate.promise;
          return { healthy: true, identity: 'A' };
        },
      },
    },
    supervision: {
      interval_ms: 1000,
      stable_successes: 1,
      failure_threshold: 2,
    },
    setIntervalFn: () => 73,
    clearIntervalFn: (timer) => cleared.push(timer),
  });
  supervisor.start();
  const tick = supervisor.tick();
  const stopping = supervisor.stop();
  gate.resolve();
  await Promise.all([tick, stopping]);
  assert.deepEqual(cleared, [73]);
});

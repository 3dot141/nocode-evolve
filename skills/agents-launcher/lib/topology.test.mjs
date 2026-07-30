import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadLauncherConfig } from './launcher-config.mjs';
import {
  buildServicePlan,
  propagationClosure,
  validateTopology,
} from './topology.mjs';

const configPath = fileURLToPath(new URL('../agents-launcher.yml', import.meta.url));
const identityAdapterNames = ['agents', 'server', 'web'];
const { config } = loadLauncherConfig({
  path: configPath,
  adapterNames: ['docker', 'agents', 'server', 'web'],
  identityAdapterNames,
});

test('正式 YAML 保持三个 workspace 的服务集合与顺序', () => {
  const expected = {
    ui: ['agents', 'web'],
    agents: ['docker', 'agents', 'web'],
    full: ['docker', 'agents', 'server', 'web'],
  };
  for (const [workspace, startOrder] of Object.entries(expected)) {
    const plan = buildServicePlan(config, { workspace, disabled: [] });
    assert.deepEqual(plan.selected, startOrder);
    assert.deepEqual(plan.startOrder, startOrder);
    assert.deepEqual(plan.stopOrder, [...startOrder].reverse());
  }
});

test('optional dependency 缺席不扩张 launcher 所有权', () => {
  const plan = buildServicePlan(config, { workspace: 'ui', disabled: ['agents'] });
  assert.deepEqual(plan.selected, ['web']);
  assert.deepEqual(plan.startOrder, ['web']);
  assert.deepEqual(plan.omittedOptionalDependencies, [
    { service: 'web', dependency: 'agents' },
    { service: 'web', dependency: 'server' },
  ]);
  assert.deepEqual(plan.propagationEdges, []);
});

test('required dependency 缺席时 fail-loud', () => {
  const fixture = structuredClone(config);
  fixture.services.web.depends_on.agents.required = true;
  assert.throws(
    () => buildServicePlan(fixture, { workspace: 'ui', disabled: ['agents'] }),
    /\[topology\].*web.*required dependency.*agents/,
  );
});

test('引用、自依赖、condition 与环在完整 topology 校验时失败', async (t) => {
  const mutateCases = [
    ['unknown reference', (value) => { value.services.web.depends_on.ghost = value.services.web.depends_on.agents; }, /未知 service "ghost"/],
    ['self dependency', (value) => { value.services.web.depends_on.web = value.services.web.depends_on.agents; }, /不能依赖自身/],
    ['condition mismatch', (value) => { value.services.web.depends_on.agents.condition = 'service_completed_successfully'; }, /condition.*lifecycle/],
    ['cycle', (value) => { value.services.agents.depends_on.web = { condition: 'service_healthy', required: false, propagate_restart: false }; }, /dependency cycle/],
  ];
  for (const [name, mutate, pattern] of mutateCases) {
    await t.test(name, () => {
      const fixture = structuredClone(config);
      mutate(fixture);
      assert.throws(
        () => validateTopology(fixture, { identityAdapterNames }),
        pattern,
      );
    });
  }
});

test('传播闭包稳定去重并从 stop/start 全局顺序投影', () => {
  const fixture = structuredClone(config);
  fixture.workspaces.chain = ['agents', 'server', 'web'];
  fixture.services.server.depends_on.agents.propagate_restart = true;
  fixture.services.web.depends_on.server.propagate_restart = true;
  const plan = buildServicePlan(fixture, { workspace: 'chain', disabled: [] });
  assert.deepEqual([...propagationClosure('agents', plan)], ['server', 'web']);
  assert.deepEqual(
    plan.stopOrder.filter((id) => propagationClosure('agents', plan).has(id)),
    ['web', 'server'],
  );
});

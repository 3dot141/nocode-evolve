import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLauncherConfig } from './launcher-config.mjs';

const VALID = `
schema_version: 1
supervision:
  interval_ms: 1000
  stable_successes: 2
  failure_threshold: 2
workspaces:
  ui: [agents, web]
services:
  agents:
    adapter: agents
    lifecycle: service
  web:
    adapter: web
    lifecycle: service
    depends_on:
      agents:
        condition: service_healthy
        required: false
        propagate_restart: true
`;

function load(source, adapterNames = ['agents', 'web']) {
  return loadLauncherConfig({
    path: '/fixture/agents-launcher.yml',
    readFile: () => source,
    adapterNames,
    identityAdapterNames: adapterNames,
  });
}

test('合法 schema v1 被规范化并递归冻结', () => {
  const loaded = load(VALID);
  assert.equal(loaded.sourcePath, '/fixture/agents-launcher.yml');
  assert.equal(loaded.config.services.web.depends_on.agents.propagate_restart, true);
  assert.equal(Object.isFrozen(loaded.config), true);
  assert.equal(Object.isFrozen(loaded.config.services.web.depends_on), true);
  assert.throws(() => {
    loaded.config.supervision.interval_ms = 20;
  }, TypeError);
});

test('YAML 安全拒绝矩阵全部 fail-loud', async (t) => {
  const cases = [
    ['syntax', 'schema_version: [1', /\[topology\].*agents-launcher\.yml/],
    ['multi-document', `${VALID}\n---\nschema_version: 1`, /必须恰好包含一个 YAML document/],
    ['alias', `${VALID}\ncopy: &x value\nalias: *x`, /不允许 YAML alias/],
    ['custom-tag', VALID.replace('schema_version: 1', 'schema_version: !unsafe 1'), /不允许自定义 YAML tag/],
    ['duplicate-key', VALID.replace('schema_version: 1', 'schema_version: 1\nschema_version: 1'), /Map keys must be unique|重复/],
    ['unknown-key', VALID.replace('schema_version: 1', 'schema_version: 1\ncommand: rm -rf repo'), /未知字段 root\.command/],
  ];
  for (const [name, source, pattern] of cases) {
    await t.test(name, () => assert.throws(() => load(source), pattern));
  }
});

test('未知 adapter 在返回配置前失败', () => {
  const source = VALID.replace('adapter: web', 'adapter: shell');
  assert.throws(() => load(source), /\[topology\].*未知 adapter "shell"/);
});

test('topology 引用错误在返回配置前失败', () => {
  const source = VALID.replace(
    'depends_on:\n      agents:',
    'depends_on:\n      ghost:',
  );
  assert.throws(
    () => load(source, ['agents', 'web']),
    /\[topology\].*未知 service "ghost"/,
  );
});

test('schema 错误不回显字段值', () => {
  const source = VALID.replace(
    'schema_version: 1',
    'schema_version: 1\nenv: TOP_SECRET_VALUE',
  );
  let caught = null;
  try {
    load(source);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.match(caught.message, /未知字段 root\.env/);
  assert.doesNotMatch(caught.message, /TOP_SECRET_VALUE/);
});

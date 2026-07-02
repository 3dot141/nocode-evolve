import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INFRA_SERVICES, containerNameOf, waitForEs, startInfra } from './infra.mjs';

const noSleep = () => Promise.resolve();

test('INFRA_SERVICES: 7 个固定服务，与 dev-start.sh 106 行一致', () => {
  assert.deepEqual(INFRA_SERVICES, ['postgresql', 'redis', 'mongodb', 'rabbitmq', 'neo4j', 'minio', 'elasticsearch']);
});

test('containerNameOf: postgresql 映射为 postgres，其余原样', () => {
  assert.equal(containerNameOf('postgresql'), 'postgres');
  assert.equal(containerNameOf('redis'), 'redis');
});

test('waitForEs: 第二次探测 status=yellow 返回 true', async () => {
  let n = 0;
  const mockFetch = async () => ({ json: async () => (++n >= 2 ? { status: 'yellow' } : { status: 'red' }) });
  assert.equal(await waitForEs({ fetchFn: mockFetch, maxRetries: 5, sleep: noSleep }), true);
});

test('waitForEs: 一直不健康则超时返回 false', async () => {
  const mockFetch = async () => ({ json: async () => ({ status: 'red' }) });
  assert.equal(await waitForEs({ fetchFn: mockFetch, maxRetries: 3, sleep: noSleep }), false);
});

test('startInfra: 全部容器已运行时不调 compose up，直接返回', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    calls.push(args?.[1] || '');
    if (args?.[1]?.includes('docker ps')) return 'postgres\nredis\nmongodb\nrabbitmq\nneo4j\nminio\nelasticsearch\n';
    return '';
  };
  const result = await startInfra({ exec: mockExec, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), sleep: noSleep, log: () => {} });
  assert.deepEqual(result.started, []);
  assert.ok(!calls.some((c) => c.includes('compose up')));
});

test('startInfra: 缺容器时调 compose up 起缺的那些', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    const s = args?.[1] || '';
    calls.push(s);
    if (s.includes('docker ps')) return 'postgres\nredis\n';   // 缺 mongodb/rabbitmq/neo4j/minio/elasticsearch
    if (s.includes('pg_isready')) return '';
    return '';
  };
  const result = await startInfra({ exec: mockExec, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), sleep: noSleep, log: () => {} });
  assert.deepEqual(result.started, ['mongodb', 'rabbitmq', 'neo4j', 'minio', 'elasticsearch']);
  assert.ok(calls.some((c) => c.includes('compose up -d mongodb rabbitmq neo4j minio elasticsearch')));
});

test('startInfra: PG 未就绪时不跑 ensureRabbitmqQueues/fixDbPermissions（收尾动作跳过）', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    const s = args?.[1] || '';
    calls.push(s);
    if (s.includes('docker ps')) return '';
    if (s.includes('pg_isready')) throw new Error('not ready');
    return '';
  };
  const result = await startInfra({ exec: mockExec, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), sleep: noSleep, log: () => {} });
  assert.equal(result.pgReady, false);
  assert.ok(!calls.some((c) => c.includes('rabbitmqadmin')));
});

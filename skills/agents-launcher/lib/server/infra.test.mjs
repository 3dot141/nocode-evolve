import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForEs, waitForInfraPorts, startInfra } from './infra.mjs';

const noSleep = () => Promise.resolve();

test('waitForEs: 第二次探测 status=yellow 返回 true', async () => {
  let n = 0;
  const mockFetch = async () => ({ json: async () => (++n >= 2 ? { status: 'yellow' } : { status: 'red' }) });
  assert.equal(await waitForEs({ fetchFn: mockFetch, maxRetries: 5, sleep: noSleep }), true);
});

test('waitForEs: 一直不健康则超时返回 false', async () => {
  const mockFetch = async () => ({ json: async () => ({ status: 'red' }) });
  assert.equal(await waitForEs({ fetchFn: mockFetch, maxRetries: 3, sleep: noSleep }), false);
});

test('waitForInfraPorts: 等到 pg 和 minio 同时就绪', async () => {
  let pgChecks = 0;
  const tcpCheck = async (port) => {
    if (port === 5432) return ++pgChecks >= 2;
    return port === 9000;
  };
  assert.equal(await waitForInfraPorts({ tcpCheck, maxRetries: 3, sleep: noSleep }), true);
});

test('startInfra: 每次先运行目标仓派生脚本，再做健康检查和收尾', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    const s = args?.[1] || '';
    calls.push(s);
    if (s.includes('rabbitmqadmin') && s.includes('list queues')) return '';
    return '';
  };
  let generatedRuns = 0;
  const result = await startInfra({
    exec: mockExec,
    fetchFn: async () => ({ json: async () => ({ status: 'green' }) }),
    tcpCheck: async () => true,
    runDocker: ({ serverDir }) => {
      generatedRuns++;
      assert.equal(serverDir, '/srv');
      return { sourcePath: '/srv/dockerstart.sh' };
    },
    sleep: noSleep,
    log: () => {},
    serverDir: '/srv',
  });

  assert.equal(generatedRuns, 1);
  assert.equal(result.portsReady, true);
  assert.equal(result.esReady, true);
  assert.ok(calls.some((c) => c.includes('rabbitmqadmin')));
});

test('startInfra: 健康检查失败时 fail loud，不执行收尾', async () => {
  const calls = [];
  await assert.rejects(
    startInfra({
      exec: (_cmd, args) => { calls.push(args?.[1] || ''); return ''; },
      fetchFn: async () => ({ json: async () => ({ status: 'green' }) }),
      tcpCheck: async () => false,
      runDocker: () => ({ sourcePath: '/srv/dockerstart.sh' }),
      sleep: noSleep,
      log: () => {},
      serverDir: '/srv',
      portRetries: 2,
    }),
    /PostgreSQL.*MinIO.*未就绪/,
  );
  assert.ok(!calls.some((c) => c.includes('rabbitmqadmin')));
});

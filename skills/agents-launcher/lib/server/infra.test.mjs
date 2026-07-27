import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runPreparedDockerStart,
  startInfra,
  validatePreparedDockerScript,
  waitForEs,
  waitForInfraPorts,
} from './infra.mjs';

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

test('validatePreparedDockerScript: 只接受系统临时目录内约定命名的脚本', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'infra-test-'));
  const scriptPath = join(tempRoot, 'agents-launcher-docker-example.sh');
  const invalidScriptPath = join(tempRoot, 'dockerstart.sh');
  writeFileSync(scriptPath, '#!/bin/bash\n');
  writeFileSync(invalidScriptPath, '#!/bin/bash\n');
  const resolvedScriptPath = realpathSync(scriptPath);

  assert.equal(validatePreparedDockerScript({ scriptPath }), resolvedScriptPath);
  assert.throws(
    () => validatePreparedDockerScript({ scriptPath: invalidScriptPath }),
    /名称必须以/,
  );
  assert.throws(
    () => validatePreparedDockerScript({ scriptPath: '' }),
    /FX_DOCKER_START_SCRIPT 未设置/,
  );
});

test('runPreparedDockerStart: 先校验语法、再执行，并始终删除临时脚本', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'infra-run-'));
  const scriptPath = join(tempRoot, 'agents-launcher-docker-example.sh');
  writeFileSync(scriptPath, '#!/bin/bash\n');
  const resolvedScriptPath = realpathSync(scriptPath);
  const calls = [];

  const result = runPreparedDockerStart({
    serverDir: '/srv',
    scriptPath,
    exec: (command, args, options) => {
      calls.push({ command, args, options });
      return '';
    },
    log: () => {},
  });

  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ['bash', ['-n', resolvedScriptPath]],
    ['bash', [resolvedScriptPath]],
  ]);
  assert.ok(calls.every(({ options }) => options.cwd === '/srv'));
  assert.equal(result.scriptPath, resolvedScriptPath);
  assert.equal(existsSync(scriptPath), false);
});

test('runPreparedDockerStart: 脚本执行失败也删除临时文件', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'infra-fail-'));
  const scriptPath = join(tempRoot, 'agents-launcher-docker-example.sh');
  writeFileSync(scriptPath, '#!/bin/bash\n');

  assert.throws(
    () => runPreparedDockerStart({
      serverDir: '/srv',
      scriptPath,
      exec: (_command, args) => {
        if (!args.includes('-n')) throw new Error('docker failed');
        return '';
      },
      log: () => {},
    }),
    /docker failed/,
  );
  assert.equal(existsSync(scriptPath), false);
});

test('startInfra: 每次先运行 Agent 提供的临时脚本，再做健康检查和收尾', async () => {
  const calls = [];
  const mockExec = (cmd, args) => {
    const s = args?.[1] || '';
    calls.push(s);
    if (s.includes('rabbitmqadmin') && s.includes('list queues')) return '';
    return '';
  };
  let scriptRuns = 0;
  const result = await startInfra({
    exec: mockExec,
    fetchFn: async () => ({ json: async () => ({ status: 'green' }) }),
    tcpCheck: async () => true,
    runDocker: ({ serverDir, scriptPath }) => {
      scriptRuns++;
      assert.equal(serverDir, '/srv');
      assert.equal(scriptPath, '/tmp/agents-launcher-docker-example.sh');
      return { scriptPath };
    },
    sleep: noSleep,
    log: () => {},
    serverDir: '/srv',
    dockerScriptPath: '/tmp/agents-launcher-docker-example.sh',
  });

  assert.equal(scriptRuns, 1);
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
      runDocker: () => ({ scriptPath: '/tmp/agents-launcher-docker-example.sh' }),
      sleep: noSleep,
      log: () => {},
      serverDir: '/srv',
      dockerScriptPath: '/tmp/agents-launcher-docker-example.sh',
      portRetries: 2,
    }),
    /PostgreSQL.*MinIO.*未就绪/,
  );
  assert.ok(!calls.some((c) => c.includes('rabbitmqadmin')));
});

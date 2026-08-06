import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveDockerProfile,
  resolveDockerScript,
  runFixedDockerStart,
  startInfra,
  waitForEs,
  waitForInfraPorts,
} from './infra.mjs';

const noSleep = () => Promise.resolve();

test('resolveDockerProfile: persist/release 映射到固定 profile，其它分支使用 dev', () => {
  assert.equal(resolveDockerProfile({ branchName: 'persist' }), 'persist');
  assert.equal(resolveDockerProfile({ branchName: 'feature/foo-persist-cache' }), 'persist');
  assert.equal(resolveDockerProfile({ branchName: 'release' }), 'release');
  assert.equal(resolveDockerProfile({ branchName: 'feature/release-fix' }), 'release');
  assert.equal(resolveDockerProfile({ branchName: 'feature/foo' }), 'dev');
  assert.equal(resolveDockerProfile({ branchName: 'feature/foo', env: { FX_DOCKER_PROFILE: 'release' } }), 'release');
});

test('resolveDockerScript: 从目标 server worktree branch 选择已发布固定脚本', () => {
  const result = resolveDockerScript({
    serverDir: '/server',
    exec: () => 'persist\n',
  });
  assert.equal(result.branchName, 'persist');
  assert.equal(result.profile, 'persist');
  assert.match(result.scriptPath, /skills\/agents-launcher\/docker\/persist\.sh$/);
});

test('runFixedDockerStart: 只校验并执行固定脚本，不删除脚本', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'infra-run-'));
  const scriptPath = join(tempRoot, 'fixed.sh');
  writeFileSync(scriptPath, '#!/bin/bash\n');
  const calls = [];
  const result = runFixedDockerStart({
    serverDir: '/srv',
    scriptPath,
    exec: (command, args, options) => {
      calls.push({ command, args, options });
      return '';
    },
    log: () => {},
  });
  assert.deepEqual(calls.map(({ command, args }) => [command, args]), [
    ['bash', ['-n', scriptPath]],
    ['bash', [scriptPath]],
  ]);
  assert.ok(calls.every(({ options }) => options.cwd === '/srv'));
  assert.equal(result.scriptPath, scriptPath);
  assert.equal(existsSync(scriptPath), true);
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

test('waitForInfraPorts: 等到 pg 和 minio 同时就绪', async () => {
  let pgChecks = 0;
  const tcpCheck = async (port) => {
    if (port === 5432) return ++pgChecks >= 2;
    return port === 9000;
  };
  assert.equal(await waitForInfraPorts({ tcpCheck, maxRetries: 3, sleep: noSleep }), true);
});

test('startInfra: 固定脚本执行后做健康检查和收尾', async () => {
  const calls = [];
  const result = await startInfra({
    exec: (cmd, args) => {
      const s = args?.[1] || '';
      calls.push(s);
      if (s.includes('rabbitmqadmin') && s.includes('list queues')) return '';
      return '';
    },
    fetchFn: async () => ({ json: async () => ({ status: 'green' }) }),
    tcpCheck: async () => true,
    runDocker: ({ serverDir, scriptPath }) => {
      assert.equal(serverDir, '/srv');
      assert.match(scriptPath, /skills\/agents-launcher\/docker\/persist\.sh$/);
      return { scriptPath };
    },
    sleep: noSleep,
    log: () => {},
    serverDir: '/srv',
    env: { FX_DOCKER_PROFILE: 'persist' },
    portRetries: 1,
  });
  assert.equal(result.profile, 'persist');
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
      runDocker: () => ({ scriptPath: '/fixed.sh' }),
      sleep: noSleep,
      log: () => {},
      serverDir: '/srv',
      dockerScriptPath: '/fixed.sh',
      portRetries: 2,
    }),
    /PostgreSQL.*MinIO.*未就绪/,
  );
  assert.ok(!calls.some((c) => c.includes('rabbitmqadmin')));
});

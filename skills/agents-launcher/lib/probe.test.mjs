import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createServer } from 'node:http';
import { tcpOpen, httpOk, pidOnPort } from './probe.mjs';

function listenOnEphemeralPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

test('tcpOpen: 真实监听的端口返回 true', async () => {
  const srv = await listenOnEphemeralPort();
  const port = srv.address().port;
  try {
    assert.equal(await tcpOpen(port), true);
  } finally {
    srv.close();
  }
});

test('tcpOpen: 未监听的端口返回 false（用极大端口号规避占用冲突）', async () => {
  assert.equal(await tcpOpen(59999, { timeoutMs: 200 }), false);
});

test('tcpOpen: 关闭后的端口立刻返回 false', async () => {
  const srv = await listenOnEphemeralPort();
  const port = srv.address().port;
  await new Promise((r) => srv.close(r));
  assert.equal(await tcpOpen(port, { timeoutMs: 200 }), false);
});

test('httpOk: 2xx-4xx 视为 UP', async () => {
  const srv = createServer((_, res) => { res.statusCode = 404; res.end(); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  try {
    assert.equal(await httpOk(`http://127.0.0.1:${port}/`), true);
  } finally {
    srv.close();
  }
});

test('httpOk: 连接失败返回 false', async () => {
  assert.equal(await httpOk('http://127.0.0.1:59998/', { timeoutMs: 200 }), false);
});

test('pidOnPort: 无监听时返回空字符串（注入 mock exec 抛错模拟 lsof 空结果）', () => {
  const mockExec = () => { throw new Error('lsof: no process'); };
  assert.equal(pidOnPort(12345, { exec: mockExec }), '');
});

test('pidOnPort: 有监听时返回 lsof 输出的 PID（注入 mock exec）', () => {
  const mockExec = (cmd, args) => {
    assert.equal(cmd, 'sh');
    assert.ok(args[1].includes('tcp:8070'));
    return '46239\n';
  };
  assert.equal(pidOnPort(8070, { exec: mockExec }), '46239');
});

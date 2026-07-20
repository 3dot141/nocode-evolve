import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stopApp, serverStatus } from './lifecycle.mjs';

test('stopApp: 有 pid 文件时读取并杀进程组，再删文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(dir, '.dev-start.pid'), '54321');
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'docker') throw new Error('no container');
    if (cmd === 'kill') { killed.push(args); return ''; }
    return '';   // lsof 残留检查查不到
  };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: () => {} });
  assert.equal(result.killed, true);
  assert.ok(killed.some((a) => a.includes('-54321')));
  assert.equal(existsSync(join(dir, '.dev-start.pid')), false);
});

test('stopApp: pid 文件值为 container 时跳过 kill（容器模式已由 docker rm 处理）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(dir, '.dev-start.pid'), 'container');
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'docker') { killed.push('docker-rm'); return ''; }
    if (cmd === 'kill') { killed.push(args); return ''; }
    return '';
  };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: () => {} });
  assert.equal(result.killed, true);
  assert.ok(!killed.some((a) => Array.isArray(a)));   // 没有 kill 数组参数被记录
});

test('stopApp: 无 pid 文件也无残留端口时报告未找到运行中的服务', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  const logs = [];
  const mockExec = () => { throw new Error('none'); };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: (m) => logs.push(m) });
  assert.equal(result.killed, false);
  assert.ok(logs.some((l) => l.includes('未找到运行中的后端服务')));
});

test('stopApp: 端口有残留进程时也 kill 掉', () => {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'docker') throw new Error('no container');
    if (cmd === 'kill') { killed.push(args); return ''; }
    if (args?.[1]?.includes('lsof')) return '77777\n';
    return '';
  };
  const result = stopApp({ serverDir: dir, exec: mockExec, log: () => {} });
  assert.equal(result.killed, true);
  assert.ok(killed.some((a) => a.includes('77777')));
});

test('serverStatus: 全端口 DOWN 时返回 up=false pid=-', () => {
  const mockExec = () => { throw new Error('none'); };
  const status = serverStatus({ exec: mockExec });
  assert.equal(status.http.up, false);
  assert.equal(status.http.pid, '-');
  assert.equal(status.grpc.up, false);
});

test('serverStatus: http 端口 UP 时返回对应 pid', () => {
  const mockExec = (cmd, args) => {
    if (args?.[1]?.includes('tcp:8081')) return '11111\n';
    throw new Error('none');
  };
  const status = serverStatus({ exec: mockExec });
  assert.equal(status.http.up, true);
  assert.equal(status.http.pid, '11111');
  assert.equal(status.grpc.up, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  envLocalPath, buildWebEnv, prepare, pkgmgrCheck, pkgmgrPatch,
  alignCheck, alignReset, killCommands, viteCacheDir, cleanViteCache, start,
} from './web-cli.mjs';
// 旧导出将在 T8 删除；动态 import + skip 让回归锚在删除后自动跳过而非 import 失败
const legacyPorts = await import('./lib/ports.mjs');

function makeWebDir() {
  const dir = mkdtempSync(join(tmpdir(), 'web-cli-'));
  mkdirSync(join(dir, 'packages/jsy-web/server'), { recursive: true });
  return dir;
}

test('envLocalPath 拼接 packages/jsy-web/server/.env.local', () => {
  assert.equal(envLocalPath('/repo'), '/repo/packages/jsy-web/server/.env.local');
});

test('buildWebEnv 与旧 buildWriteTargets 输出一致（回归锚；T8 删除旧导出后自动跳过）', { skip: !legacyPorts.buildWriteTargets }, () => {
  const legacy = legacyPorts.buildWriteTargets({ agentsDir: '/x/agents', ports: { agents: 8070, web: 10001 } }).webEnv;
  const next = buildWebEnv({ agentsDir: '/x/agents', ports: { agents: 8070, web: 10001 } });
  assert.deepEqual(next, legacy);
});

test('buildWebEnv 四键字面值（永久锚，不依赖旧导出）', () => {
  assert.deepEqual(buildWebEnv({ agentsDir: '/x/agents', ports: { agents: 8070, web: 10001 } }), {
    AGENTS_LOCAL_SERVER: 'http://127.0.0.1:8070',
    USER_CLIENT: 'localDebugger',
    AGENTS_LOCAL_SRC: '/x/agents',
    DEV_SERVER_PORT: '10001',
  });
});

test('prepare: .env.local 已存在 → action=exists', () => {
  const dir = makeWebDir();
  try {
    writeFileSync(envLocalPath(dir), 'EXISTING=1\n');
    const r = prepare({ webDir: dir });
    assert.equal(r.action, 'exists');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prepare: 缺失 + fromDir 有源 → copied', () => {
  const dst = makeWebDir();
  const src = makeWebDir();
  try {
    writeFileSync(envLocalPath(src), 'AGENTS_LOCAL_SRC=/main\n');
    const r = prepare({ webDir: dst, fromDir: src });
    assert.equal(r.action, 'copied');
    assert.ok(existsSync(envLocalPath(dst)));
  } finally {
    rmSync(dst, { recursive: true, force: true });
    rmSync(src, { recursive: true, force: true });
  }
});

test('prepare: 缺失且无 fromDir → 抛错', () => {
  const dir = makeWebDir();
  try { assert.throws(() => prepare({ webDir: dir }), /\.env\.local 不存在/); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pkgmgrCheck: 锁定版本本机已缓存 → needsPatch=false', () => {
  const dir = makeWebDir();
  const corepackDir = mkdtempSync(join(tmpdir(), 'corepack-'));
  mkdirSync(join(corepackDir, '10.33.0'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@10.33.0' }, null, 2));
    const r = pkgmgrCheck({ webDir: dir, corepackDir });
    assert.equal(r.needsPatch, false);
    assert.equal(r.lockedVersion, '10.33.0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(corepackDir, { recursive: true, force: true });
  }
});

test('pkgmgrCheck: 锁定版本本机未缓存 → needsPatch=true，列出已缓存版本', () => {
  const dir = makeWebDir();
  const corepackDir = mkdtempSync(join(tmpdir(), 'corepack-'));
  mkdirSync(join(corepackDir, '10.33.0'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@10.10.0' }, null, 2));
    const r = pkgmgrCheck({ webDir: dir, corepackDir });
    assert.equal(r.needsPatch, true);
    assert.deepEqual(r.cached, ['10.33.0']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(corepackDir, { recursive: true, force: true });
  }
});

test('pkgmgrPatch: 只改 packageManager 字段值，其余内容原样保留（含缩进/顺序）', () => {
  const dir = makeWebDir();
  const original = '{\n  "name": "fx-data-web",\n  "version": "1.0.0",\n  "packageManager": "pnpm@10.10.0",\n  "scripts": {\n    "dev": "vite"\n  }\n}\n';
  try {
    writeFileSync(join(dir, 'package.json'), original);
    const r = pkgmgrPatch({ webDir: dir, version: '10.33.0' });
    assert.equal(r.from, 'pnpm@10.10.0');
    assert.equal(r.to, 'pnpm@10.33.0');
    const patched = readFileSync(join(dir, 'package.json'), 'utf8');
    assert.equal(patched, original.replace('pnpm@10.10.0', 'pnpm@10.33.0'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('alignCheck: HEAD 与 targetSha 一致时 aligned=true（注入 exec）', () => {
  const r = alignCheck({ webDir: '/fake', targetSha: 'abc123', exec: () => 'abc123\n' });
  assert.equal(r.aligned, true);
  assert.equal(r.headSha, 'abc123');
});

test('alignCheck: 不一致时 aligned=false', () => {
  const r = alignCheck({ webDir: '/fake', targetSha: 'abc123', exec: () => 'def456\n' });
  assert.equal(r.aligned, false);
});

test('alignReset: 调用 git reset --hard <targetSha>（注入 exec，验证参数）', () => {
  let called = null;
  alignReset({ webDir: '/fake', targetSha: 'abc123', exec: (cmd, args) => { called = [cmd, args]; return ''; } });
  assert.deepEqual(called, ['git', ['-C', '/fake', 'reset', '--hard', 'abc123']]);
});

test('viteCacheDir 指向 packages/jsy-web/node_modules/.vite', () => {
  assert.equal(viteCacheDir('/repo'), '/repo/packages/jsy-web/node_modules/.vite');
});

test('cleanViteCache: 缓存存在 → 删除后 action=removed', () => {
  const dir = makeWebDir();
  const cacheDir = join(dir, 'packages/jsy-web/node_modules/.vite/deps');
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, '@lexical_list.js'), 'stale');
    const r = cleanViteCache({ webDir: dir });
    assert.equal(r.action, 'removed');
    assert.ok(!existsSync(join(dir, 'packages/jsy-web/node_modules/.vite')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cleanViteCache: 缓存不存在 → action=none', () => {
  const dir = makeWebDir();
  try {
    const r = cleanViteCache({ webDir: dir });
    assert.equal(r.action, 'none');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('start: spawn vite 前先清 Vite 缓存（所有启动路径共享，防 CLI start 绕过 orchestrator 漏清）', () => {
  const order = [];
  const fakeChild = {};
  const r = start({
    webDir: '/repo',
    clean: ({ webDir }) => { order.push(`clean:${webDir}`); return { action: 'removed', path: '/repo/packages/jsy-web/node_modules/.vite' }; },
    spawn: (_label, cmd, args) => { order.push(`spawn:${cmd} ${args.join(' ')}`); return fakeChild; },
    log: () => {},
  });
  assert.deepEqual(order, ['clean:/repo', 'spawn:pnpm dev']);
  assert.equal(r, fakeChild);
});

test('killCommands 只清 web 端口，不碰 agents/server', () => {
  const cmds = killCommands({ ports: { web: 10001 } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('tcp:10001')));
  assert.ok(!flat.some((s) => s.includes('telemetry')), '不该碰 agents');
});

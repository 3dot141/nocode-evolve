import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configPath, prepare, killCommands, ensureCss } from './agents-cli.mjs';

function makeAgentsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'agents-cli-'));
  mkdirSync(join(dir, 'packages/server/conf'), { recursive: true });
  return dir;
}

test('configPath 拼接 packages/server/conf/config.yaml', () => {
  assert.equal(configPath('/repo'), '/repo/packages/server/conf/config.yaml');
});

test('prepare: config.yaml 已存在 → action=exists，不覆盖', () => {
  const dir = makeAgentsDir();
  try {
    writeFileSync(configPath(dir), 'existing: true\n');
    const r = prepare({ agentsDir: dir });
    assert.equal(r.action, 'exists');
    assert.equal(r.path, configPath(dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prepare: 缺失且给了 fromDir 且源存在 → cp 并返回 copied', () => {
  const dst = makeAgentsDir();
  const src = makeAgentsDir();
  try {
    writeFileSync(configPath(src), 'from: main-repo\n');
    const r = prepare({ agentsDir: dst, fromDir: src });
    assert.equal(r.action, 'copied');
    assert.ok(existsSync(configPath(dst)));
  } finally {
    rmSync(dst, { recursive: true, force: true });
    rmSync(src, { recursive: true, force: true });
  }
});

test('prepare: 缺失且无可用 fromDir → 抛错，报错含 cp 模板提示', () => {
  const dir = makeAgentsDir();
  try {
    assert.throws(() => prepare({ agentsDir: dir }), /config\.example\.yaml/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('killCommands 含 tsx watch 父进程 kill + 端口清理，不碰 web/server', () => {
  const cmds = killCommands({ ports: { agents: 8070 } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('telemetry/preload.ts')));
  assert.ok(flat.some((s) => s.includes('tcp:8070')));
  assert.ok(!flat.some((s) => s.includes('tcp:10001')), '不该碰 web 端口');
});

test('ensureCss: CSS 产物已存在则跳过 build:css', async () => {
  let called = false;
  const dir = makeAgentsDir();
  mkdirSync(join(dir, 'packages/desktop/dist'), { recursive: true });
  mkdirSync(join(dir, 'packages/ui/dist'), { recursive: true });
  writeFileSync(join(dir, 'packages/desktop/dist/style.css'), '');
  writeFileSync(join(dir, 'packages/ui/dist/agent-ui.css'), '');
  try {
    const r = await ensureCss({ agentsDir: dir, run: async () => { called = true; } });
    assert.equal(r.action, 'skipped');
    assert.equal(called, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ensureCss: CSS 产物缺失则跑 build:css', async () => {
  let calledWith = null;
  const dir = makeAgentsDir();
  try {
    const r = await ensureCss({ agentsDir: dir, run: async (label, cmd, args) => { calledWith = [label, cmd, args]; } });
    assert.equal(r.action, 'built');
    assert.deepEqual(calledWith, ['build:css', 'pnpm', ['build:css']]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

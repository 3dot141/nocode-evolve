import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveToolchainBins, pinToolchainPath } from './toolchain.mjs';

// 每个用例独立 root（mkdtempSync），mise installs 的副作用不跨用例泄漏。
function makeRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

// 在 root 下伪造声明了工具链的仓目录。
function makeAgentsDir(root, name, filename, content) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
  return dir;
}

// 在 root 下伪造 mise installs：node 带 bin 子目录，pnpm 真身直接在版本目录下。
function makeMisenv(root, { node, pnpm } = {}) {
  const miseData = join(root, 'mise-data');
  if (node) mkdirSync(join(miseData, 'installs/node', node, 'bin'), { recursive: true });
  if (pnpm) {
    mkdirSync(join(miseData, 'installs/pnpm', pnpm), { recursive: true });
    writeFileSync(join(miseData, 'installs/pnpm', pnpm, 'pnpm'), '#!/bin/sh\n');
  }
  return miseData;
}

const io = { exists: existsSync, read: readFileSync };

test('mise.toml 声明 node+pnpm → 返回两个真身目录', () => {
  const root = makeRoot('fx-tc-toml-');
  const agentsDir = makeAgentsDir(root, 'agents', 'mise.toml', '[tools]\nnode = "22.14.0"\npnpm = "10.33.0"\n');
  const miseData = makeMisenv(root, { node: '22.14.0', pnpm: '10.33.0' });
  const hit = resolveToolchainBins({ agentsDir, env: { MISE_DATA_DIR: miseData }, ...io });
  assert.equal(hit.node, '22.14.0');
  assert.equal(hit.pnpm, '10.33.0');
  assert.equal(hit.source, 'mise.toml');
  assert.deepEqual(hit.dirs, [
    join(miseData, 'installs/node/22.14.0/bin'),
    join(miseData, 'installs/pnpm/10.33.0'),
  ]);
});

test('.tool-versions 兜底；行内注释不影响取版本；installs 缺失的键被跳过', () => {
  const root = makeRoot('fx-tc-tv-');
  const agentsDir = makeAgentsDir(root, 'agents', '.tool-versions', 'node 22.14 # jod\npnpm 10.33.0\n');
  const miseData = makeMisenv(root, { node: '22.14' }); // pnpm 未安装 → 只有 node 目录
  const hit = resolveToolchainBins({ agentsDir, env: { MISE_DATA_DIR: miseData }, ...io });
  assert.equal(hit.source, '.tool-versions');
  assert.deepEqual(hit.dirs, [join(miseData, 'installs/node/22.14/bin')]);
});

test('无任何声明文件 → null，pinToolchainPath 不动 PATH', () => {
  const root = makeRoot('fx-tc-none-');
  const agentsDir = join(root, 'agents');
  mkdirSync(agentsDir);
  const env = { PATH: '/usr/bin:/bin' };
  const logs = [];
  assert.equal(pinToolchainPath({ agentsDir, env, log: (m) => logs.push(m), ...io }), false);
  assert.equal(env.PATH, '/usr/bin:/bin');
});

test('pinToolchainPath 前置去重，已含时不重复前置', () => {
  const root = makeRoot('fx-tc-pin-');
  const agentsDir = makeAgentsDir(root, 'agents', 'mise.toml', '[tools]\nnode = "22.14.0"\n');
  makeMisenv(root, { node: '22.14.0' });
  const nodeBin = join(root, 'mise-data/installs/node/22.14.0/bin');
  // env 必须带 MISE_DATA_DIR 指向 tmp，否则解析会命中真实机器的 mise 目录。
  const mkEnv = (path) => ({ PATH: path, MISE_DATA_DIR: join(root, 'mise-data') });
  const env = mkEnv(`/usr/bin:${nodeBin}`);
  assert.equal(pinToolchainPath({ agentsDir, env, log: () => {}, ...io }), true);
  assert.equal(env.PATH, `/usr/bin:${nodeBin}`);
  const env2 = mkEnv('/usr/bin');
  assert.equal(pinToolchainPath({ agentsDir, env: env2, log: () => {}, ...io }), true);
  assert.equal(env2.PATH, `${nodeBin}:/usr/bin`);
});

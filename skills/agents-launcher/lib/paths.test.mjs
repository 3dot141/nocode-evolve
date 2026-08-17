import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { resolveRepos, validateRepos } from './paths.mjs';

const MARKERS = {
  AGENTS_DIR: 'packages/server/conf/config.example.yaml',
  WEB_DIR: 'packages/jsy-web/src/entry/config.ts',
  SERVER_DIR: 'gradlew',
};

// 在 tmp 下伪造一个带标志文件的有效仓
function makeRepo(parent, name, key) {
  const dir = join(parent, name);
  const marker = join(dir, MARKERS[key]);
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, 'x');
  return dir;
}

test('toolDir 上三级作 AGENTS_DIR auto 兜底（算术校验），兄弟仓不猜裸名', () => {
  const r = resolveRepos({ toolDir: '/p/fx-data-agents/.claude/skills/agents-launcher', env: {} });
  assert.equal(r.AGENTS_DIR, '/p/fx-data-agents');
  assert.equal(r.WEB_DIR, null);
  assert.equal(r.SERVER_DIR, null);
  assert.equal(r.sources.WEB_DIR, 'none');
  assert.equal(r.sources.SERVER_DIR, 'none');
});

test('只设 FX_AGENTS_DIR 时，web/server 按同变体后缀推导', () => {
  const parent = mkdtempSync(join(tmpdir(), 'fx-src-'));
  makeRepo(parent, 'fx-data-agents-release', 'AGENTS_DIR');
  makeRepo(parent, 'fx-data-web-release', 'WEB_DIR');
  makeRepo(parent, 'fx-data-server-release', 'SERVER_DIR');
  const r = resolveRepos({ toolDir: '/t', env: { FX_AGENTS_DIR: join(parent, 'fx-data-agents-release') } });
  assert.equal(r.WEB_DIR, join(parent, 'fx-data-web-release'));
  assert.equal(r.SERVER_DIR, join(parent, 'fx-data-server-release'));
  assert.equal(r.sources.WEB_DIR, 'auto');
  assert.equal(r.sources.SERVER_DIR, 'auto');
});

test('同变体目录缺标志文件时回退裸名仓', () => {
  const parent = mkdtempSync(join(tmpdir(), 'fx-src-'));
  makeRepo(parent, 'fx-data-agents-release', 'AGENTS_DIR');
  mkdirSync(join(parent, 'fx-data-web-release')); // 存在但不是有效仓
  makeRepo(parent, 'fx-data-web', 'WEB_DIR');
  const r = resolveRepos({ toolDir: '/t', env: { FX_AGENTS_DIR: join(parent, 'fx-data-agents-release') } });
  assert.equal(r.WEB_DIR, join(parent, 'fx-data-web'));
});

test('AGENTS_DIR 裸名（无变体）时只试裸名兄弟仓', () => {
  const parent = mkdtempSync(join(tmpdir(), 'fx-src-'));
  makeRepo(parent, 'fx-data-agents', 'AGENTS_DIR');
  makeRepo(parent, 'fx-data-web', 'WEB_DIR');
  mkdirSync(join(parent, 'fx-data-web-release')); // 变体仓存在也不选：AGENTS 无变体
  const r = resolveRepos({ toolDir: '/t', env: { FX_AGENTS_DIR: join(parent, 'fx-data-agents') } });
  assert.equal(r.WEB_DIR, join(parent, 'fx-data-web'));
});

test('AGENTS_DIR 不匹配 fx-data-agents 命名时不推导', () => {
  const parent = mkdtempSync(join(tmpdir(), 'fx-src-'));
  makeRepo(parent, 'fx-data-web', 'WEB_DIR');
  const r = resolveRepos({ toolDir: '/t', env: { FX_AGENTS_DIR: join(parent, 'some-other-repo') } });
  assert.equal(r.WEB_DIR, null);
  assert.equal(r.sources.WEB_DIR, 'none');
});

test('FX_WEB_DIR / FX_SERVER_DIR 显式覆盖优先于推导', () => {
  const parent = mkdtempSync(join(tmpdir(), 'fx-src-'));
  makeRepo(parent, 'fx-data-agents-release', 'AGENTS_DIR');
  makeRepo(parent, 'fx-data-web-release', 'WEB_DIR');
  const r = resolveRepos({ toolDir: '/t', env: {
    FX_AGENTS_DIR: join(parent, 'fx-data-agents-release'),
    FX_WEB_DIR: '/custom/web',
    FX_SERVER_DIR: '/custom/srv',
  } });
  assert.equal(r.WEB_DIR, '/custom/web');
  assert.equal(r.SERVER_DIR, '/custom/srv');
  assert.deepEqual(r.sources, { AGENTS_DIR: 'env', WEB_DIR: 'env', SERVER_DIR: 'env' });
});

test('sources 标记每个路径来源 env / auto / none', () => {
  const r = resolveRepos({ toolDir: '/p/fx-data-agents/.claude/skills/agents-launcher', env: { FX_WEB_DIR: '/w' } });
  assert.equal(r.sources.AGENTS_DIR, 'auto');
  assert.equal(r.sources.WEB_DIR, 'env');
  assert.equal(r.sources.SERVER_DIR, 'none');
});

test('validateRepos: 路径为 null 时报「未设置」而非「目录不存在」', () => {
  assert.throws(
    () => validateRepos({ WEB_DIR: null }, { need: ['WEB_DIR'] }),
    /WEB_DIR 未设置.*FX_WEB_DIR/s,
  );
});

test('validateRepos 缺标志文件时抛清晰错误', () => {
  const agents = mkdtempSync(join(tmpdir(), 'agents-'));
  assert.throws(() => validateRepos({ AGENTS_DIR: agents }, { need: ['AGENTS_DIR'] }), /config\.example\.yaml/);
});

test('validateRepos marker 存在时通过', () => {
  const agents = mkdtempSync(join(tmpdir(), 'agents-'));
  mkdirSync(join(agents, 'packages/server/conf'), { recursive: true });
  writeFileSync(join(agents, 'packages/server/conf/config.example.yaml'), 'x');
  assert.doesNotThrow(() => validateRepos({ AGENTS_DIR: agents }, { need: ['AGENTS_DIR'] }));
});

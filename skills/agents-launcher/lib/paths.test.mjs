import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveRepos, validateRepos } from './paths.mjs';

test('默认：AGENTS_DIR = toolDir 上两级（.claude/skills/agents-launcher → 仓根），web/server 取同级', () => {
  const r = resolveRepos({ toolDir: '/p/fx-data-agents/.claude/skills/agents-launcher', env: {} });
  assert.equal(r.AGENTS_DIR, '/p/fx-data-agents');
  assert.equal(r.WEB_DIR, '/p/fx-data-web');
  assert.equal(r.SERVER_DIR, '/p/fx-data-server');
});

test('FX_AGENTS_DIR 覆盖（验证 worktree 用），web/server 跟随其同级', () => {
  const r = resolveRepos({ toolDir: '/p/fx-data-agents/.claude/skills/agents-launcher', env: { FX_AGENTS_DIR: '/p/fx-data-agents-debug-launcher' } });
  assert.equal(r.AGENTS_DIR, '/p/fx-data-agents-debug-launcher');
  assert.equal(r.WEB_DIR, '/p/fx-data-web');
  assert.equal(r.SERVER_DIR, '/p/fx-data-server');
});

test('FX_WEB_DIR / FX_SERVER_DIR 单独覆盖', () => {
  const r = resolveRepos({ toolDir: '/p/fx-data-agents/.claude/skills/agents-launcher', env: { FX_WEB_DIR: '/custom/web', FX_SERVER_DIR: '/custom/srv' } });
  assert.equal(r.WEB_DIR, '/custom/web');
  assert.equal(r.SERVER_DIR, '/custom/srv');
});

test('sources 标记每个路径来源 env / auto', () => {
  const r = resolveRepos({ toolDir: '/p/fx-data-agents/.claude/skills/agents-launcher', env: { FX_WEB_DIR: '/w' } });
  assert.equal(r.sources.AGENTS_DIR, 'auto');
  assert.equal(r.sources.WEB_DIR, 'env');
  assert.equal(r.sources.SERVER_DIR, 'auto');
  const all = resolveRepos({ toolDir: '/t', env: { FX_AGENTS_DIR: '/a', FX_WEB_DIR: '/w', FX_SERVER_DIR: '/s' } });
  assert.deepEqual(all.sources, { AGENTS_DIR: 'env', WEB_DIR: 'env', SERVER_DIR: 'env' });
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

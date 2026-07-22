import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  RuntimeEntryError,
  createRuntimeEnv,
  runRuntimeEntry,
} from '../scripts/lib/runtime-entry.mjs';
import { main as runClaudeProviderEntry } from '../core/domains/runtime-state/providers/claude-plugin-data/scripts/entry.mjs';
import { main as runCodexProviderEntry } from '../core/domains/runtime-state/providers/codex-plugin-data/scripts/entry.mjs';
import { main as runCodexAdapterEntry } from '../adapters/codex/runtime-entry.mjs';
import { buildExpectedTree } from '../scripts/lib/platform-compiler.mjs';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';
import { claudeAdapter } from '../adapters/claude/adapter.mjs';
import { codexAdapter } from '../adapters/codex/adapter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METADATA = JSON.parse(readFileSync(path.join(ROOT, 'plugin/metadata.json'), 'utf8'));

function dataDir(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nocode-runtime-entry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'plugin data');
  mkdirSync(dir);
  return dir;
}

function captureSpawn() {
  const calls = [];
  return {
    calls,
    spawn(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0, signal: null, error: undefined };
    },
  };
}

function errorCode(fn, code) {
  assert.throws(fn, (error) => error instanceof RuntimeEntryError && error.code === code);
}

test('shared runtime mapper accepts extracted values, strips native names and never reads process.env', (t) => {
  const dir = dataDir(t);
  const env = createRuntimeEnv({
    value: dir,
    sourceName: 'CLAUDE_PLUGIN_DATA',
    targetName: 'NOCODE_PLUGIN_DATA',
    baseEnv: {
      KEEP: 'yes', CLAUDE_PLUGIN_DATA: '/wrong', CODEX_PLUGIN_DATA: '/wrong',
      PLUGIN_DATA: '/wrong', NOCODE_PLUGIN_DATA: '/wrong',
    },
  });
  assert.deepEqual(env, { KEEP: 'yes', NOCODE_PLUGIN_DATA: dir });
  errorCode(() => createRuntimeEnv({
    value: undefined, sourceName: 'CLAUDE_PLUGIN_DATA', targetName: 'NOCODE_PLUGIN_DATA', baseEnv: {},
  }), 'RUNTIME_DATA_MISSING');
  const missing = path.join(dir, 'missing');
  assert.deepEqual(createRuntimeEnv({
    value: missing, sourceName: 'CLAUDE_PLUGIN_DATA',
    targetName: 'NOCODE_PLUGIN_DATA', baseEnv: {},
  }), { NOCODE_PLUGIN_DATA: missing });
  errorCode(() => createRuntimeEnv({
    value: 'relative/plugin-data', sourceName: 'CLAUDE_PLUGIN_DATA',
    targetName: 'NOCODE_PLUGIN_DATA', baseEnv: {},
  }), 'RUNTIME_DATA_INVALID');
  const file = path.join(dir, 'not-a-directory');
  writeFileSync(file, 'fixture');
  errorCode(() => createRuntimeEnv({
    value: file, sourceName: 'CLAUDE_PLUGIN_DATA',
    targetName: 'NOCODE_PLUGIN_DATA', baseEnv: {},
  }), 'RUNTIME_DATA_INVALID');
});

test('runtime launcher uses argv without a shell and redacts native values from errors', (t) => {
  const dir = dataDir(t);
  const captured = captureSpawn();
  assert.equal(runRuntimeEntry({
    value: dir, sourceName: 'CLAUDE_PLUGIN_DATA', targetName: 'NOCODE_PLUGIN_DATA',
    argv: ['node', 'script with spaces.mjs', '--value', "a'b`c"], baseEnv: { KEEP: 'yes' },
    spawn: captured.spawn,
  }), 0);
  assert.deepEqual(captured.calls[0].command, 'node');
  assert.deepEqual(captured.calls[0].args, ['script with spaces.mjs', '--value', "a'b`c"]);
  assert.equal(captured.calls[0].options.shell, false);
  assert.equal(captured.calls[0].options.env.NOCODE_PLUGIN_DATA, dir);
  errorCode(() => runRuntimeEntry({
    value: dir, sourceName: 'CLAUDE_PLUGIN_DATA', targetName: 'NOCODE_PLUGIN_DATA',
    argv: [], baseEnv: {}, spawn: captured.spawn,
  }), 'RUNTIME_TARGET_INVALID');
  try {
    runRuntimeEntry({
      value: dir, sourceName: 'CLAUDE_PLUGIN_DATA', targetName: 'NOCODE_PLUGIN_DATA',
      argv: ['bad'], baseEnv: {}, spawn: () => ({ status: null, error: new Error(`private ${dir}`) }),
    });
    assert.fail('expected launch failure');
  } catch (error) {
    assert.equal(error.code, 'RUNTIME_LAUNCH_FAILED');
    assert.equal(error.message.includes(dir), false);
  }
});

test('Claude and Codex entry chains perform only their exact mappings', (t) => {
  const dir = dataDir(t);
  const home = path.join(dir, 'home');
  const claude = captureSpawn();
  assert.equal(runClaudeProviderEntry(['--', 'node', 'hook.mjs'], {
    HOME: home, CLAUDE_PLUGIN_DATA: dir, PLUGIN_DATA: '/must-not-fallback', KEEP: 'yes',
  }, undefined, claude.spawn), 0);
  assert.equal(claude.calls[0].options.env.NOCODE_PLUGIN_DATA,
    path.join(home, '.nocode', 'claude', 'data'));
  assert.equal('NOCODE_ROUTE_KEY' in claude.calls[0].options.env, false);
  assert.equal('CLAUDE_PLUGIN_DATA' in claude.calls[0].options.env, false);

  const adapter = captureSpawn();
  assert.equal(runCodexAdapterEntry(['--', 'node', 'provider.mjs', '--', 'node', 'hook.mjs'], {
    HOME: home, PLUGIN_DATA: dir, CLAUDE_PLUGIN_DATA: '/must-not-fallback', KEEP: 'yes',
  }, undefined, adapter.spawn), 0);
  assert.equal(adapter.calls[0].options.env.CODEX_PLUGIN_DATA,
    path.join(home, '.nocode', 'codex', 'data'));
  assert.equal('PLUGIN_DATA' in adapter.calls[0].options.env, false);

  const provider = captureSpawn();
  assert.equal(runCodexProviderEntry(['--', 'node', 'hook.mjs'], {
    HOME: home, CODEX_PLUGIN_DATA: dir, PLUGIN_DATA: '/must-not-fallback', KEEP: 'yes',
  }, undefined, provider.spawn), 0);
  assert.equal(provider.calls[0].options.env.NOCODE_PLUGIN_DATA,
    path.join(home, '.nocode', 'codex', 'data'));
  assert.equal('NOCODE_ROUTE_KEY' in provider.calls[0].options.env, false);
  assert.equal('CODEX_PLUGIN_DATA' in provider.calls[0].options.env, false);

});

test('legacy private domain route launcher is removed', () => {
  assert.equal(existsSync(path.join(ROOT, 'scripts/lib/domain-route-entry.mjs')), false);
  assert.equal(claudeAdapter.renderDomainRouteArgv, undefined);
  assert.equal(codexAdapter.renderDomainRouteArgv, undefined);
});

test('provider manifests explicitly restrict plugin data to runtime-state providers', () => {
  const registry = loadDomainRegistry(ROOT);
  const owners = [];
  for (const provider of registry.providers.values()) {
    assert.equal(typeof provider.pluginData, 'boolean', provider.id);
    if (provider.pluginData) owners.push(provider.id);
  }
  assert.deepEqual(owners.sort(), ['claude-plugin-data', 'codex-plugin-data']);
});

test('generated hooks retain only model injection and Open Design starts directly', () => {
  const registry = loadDomainRegistry(ROOT);
  const claudeTree = buildExpectedTree({
    root: ROOT, metadata: METADATA, adapter: claudeAdapter,
    resolution: registry.resolvePlatform('claude'), registry,
  });
  const codexTree = buildExpectedTree({
    root: ROOT, metadata: METADATA, adapter: codexAdapter,
    resolution: registry.resolvePlatform('codex'), registry,
  });
  const claudeHooks = JSON.parse(claudeTree.get('hooks/hooks.json').toString());
  const claudeSessionHooks = claudeHooks.hooks.SessionStart[0].hooks;
  assert.equal(claudeSessionHooks.length, 1);
  assert.equal(claudeSessionHooks[0].command,
    'bash "${CLAUDE_PLUGIN_ROOT}/hooks/inject-nocode.sh" model-nocode');
  assert.doesNotMatch(claudeSessionHooks[0].command, /claude-plugin-data|session-open/);

  const codexHooks = JSON.parse(codexTree.get('hooks/hooks.json').toString());
  const codexSessionHooks = codexHooks.hooks.SessionStart[0].hooks;
  assert.equal(codexSessionHooks.length, 1);
  assert.equal(codexSessionHooks[0].command, 'bash ./hooks/inject-nocode.sh model-nocode');
  assert.doesNotMatch(codexSessionHooks[0].command, /runtime-entry|codex-plugin-data|session-open|PLUGIN_ROOT/);

  const claudeMcp = JSON.stringify(JSON.parse(claudeTree.get('.mcp.json').toString()));
  const codexMcp = JSON.stringify(JSON.parse(codexTree.get('.mcp.json').toString()));
  assert.doesNotMatch(claudeMcp, /claude-plugin-data/);
  assert.doesNotMatch(codexMcp, /runtime-entry|codex-plugin-data/);
  assert.ok(codexTree.has('skills/using-nocode/scripts/runtime-entry.mjs'));
  assert.ok(claudeTree.has('skills/using-nocode/scripts/providers/claude-plugin-data/scripts/entry.mjs'));
  assert.ok(codexTree.has('skills/using-nocode/scripts/providers/codex-plugin-data/scripts/entry.mjs'));
  assert.equal(claudeTree.has('scripts/lib/domain-route-entry.mjs'), false);
  assert.equal(codexTree.has('scripts/lib/domain-route-entry.mjs'), false);
  assert.match(claudeTree.get('skills/using-nocode/scripts/providers/claude-plugin-data/scripts/entry.mjs').toString(),
    /from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/scripts\/lib\/runtime-entry\.mjs'/);
  assert.match(codexTree.get('skills/using-nocode/scripts/providers/codex-plugin-data/scripts/entry.mjs').toString(),
    /from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/scripts\/lib\/runtime-entry\.mjs'/);
  assert.ok(claudeTree.has('skills/using-nocode/references/runtime-state.md'));
  assert.ok(codexTree.has('skills/using-nocode/references/runtime-state.md'));
});

test('synthetic MCP argv uses the same Codex adapter-provider composition', (t) => {
  const dir = dataDir(t);
  const adapter = captureSpawn();
  runCodexAdapterEntry(['--', 'node', 'providers/codex-plugin-data/scripts/entry.mjs', '--',
    'node', 'mcp/server.mjs', '--stdio'], { PLUGIN_DATA: dir }, undefined, adapter.spawn);
  assert.deepEqual(adapter.calls[0].args, [
    'providers/codex-plugin-data/scripts/entry.mjs', '--', 'node', 'mcp/server.mjs', '--stdio',
  ]);
  assert.equal(adapter.calls[0].options.shell, false);
  assert.equal('NOCODE_ROUTE_KEY' in adapter.calls[0].options.env, false);
});

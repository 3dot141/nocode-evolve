import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RuntimeEntryError, createRuntimeEnv, runRuntimeEntry,
} from '../scripts/lib/runtime-entry.mjs';
import { buildExpectedTree } from '../scripts/lib/platform-packager.mjs';
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

test('shared runtime mapper accepts explicit paths and strips platform data names', (t) => {
  const dir = dataDir(t);
  const env = createRuntimeEnv({
    value: dir,
    sourceName: 'platform data directory',
    targetName: 'NOCODE_PLUGIN_DATA',
    baseEnv: {
      KEEP: 'yes', CLAUDE_PLUGIN_DATA: '/wrong', CODEX_PLUGIN_DATA: '/wrong',
      PLUGIN_DATA: '/wrong', NOCODE_PLUGIN_DATA: '/wrong',
    },
  });
  assert.deepEqual(env, { KEEP: 'yes', NOCODE_PLUGIN_DATA: dir });
  assert.throws(() => createRuntimeEnv({
    value: 'relative/data', sourceName: 'platform data directory',
    targetName: 'NOCODE_PLUGIN_DATA', baseEnv: {},
  }), (error) => error instanceof RuntimeEntryError && error.code === 'RUNTIME_DATA_INVALID');
  const file = path.join(dir, 'not-a-directory');
  writeFileSync(file, 'fixture');
  assert.throws(() => createRuntimeEnv({
    value: file, sourceName: 'platform data directory',
    targetName: 'NOCODE_PLUGIN_DATA', baseEnv: {},
  }), (error) => error.code === 'RUNTIME_DATA_INVALID');
});

test('runtime launcher uses argv without a shell and redacts native values from errors', (t) => {
  const dir = dataDir(t);
  const captured = captureSpawn();
  assert.equal(runRuntimeEntry({
    value: dir,
    sourceName: 'platform data directory',
    targetName: 'NOCODE_PLUGIN_DATA',
    argv: ['node', 'script with spaces.mjs', '--value', "a'b`c"],
    baseEnv: { KEEP: 'yes' },
    spawn: captured.spawn,
  }), 0);
  assert.equal(captured.calls[0].command, 'node');
  assert.deepEqual(captured.calls[0].args, ['script with spaces.mjs', '--value', "a'b`c"]);
  assert.equal(captured.calls[0].options.shell, false);
  assert.equal(captured.calls[0].options.env.NOCODE_PLUGIN_DATA, dir);
  assert.throws(() => runRuntimeEntry({
    value: dir,
    sourceName: 'platform data directory',
    targetName: 'NOCODE_PLUGIN_DATA',
    argv: [],
    spawn: captured.spawn,
  }), (error) => error.code === 'RUNTIME_TARGET_INVALID');
});

test('generated platform entrypoints map directly to isolated data roots', async (t) => {
  for (const [platform, adapter] of Object.entries({ claude: claudeAdapter, codex: codexAdapter })) {
    const tree = buildExpectedTree({ root: ROOT, metadata: METADATA, adapter });
    const source = tree.get('runtime/plugin-data-entry.mjs').toString();
    assert.match(source, new RegExp(`platformDataRoot\\('${platform}'`));
    assert.match(source, /targetName: 'NOCODE_PLUGIN_DATA'/);
    assert.doesNotMatch(source, /Capability|provider|using-nocode/);

    const generated = path.join(ROOT, 'plugins', platform, 'nocode', 'runtime/plugin-data-entry.mjs');
    if (existsSync(generated)) {
      const module = await import(`${pathToFileURL(generated).href}?test=${Date.now()}-${platform}`);
      const captured = captureSpawn();
      const home = path.dirname(dataDir(t));
      assert.equal(module.main(['--', 'node', 'hook.mjs'], { HOME: home }, undefined, captured.spawn), 0);
      assert.equal(captured.calls[0].options.env.NOCODE_PLUGIN_DATA,
        path.join(home, '.nocode', platform, 'data'));
    }
  }
});

test('generated hooks use direct runtime paths without global MCP registration', () => {
  for (const [platform, adapter] of Object.entries({ claude: claudeAdapter, codex: codexAdapter })) {
    const tree = buildExpectedTree({ root: ROOT, metadata: METADATA, adapter });
    const hooks = tree.get('hooks/hooks.json').toString();
    assert.match(hooks, /runtime\/plugin-data-entry\.mjs/);
    assert.match(hooks, /hooks\/session-open\.mjs/);
    assert.doesNotMatch(hooks, /using-nocode|provider/);
    assert.equal(tree.has('.mcp.json'), false, `${platform} must not register a global MCP server`);
    assert.equal(tree.has('scripts/open-design-launch.mjs'), false,
      `${platform} must not publish the legacy Open Design MCP launcher`);
  }
});

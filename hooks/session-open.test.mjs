import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openFromHook } from './session-open.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');

test('SessionStart opens session-scoped state before other lifecycle hooks', () => {
  const dataRoot = mkdtempSync(join(tmpdir(), 'nocode-session-open-'));
  try {
    const result = openFromHook({ session_id: 'session-a', cwd: '/tmp/workspace-a' }, {
      open: (input) => ({ ...input, status: 'open' }),
    });
    assert.equal(result.status, 'open');
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('SessionStart accepts Codex-style aliases and rejects incomplete identity', () => {
  let alias;
  openFromHook({ sessionId: 'session-b', workspace: '/tmp/workspace-b' }, { open: (input) => { alias = input; return input; } });
  assert.deepEqual(alias, { sessionId: 'session-b', workspace: '/tmp/workspace-b' });
  assert.throws(
    () => openFromHook({ cwd: '/tmp/workspace' }),
    /STATE_SESSION_REQUIRED/,
  );
  assert.throws(
    () => openFromHook({ session_id: 'session' }),
    /STATE_WORKSPACE_REQUIRED/,
  );
});

test('generated Claude and Codex hook chains open fresh state without a Stop guard', (t) => {
  for (const platform of ['claude', 'codex']) {
    const pluginRoot = join(REPO_ROOT, 'plugins', platform, 'nocode');
    const dataParent = mkdtempSync(join(tmpdir(), `nocode-${platform}-lifecycle-`));
    const dataRoot = join(dataParent, '.nocode', platform, 'data');
    t.after(() => rmSync(dataParent, { recursive: true, force: true }));
    const env = {
      ...process.env,
      HOME: dataParent,
      NOCODE_PLATFORM: platform,
      ...(platform === 'claude'
        ? { CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_DATA: dataRoot }
        : { PLUGIN_ROOT: pluginRoot, PLUGIN_DATA: dataRoot }),
    };
    const providerEntry = join(pluginRoot, 'skills', 'using-nocode', 'scripts', 'providers', `${platform}-plugin-data`, 'scripts', 'entry.mjs');
    const prefix = platform === 'claude'
      ? [process.execPath, providerEntry, '--']
      : [process.execPath, join(pluginRoot, 'skills/using-nocode/scripts/runtime-entry.mjs'), '--', process.execPath, providerEntry, '--'];
    const sessionId = `${platform}-fresh-session`;
    const start = spawnSync(prefix[0], [
      ...prefix.slice(1), process.execPath, join(pluginRoot, 'hooks/session-open.mjs'),
    ], {
      env, input: JSON.stringify({ session_id: sessionId, cwd: REPO_ROOT }), encoding: 'utf8',
    });
    assert.equal(start.status, 0, start.stderr);
    assert.equal(JSON.parse(start.stdout).hookSpecificOutput?.hookEventName
      || (JSON.parse(start.stdout).systemMessage ? 'SessionStart' : null), 'SessionStart');
    const sessionFile = join(dataRoot, 'sessions', sessionId, 'session.json');
    assert.equal(existsSync(sessionFile), true);
    assert.equal(JSON.parse(readFileSync(sessionFile, 'utf8')).status, 'open');

    const bootstrap = spawnSync('bash', [join(pluginRoot, 'hooks/inject-nocode.sh'), 'model-nocode'], {
      env, input: JSON.stringify({ session_id: sessionId, cwd: REPO_ROOT }), encoding: 'utf8',
    });
    assert.equal(bootstrap.status, 0, bootstrap.stderr);
    const bootstrapOutput = JSON.parse(bootstrap.stdout);
    assert.match(
      bootstrapOutput.hookSpecificOutput?.additionalContext || bootstrapOutput.systemMessage,
      /nocode Capability Bootstrap/,
    );
  }
});

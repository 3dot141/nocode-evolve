import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

test('generated SessionStart failures are recorded in the project .nocode/logs directory', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'nocode-hook-log-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const pluginRoot = join(REPO_ROOT, 'plugins', 'codex', 'nocode');
  const result = spawnSync('bash', [join(pluginRoot, 'hooks/inject-nocode.sh'), 'model-nocode'], {
    cwd: pluginRoot,
    env: {
      ...process.env,
      NOCODE_PLATFORM: 'codex',
      PLUGIN_ROOT: pluginRoot,
      NOCODE_CONTEXT_BUDGET_FILE: join(workspace, 'missing-context-budget.json'),
    },
    input: JSON.stringify({ cwd: workspace, session_id: 'must-not-be-logged' }),
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  const logFile = join(workspace, '.nocode', 'logs', 'session-start.log');
  assert.equal(existsSync(logFile), true);
  const log = readFileSync(logFile, 'utf8');
  assert.match(log, /event=start .*segment=model-nocode/);
  assert.match(log, /ENOENT: .*missing-context-budget\.json/);
  assert.match(log, /event=failure .*exit_code=[1-9]\d*/);
  assert.doesNotMatch(log, /must-not-be-logged/);
});

test('an unwritable diagnostics path does not turn a successful SessionStart into a failure', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'nocode-hook-log-blocked-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  writeFileSync(join(workspace, '.nocode'), 'blocks directory creation');
  const pluginRoot = join(REPO_ROOT, 'plugins', 'codex', 'nocode');
  const result = spawnSync('bash', [join(pluginRoot, 'hooks/inject-nocode.sh'), 'model-nocode'], {
    cwd: pluginRoot,
    env: { ...process.env, NOCODE_PLATFORM: 'codex', PLUGIN_ROOT: pluginRoot },
    input: JSON.stringify({ cwd: workspace }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).systemMessage, /nocode Capability Bootstrap/);
  assert.equal(readFileSync(join(workspace, '.nocode'), 'utf8'), 'blocks directory creation');
});

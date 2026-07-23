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
    const prefix = [process.execPath, join(pluginRoot, 'runtime/plugin-data-entry.mjs'), '--'];
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

    const bootstrap = spawnSync('bash', [join(pluginRoot, 'hooks/inject-nocode.sh'), 'model-about'], {
      env, input: JSON.stringify({ session_id: sessionId, cwd: REPO_ROOT }), encoding: 'utf8',
    });
    assert.equal(bootstrap.status, 0, bootstrap.stderr);
    assert.ok(JSON.parse(bootstrap.stdout).hookSpecificOutput?.additionalContext
      || JSON.parse(bootstrap.stdout).systemMessage);
  }
});

test('generated SessionStart failures are recorded in the project .nocode/logs directory', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'nocode-hook-log-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const pluginRoot = join(REPO_ROOT, 'plugins', 'codex', 'nocode');
  const result = spawnSync('bash', [join(pluginRoot, 'hooks/inject-nocode.sh'), 'model-about'], {
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
  assert.match(log, /event=start .*segment=model-about/);
  assert.match(log, /ENOENT: .*missing-context-budget\.json/);
  assert.match(log, /event=failure .*exit_code=[1-9]\d*/);
  assert.doesNotMatch(log, /must-not-be-logged/);
});

test('an unwritable diagnostics path does not turn a successful SessionStart into a failure', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'nocode-hook-log-blocked-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  writeFileSync(join(workspace, '.nocode'), 'blocks directory creation');
  const pluginRoot = join(REPO_ROOT, 'plugins', 'codex', 'nocode');
  const result = spawnSync('bash', [join(pluginRoot, 'hooks/inject-nocode.sh'), 'model-about'], {
    cwd: pluginRoot,
    env: { ...process.env, NOCODE_PLATFORM: 'codex', PLUGIN_ROOT: pluginRoot },
    input: JSON.stringify({ cwd: workspace }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).systemMessage);
  assert.equal(readFileSync(join(workspace, '.nocode'), 'utf8'), 'blocks directory creation');
});

test('generated Codex hook resolves the injector from PLUGIN_ROOT when cwd is the workspace', () => {
  const pluginRoot = join(REPO_ROOT, 'plugins', 'codex', 'nocode');
  const hooks = JSON.parse(readFileSync(join(pluginRoot, 'hooks', 'hooks.json'), 'utf8'));
  const commands = hooks.hooks.SessionStart[0].hooks
    .map((hook) => hook.command)
    .filter((command) => /inject-nocode\.sh" model-about(?: \d+)?$/.test(command));
  assert.ok(commands.length >= 1);
  const context = commands.map((command) => {
    assert.match(command, /^bash "\$\{PLUGIN_ROOT\}\/hooks\/inject-nocode\.sh" model-about(?: \d+)?$/);
    const result = spawnSync(command, {
      cwd: REPO_ROOT,
      env: { ...process.env, NOCODE_PLATFORM: 'codex', PLUGIN_ROOT: pluginRoot },
      input: JSON.stringify({ cwd: REPO_ROOT }),
      encoding: 'utf8',
      shell: true,
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).systemMessage;
  }).join('\n');
  assert.match(context, /# 平台原生调用/);
  assert.match(context, /语义搜索默认由当前会话/);
});

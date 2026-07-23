import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  countProxyProcesses,
  inspectCodex,
  parsePluginList,
  scheduleRestart,
} from '../skills/codex-restart/scripts/codex-restart.mjs';

function commandFixture(overrides = {}) {
  const outputs = new Map([
    ['codex doctor --json', {
      exitCode: 1,
      stdout: JSON.stringify({
        overallStatus: 'warning',
        checks: {
          'app_server.status': {
            details: {
              mode: 'persistent',
              status: 'running',
              settings: '/tmp/codex/settings.json (file)',
              'pid file': '/tmp/codex/app-server.pid (file)',
              'app-server version': '0.145.0',
            },
          },
        },
      }),
      stderr: '',
    }],
    ['codex app-server daemon version', {
      exitCode: 0,
      stdout: JSON.stringify({ status: 'running', appServerVersion: '0.145.0' }),
      stderr: '',
    }],
    ['codex plugin list', {
      exitCode: 0,
      stdout: [
        'PLUGIN                STATUS              VERSION  PATH',
        'nocode@nocode-market  installed, enabled  17.1.0   /tmp/nocode',
      ].join('\n'),
      stderr: '',
    }],
    ['ps -axo pid=,ppid=,command=', {
      exitCode: 0,
      stdout: [
        '4181 4038 /Users/me/.local/bin/codex app-server proxy',
        '87981 1 /Users/me/.codex/codex app-server --remote-control --listen unix://',
        '10961 7735 rg codex app-server proxy',
      ].join('\n'),
      stderr: '',
    }],
    ['osascript -e application "Codex" is running', {
      exitCode: 0,
      stdout: 'true\n',
      stderr: '',
    }],
  ]);
  for (const [key, value] of Object.entries(overrides)) outputs.set(key, value);
  return async (argv) => outputs.get(argv.join(' ')) ?? {
    exitCode: 127,
    stdout: '',
    stderr: 'unexpected command',
  };
}

test('inspect parses valid doctor JSON even when doctor exits nonzero', async () => {
  const result = await inspectCodex({
    runCommand: commandFixture(),
    readFile: async (file) => {
      if (file.endsWith('settings.json')) {
        return JSON.stringify({
          remoteControlEnabled: true,
          accessToken: 'must-not-leak',
          nested: { refreshToken: 'must-not-leak-either' },
        });
      }
      return JSON.stringify({
        pid: 59892,
        processStartTime: 'Thu Jul 23 17:30:31 2026',
      });
    },
  });

  assert.deepEqual(result.daemon, {
    mode: 'persistent',
    status: 'running',
    version: '0.145.0',
    pid: 59892,
  });
  assert.deepEqual(result.remoteControl, { enabled: true });
  assert.deepEqual(result.connections, { proxyCount: 1 });
  assert.deepEqual(result.app, { status: 'running' });
  assert.deepEqual(result.plugin, {
    name: 'nocode@nocode-market',
    status: 'installed, enabled',
    version: '17.1.0',
    path: '/tmp/nocode',
  });
  assert.ok(result.errors.some((error) => error.check === 'doctor'));
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak|accessToken|refreshToken/);
});

test('inspect degrades independent failures to unknown and structured errors', async () => {
  const result = await inspectCodex({
    runCommand: commandFixture({
      'codex doctor --json': { exitCode: 2, stdout: 'not json', stderr: 'secret-token' },
      'codex app-server daemon version': { exitCode: 1, stdout: '', stderr: 'offline' },
      'codex plugin list': { exitCode: 1, stdout: '', stderr: 'offline' },
      'ps -axo pid=,ppid=,command=': { exitCode: 1, stdout: '', stderr: 'offline' },
      'osascript -e application "Codex" is running': { exitCode: 1, stdout: '', stderr: 'offline' },
    }),
    readFile: async () => {
      throw new Error('secret-token');
    },
  });

  assert.deepEqual(result.daemon, {
    mode: 'unknown',
    status: 'unknown',
    version: null,
    pid: null,
  });
  assert.deepEqual(result.remoteControl, { enabled: 'unknown' });
  assert.deepEqual(result.connections, { proxyCount: null });
  assert.deepEqual(result.app, { status: 'unknown' });
  assert.equal(result.plugin.status, 'unknown');
  assert.ok(result.errors.length >= 5);
  assert.doesNotMatch(JSON.stringify(result), /secret-token|offline/);
});

test('countProxyProcesses only counts commands whose executable launches app-server proxy', () => {
  assert.equal(countProxyProcesses([
    '501 4181 4038 /Users/me/.local/bin/codex app-server proxy',
    '501 87981 1 /Users/me/codex app-server --remote-control --listen unix://',
    '501 10961 7735 grep app-server proxy',
    '501 10962 7735 /bin/zsh -lc ps | rg codex app-server proxy',
    '501 10963 7735 codex app-server proxy --verbose',
  ].join('\n')), 2);
});

test('parsePluginList returns not-found without guessing fields', () => {
  assert.deepEqual(parsePluginList('PLUGIN STATUS VERSION PATH\nother@market installed 1 /tmp/other'), {
    name: 'nocode@nocode-market',
    status: 'not-found',
    version: null,
    path: null,
  });
});

test('restart refuses to spawn without immediate confirmation', async () => {
  let spawned = false;
  await assert.rejects(
    scheduleRestart({
      confirmed: false,
      listProcesses: async () => '',
      spawnCommand: () => {
        spawned = true;
      },
    }),
    /--confirmed/,
  );
  assert.equal(spawned, false);
});

test('confirmed restart submits only the official detached command and returns a receipt', async () => {
  const calls = [];
  const child = new EventEmitter();
  child.unref = () => {
    calls.push(['unref']);
  };

  const receiptPromise = scheduleRestart({
    confirmed: true,
    codexPath: '/opt/codex',
    listProcesses: async () => [
      '1 2 /opt/codex app-server proxy',
      '3 4 /opt/codex app-server proxy',
    ].join('\n'),
    spawnCommand: (command, args, options) => {
      calls.push([command, args, options]);
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });

  assert.deepEqual(await receiptPromise, {
    schemaVersion: 1,
    action: 'restart',
    status: 'scheduled',
    proxyCount: 2,
  });
  assert.deepEqual(calls, [
    ['/opt/codex', ['app-server', 'daemon', 'restart'], {
      detached: true,
      stdio: 'ignore',
    }],
    ['unref'],
  ]);
});

test('restart reports a pre-spawn error and never returns scheduled', async () => {
  const child = new EventEmitter();
  child.unref = () => assert.fail('unref must not run after spawn failure');

  const receiptPromise = scheduleRestart({
    confirmed: true,
    listProcesses: async () => '',
    spawnCommand: () => {
      queueMicrotask(() => child.emit('error', new Error('ENOENT')));
      return child;
    },
  });

  await assert.rejects(receiptPromise, /failed to submit restart command/);
});

test('skill keeps daemon-only submission separate from full App reload', () => {
  const skill = readFileSync(
    new URL('../skills/codex-restart/SKILL.md', import.meta.url),
    'utf8',
  );

  assert.match(skill, /scripts\/codex-restart\.mjs/);
  assert.match(skill, /RESTART_HELPER" inspect/);
  assert.match(skill, /RESTART_HELPER" restart --confirmed/);
  assert.match(skill, /> Restart command submitted\./);
  assert.match(skill, /Do not wait, poll, reconnect, verify, inspect again/);
  assert.match(skill, /Full App reload instructions/);
  assert.doesNotMatch(skill, /Verify after reconnection/);
  assert.doesNotMatch(skill, /managed app-server daemon and fully restart Codex App now/);
});

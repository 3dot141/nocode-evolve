import { test } from 'node:test';
import assert from 'node:assert/strict';
import { killCommands, start, status } from './portal-cli.mjs';

test('start: 以 pnpm --filter 起 portal，并注入端口/USER_CLIENT/BROWSER env', () => {
  const fakeChild = {};
  const seen = {};
  const r = start({
    webDir: '/repo',
    spawn: (label, cmd, args, options) => {
      seen.label = label;
      seen.cmd = cmd;
      seen.args = args;
      seen.cwd = options.cwd;
      seen.env = options.env;
      return fakeChild;
    },
  });
  assert.equal(r, fakeChild);
  assert.equal(seen.label, 'portal');
  assert.equal(seen.cmd, 'pnpm');
  assert.deepEqual(seen.args, ['--filter', '@jsy/portal-react', 'dev']);
  assert.equal(seen.cwd, '/repo');
  assert.equal(seen.env.VITE_DEV_SERVER_PORT, '10002');
  assert.equal(seen.env.USER_CLIENT, 'localDebugger');
  assert.equal(seen.env.BROWSER, 'none');
});

test('killCommands 只清 portal 端口，不碰 web/agents/server', () => {
  const cmds = killCommands({ ports: { portal: 10002 } });
  const flat = cmds.map((c) => c.join(' '));
  assert.ok(flat.some((s) => s.includes('tcp:10002')));
  assert.ok(!flat.some((s) => s.includes('tcp:10001')), '不该碰 web 端口');
  assert.ok(!flat.some((s) => s.includes('telemetry')), '不该碰 agents');
});

test('status: 按 portal 端口探测 up/pid', async () => {
  const seen = [];
  const s = await status({
    ports: { portal: 10002 },
    probes: {
      tcpOpen: async (port) => { seen.push(['tcp', port]); return true; },
      pidOnPort: (port) => { seen.push(['pid', port]); return '4242'; },
    },
  });
  assert.deepEqual(s, { name: 'portal', port: 10002, up: true, pid: '4242' });
  assert.deepEqual(seen, [['tcp', 10002], ['pid', 10002]]);
});

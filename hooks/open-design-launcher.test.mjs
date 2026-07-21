import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  OpenDesignLaunchError, launchOpenDesign, resolveOpenDesignLaunch,
} from '../core/domains/design/providers/open-design/scripts/launch.mjs';

function fixture(t, { layout = true, namespace = `test-${process.pid}-${Date.now()}` } = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'open-design-home-'));
  const app = path.join(home, 'Applications/Open Design.app');
  if (layout) {
    const helper = path.join(app, 'Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper');
    const cli = path.join(app, 'Contents/Resources/app/prebundled/daemon/daemon-cli.mjs');
    mkdirSync(path.dirname(helper), { recursive: true });
    mkdirSync(path.dirname(cli), { recursive: true });
    writeFileSync(helper, 'helper');
    writeFileSync(cli, 'cli');
  } else mkdirSync(app, { recursive: true });
  mkdirSync(path.join(home, 'Library/Application Support/Open Design/namespaces', namespace, 'data'), {
    recursive: true,
  });
  const ipc = path.join('/tmp/open-design/ipc', namespace, 'daemon.sock');
  mkdirSync(path.dirname(ipc), { recursive: true });
  writeFileSync(ipc, 'socket');
  t.after(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(path.join('/tmp/open-design/ipc', namespace), { recursive: true, force: true });
  });
  return { home, app, namespace };
}

test('launcher resolves exact layout-v1 argv/env from override and ~/Applications', (t) => {
  const value = fixture(t);
  for (const env of [
    { NOCODE_OPEN_DESIGN_APP_PATH: value.app, NOCODE_OPEN_DESIGN_NAMESPACE: value.namespace },
    { NOCODE_OPEN_DESIGN_NAMESPACE: value.namespace },
  ]) {
    const launch = resolveOpenDesignLaunch({ env, home: value.home });
    assert.match(launch.command, /Open Design Helper$/);
    assert.match(launch.args[0], /prebundled\/daemon\/daemon-cli\.mjs$/);
    assert.equal(launch.args[1], 'mcp');
    assert.equal(launch.env.ELECTRON_RUN_AS_NODE, '1');
    assert.match(launch.env.OD_DATA_DIR, new RegExp(`${value.namespace}/data$`));
    assert.match(launch.env.OD_SIDECAR_IPC_PATH, new RegExp(`${value.namespace}/daemon\\.sock$`));
    assert.equal(launch.shell, false);
  }
});

test('launcher forwards only required host variables and never plugin or credential state', (t) => {
  const value = fixture(t);
  const launch = resolveOpenDesignLaunch({
    home: value.home,
    env: {
      HOME: value.home, PATH: '/safe/bin', TMPDIR: '/safe/tmp', LANG: 'en_US.UTF-8',
      NOCODE_OPEN_DESIGN_APP_PATH: value.app, NOCODE_OPEN_DESIGN_NAMESPACE: value.namespace,
      NOCODE_PLUGIN_DATA: '/private/nocode', CODEX_PLUGIN_DATA: '/private/codex',
      CLAUDE_PLUGIN_DATA: '/private/claude', PLUGIN_DATA: '/private/native',
      NOCODE_ROUTE_KEY: 'route-secret', API_TOKEN: 'api-secret', CUSTOM_SECRET: 'custom-secret',
    },
  });
  assert.deepEqual({ HOME: launch.env.HOME, PATH: launch.env.PATH, TMPDIR: launch.env.TMPDIR,
    LANG: launch.env.LANG }, {
    HOME: value.home, PATH: '/safe/bin', TMPDIR: '/safe/tmp', LANG: 'en_US.UTF-8',
  });
  for (const key of [
    'NOCODE_PLUGIN_DATA', 'CODEX_PLUGIN_DATA', 'CLAUDE_PLUGIN_DATA', 'PLUGIN_DATA',
    'NOCODE_ROUTE_KEY', 'API_TOKEN', 'CUSTOM_SECRET', 'NOCODE_OPEN_DESIGN_APP_PATH',
    'NOCODE_OPEN_DESIGN_NAMESPACE',
  ]) assert.equal(Object.hasOwn(launch.env, key), false, key);
});

test('launcher probes the system Applications directory before the user Applications directory', (t) => {
  const value = fixture(t);
  const systemApplications = mkdtempSync(path.join(os.tmpdir(), 'open-design-system-apps-'));
  t.after(() => rmSync(systemApplications, { recursive: true, force: true }));
  const systemApp = path.join(systemApplications, 'Open Design.app');
  renameSync(value.app, systemApp);
  const launch = resolveOpenDesignLaunch({
    env: { NOCODE_OPEN_DESIGN_NAMESPACE: value.namespace }, home: value.home, systemApplications,
  });
  assert.ok(launch.command.startsWith(systemApp));
});

test('launcher fails with stable errors and never searches a changed layout', (t) => {
  assert.throws(() => resolveOpenDesignLaunch({
    env: { NOCODE_OPEN_DESIGN_APP_PATH: '/definitely/missing/Open Design.app' },
    home: '/definitely/missing',
  }),
    (error) => error instanceof OpenDesignLaunchError && error.code === 'OD_APP_NOT_FOUND');
  const broken = fixture(t, { layout: false });
  assert.throws(() => resolveOpenDesignLaunch({
    env: { NOCODE_OPEN_DESIGN_APP_PATH: broken.app, NOCODE_OPEN_DESIGN_NAMESPACE: broken.namespace },
    home: broken.home,
  }), (error) => error.code === 'OD_LAYOUT_UNSUPPORTED');
  assert.throws(() => resolveOpenDesignLaunch({
    env: { NOCODE_OPEN_DESIGN_NAMESPACE: '../bad' }, home: broken.home,
  }), (error) => error.code === 'OD_NAMESPACE_INVALID');
});

test('launcher reports unavailable data and IPC with stable codes', (t) => {
  const noData = fixture(t);
  rmSync(path.join(noData.home, 'Library/Application Support/Open Design/namespaces', noData.namespace, 'data'), {
    recursive: true, force: true,
  });
  assert.throws(() => resolveOpenDesignLaunch({
    env: { NOCODE_OPEN_DESIGN_APP_PATH: noData.app, NOCODE_OPEN_DESIGN_NAMESPACE: noData.namespace },
    home: noData.home,
  }), (error) => error.code === 'OD_DATA_DIR_UNAVAILABLE');

  const noIpc = fixture(t);
  rmSync(path.join('/tmp/open-design/ipc', noIpc.namespace), { recursive: true, force: true });
  assert.throws(() => resolveOpenDesignLaunch({
    env: { NOCODE_OPEN_DESIGN_APP_PATH: noIpc.app, NOCODE_OPEN_DESIGN_NAMESPACE: noIpc.namespace },
    home: noIpc.home,
  }), (error) => error.code === 'OD_IPC_UNAVAILABLE');
});

test('launcher treats spawn errors and missing or non-zero exits as handshake failures', (t) => {
  const value = fixture(t);
  const options = {
    env: { NOCODE_OPEN_DESIGN_APP_PATH: value.app, NOCODE_OPEN_DESIGN_NAMESPACE: value.namespace },
    home: value.home,
  };
  for (const child of [{ error: new Error('spawn') }, { status: null }, { status: 7 }]) {
    assert.throws(() => launchOpenDesign(options, () => child),
      (error) => error.code === 'OD_HANDSHAKE_FAILED');
  }
  assert.equal(launchOpenDesign(options, () => ({ status: 0 })), 0);
});

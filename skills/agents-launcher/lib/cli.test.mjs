import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './cli.mjs';

const catalog = {
  workspaceIds: ['ui', 'agents', 'full'],
  serviceIds: ['docker', 'agents', 'server', 'web'],
};

test('默认 workspace 与 flags 兼容', () => {
  const args = parseArgs(['--no-web', '--css-watch', '--yes'], catalog);
  assert.equal(args.workspace, 'ui');
  assert.deepEqual(args.disabled, ['web']);
  assert.equal(args.cssWatch, true);
  assert.equal(args.yes, true);
});

test('workspace 值来自 catalog', () => {
  assert.equal(
    parseArgs(['--workspace=agents'], catalog).workspace,
    'agents',
  );
  assert.throws(
    () => parseArgs(['--workspace=ghost'], catalog),
    /\[topology\] 未知 workspace: ghost（可选 ui \| agents \| full）/,
  );
});

test('四个 no-service flag 只形成 disabled 投影', () => {
  assert.deepEqual(
    parseArgs([
      '--workspace=full',
      '--no-docker',
      '--no-agents',
      '--no-server',
      '--no-web',
    ], catalog).disabled,
    ['docker', 'agents', 'server', 'web'],
  );
});

test('未知 no-service flag fail-loud', () => {
  assert.throws(
    () => parseArgs(['--no-shell'], catalog),
    /\[topology\] 未知 service: shell/,
  );
});

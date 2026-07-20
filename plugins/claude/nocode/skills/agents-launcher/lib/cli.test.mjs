import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './cli.mjs';

test('默认 workspace=ui → 只起 web+agents', () => {
  const a = parseArgs([]);
  assert.equal(a.workspace, 'ui');
  assert.deepEqual(a.services, { web: true, agents: true, docker: false, server: false });
});

test('workspace=agents → 加 docker', () => {
  assert.deepEqual(parseArgs(['--workspace=agents']).services, { web: true, agents: true, docker: true, server: false });
});

test('workspace=full → 全开', () => {
  assert.deepEqual(parseArgs(['--workspace=full']).services, { web: true, agents: true, docker: true, server: true });
});

test('--no-web 裁剪，--dry-run / --css-watch 标志', () => {
  const a = parseArgs(['--workspace=full', '--no-web', '--dry-run', '--css-watch']);
  assert.equal(a.services.web, false);
  assert.equal(a.dryRun, true);
  assert.equal(a.cssWatch, true);
});

test('--yes 跳过确认标志', () => {
  assert.equal(parseArgs(['--yes']).yes, true);
  assert.equal(parseArgs([]).yes, false);
});

test('未知 workspace 抛错', () => {
  assert.throws(() => parseArgs(['--workspace=bogus']), /workspace/);
});

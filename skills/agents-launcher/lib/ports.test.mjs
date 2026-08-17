import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORTS } from './ports.mjs';

test('PORTS 用现状默认值', () => {
  assert.deepEqual(PORTS, { agents: 8070, server: 8081, web: 10001, portal: 10002 });
});

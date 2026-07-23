import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  abandonHandoff, completeHandoff, handoffStatus, openHandoff,
} from '../scripts/handoff-state.mjs';
import { closeSession, openSession } from '../scripts/session-state.mjs';

function root(t) {
  const value = mkdtempSync(path.join(os.tmpdir(), 'nocode-handoff-state-'));
  t.after(() => rmSync(value, { recursive: true, force: true }));
  return value;
}

test('handoff generations are idempotent, terminal, and session isolated', (t) => {
  const dataRoot = root(t);
  openSession({ sessionId: 'one', workspace: '/work/one' }, { dataRoot });
  openSession({ sessionId: 'two', workspace: '/work/two' }, { dataRoot });
  const timestamps = [
    '2026-07-21T00:00:00.000Z', '2026-07-21T00:01:00.000Z',
    '2026-07-21T00:02:00.000Z', '2026-07-21T00:03:00.000Z',
  ];
  const now = () => new Date(timestamps.shift());

  const first = openHandoff({
    sessionId: 'one', handoffId: 'build-to-verify', from: 'build', to: 'verify', summary: 'ready',
  }, { dataRoot, now });
  assert.equal(first.generation, 1);
  assert.equal(first.status, 'active');
  assert.deepEqual(openHandoff({ sessionId: 'one', handoffId: 'build-to-verify' }, {
    dataRoot, now,
  }), first);
  assert.throws(() => openHandoff({ sessionId: 'one', handoffId: 'other' }, { dataRoot, now }),
    (error) => error.code === 'HANDOFF_ACTIVE');
  assert.equal(completeHandoff({
    sessionId: 'one', handoffId: first.handoffId, generation: first.generation,
  }, { dataRoot, now }).status, 'completed');

  const second = openHandoff({ sessionId: 'one', handoffId: 'build-to-verify' }, { dataRoot, now });
  assert.equal(second.generation, 2);
  assert.throws(() => abandonHandoff({
    sessionId: 'one', handoffId: second.handoffId, generation: second.generation, reason: '',
  }, { dataRoot, now }), (error) => error.code === 'HANDOFF_REASON_REQUIRED');
  const abandoned = abandonHandoff({
    sessionId: 'one', handoffId: second.handoffId, generation: second.generation, reason: 'scope changed',
  }, { dataRoot, now });
  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.reason, 'scope changed');
  assert.throws(() => completeHandoff({
    sessionId: 'one', handoffId: second.handoffId, generation: second.generation,
  }, { dataRoot, now }), (error) => error.code === 'HANDOFF_TRANSITION_INVALID');

  assert.equal(handoffStatus({ sessionId: 'one' }, { dataRoot }).handoffs.length, 2);
  assert.deepEqual(handoffStatus({ sessionId: 'two' }, { dataRoot }).handoffs, []);
});

test('active handoff blocks session close and direct operations remain explicit', (t) => {
  const dataRoot = root(t);
  openSession({ sessionId: 'bridge', workspace: '/work/bridge' }, { dataRoot });
  const opened = openHandoff({
    sessionId: 'bridge', handoffId: 'define-to-design', from: 'define', to: 'design',
  }, { dataRoot });
  assert.equal(opened.status, 'active');
  assert.throws(() => closeSession({ sessionId: 'bridge' }, { dataRoot }),
    (error) => error.code === 'SESSION_BUSY');
  assert.equal(completeHandoff({
    sessionId: 'bridge', handoffId: opened.handoffId, generation: opened.generation,
  }, { dataRoot }).status, 'completed');
  assert.doesNotThrow(() => closeSession({ sessionId: 'bridge' }, { dataRoot }));
});

test('handoff state requires an existing open session and exact generation', (t) => {
  const dataRoot = root(t);
  assert.throws(() => openHandoff({ sessionId: 'missing', handoffId: 'x' }, { dataRoot }),
    (error) => error.code === 'SESSION_NOT_FOUND');
  openSession({ sessionId: 'closed', workspace: '/work/closed' }, { dataRoot });
  closeSession({ sessionId: 'closed' }, { dataRoot });
  assert.throws(() => openHandoff({ sessionId: 'closed', handoffId: 'x' }, { dataRoot }),
    (error) => error.code === 'HANDOFF_SESSION_CLOSED');
});

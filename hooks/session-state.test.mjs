import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  cleanupSession, closeSession, openSession, readSession, SessionStateError,
} from '../scripts/session-state.mjs';

function root(t) {
  const value = mkdtempSync(path.join(os.tmpdir(), 'nocode-session-state-'));
  t.after(() => rmSync(value, { recursive: true, force: true }));
  return value;
}

test('session lifecycle is isolated by explicit session id', (t) => {
  const dataRoot = root(t);
  assert.deepEqual(openSession({ sessionId: 'one', workspace: '/work/a' }, { dataRoot }), {
    sessionId: 'one', workspace: '/work/a', status: 'open',
  });
  openSession({ sessionId: 'two', workspace: '/work/b' }, { dataRoot });
  closeSession({ sessionId: 'one' }, { dataRoot });
  assert.equal(readSession('one', { dataRoot }).status, 'closed');
  assert.equal(readSession('two', { dataRoot }).status, 'open');
  assert.throws(() => openSession({ sessionId: '../escape', workspace: '/x' }, { dataRoot }),
    (error) => error instanceof SessionStateError && error.code === 'SESSION_ID_INVALID');
  assert.throws(() => openSession({ sessionId: 'relative', workspace: 'relative/work' }, { dataRoot }),
    (error) => error.code === 'SESSION_WORKSPACE_INVALID');
  assert.throws(() => readSession('not-in-this-root', { dataRoot }),
    (error) => error.code === 'SESSION_NOT_FOUND');
});

test('session close refuses active handoff or running workflow state', (t) => {
  const dataRoot = root(t);
  openSession({ sessionId: 'busy', workspace: '/work' }, { dataRoot });
  const sessionDir = path.join(dataRoot, 'sessions', 'busy');
  writeFileSync(path.join(sessionDir, 'handoff.json'), JSON.stringify({
    sessionId: 'busy', workspace: '/work',
    handoffs: [{ status: 'active' }],
  }));
  assert.throws(() => closeSession({ sessionId: 'busy' }, { dataRoot }),
    (error) => error.code === 'SESSION_BUSY');
  writeFileSync(path.join(sessionDir, 'handoff.json'), JSON.stringify({
    sessionId: 'busy', workspace: '/work', handoffs: [{ status: 'completed' }],
  }));
  mkdirSync(path.join(sessionDir, 'workflow'));
  writeFileSync(path.join(sessionDir, 'workflow', 'run.json'), JSON.stringify({ status: 'running' }));
  assert.throws(() => closeSession({ sessionId: 'busy' }, { dataRoot }),
    (error) => error.code === 'SESSION_BUSY');
  assert.throws(() => cleanupSession({ sessionId: 'busy', retentionMs: 0 }, { dataRoot }),
    (error) => error.code === 'SESSION_BUSY');
});

test('cleanup observes retention and never falls back to a workspace or global session', (t) => {
  const dataRoot = root(t);
  const otherRoot = root(t);
  openSession({ sessionId: 'kept', workspace: '/work/kept' }, { dataRoot });
  closeSession({ sessionId: 'kept' }, { dataRoot });
  const keptDir = path.join(dataRoot, 'sessions', 'kept');
  assert.equal(cleanupSession({ sessionId: 'kept', retentionMs: 60_000 }, {
    dataRoot, nowMs: Date.now(),
  }).status, 'closed');
  assert.equal(existsSync(keptDir), true);

  const stateFile = path.join(keptDir, 'session.json');
  const old = new Date(Date.now() - 120_000);
  utimesSync(stateFile, old, old);
  assert.equal(cleanupSession({ sessionId: 'kept', retentionMs: 60_000 }, {
    dataRoot, nowMs: Date.now(),
  }).status, 'closed');
  assert.equal(existsSync(keptDir), false);

  openSession({ sessionId: 'elsewhere', workspace: '/work/other' }, { dataRoot: otherRoot });
  assert.throws(() => readSession('elsewhere', { dataRoot }), (error) => error.code === 'SESSION_NOT_FOUND');
});

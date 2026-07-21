#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { openSession } from '../scripts/session-state.mjs';
import { detectPlatform, encodeSessionContext } from './lib/hook-codecs.mjs';

export function openFromHook(payload, { open = openSession } = {}) {
  const sessionId = payload?.session_id || payload?.sessionId;
  const workspace = payload?.cwd || payload?.workspace;
  if (typeof sessionId !== 'string' || !sessionId) {
    throw Object.assign(new Error('STATE_SESSION_REQUIRED: SessionStart requires a session id'), {
      code: 'STATE_SESSION_REQUIRED',
    });
  }
  if (typeof workspace !== 'string' || !workspace) {
    throw Object.assign(new Error('STATE_WORKSPACE_REQUIRED: SessionStart requires a workspace'), {
      code: 'STATE_WORKSPACE_REQUIRED',
    });
  }
  return open({ sessionId, workspace });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const state = openFromHook(JSON.parse(readFileSync(0, 'utf8')));
    const output = encodeSessionContext(
      `NOCODE_SESSION_ID=${state.sessionId}\nNOCODE_WORKSPACE=${state.workspace}`,
      detectPlatform(),
    );
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      code: error.code || 'STATE_SESSION_OPEN_FAILED',
      message: error.message || 'SessionStart state initialization failed',
    })}\n`);
    process.exitCode = 2;
  }
}

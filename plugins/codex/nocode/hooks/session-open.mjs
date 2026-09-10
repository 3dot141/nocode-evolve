#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { openSession } from '../scripts/session-state.mjs';
import { detectPlatform, encodeSessionContext } from './lib/hook-codecs.mjs';

export function openFromHook(payload, { open = openSession } = {}) {
  const sessionId = payload?.session_id || payload?.sessionId;
  // CodeBuddy 的 SessionStart payload 不带 cwd/workspace (只有 session_id / session /
  // transcript_path / source)，缺字段时退回进程 cwd —— 与 inject-nocode.sh、
  // pretooluse-guard.mjs 的兜底顺序一致，避免 platform 少给一个字段就整体阻塞。
  const workspace = payload?.cwd || payload?.workspace || process.cwd();
  if (typeof sessionId !== 'string' || !sessionId) {
    throw Object.assign(new Error('STATE_SESSION_REQUIRED: SessionStart requires a session id'), {
      code: 'STATE_SESSION_REQUIRED',
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

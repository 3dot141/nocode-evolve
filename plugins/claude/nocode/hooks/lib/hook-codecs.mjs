export function detectPlatform(env = process.env) {
  if (env.NOCODE_PLATFORM === 'claude' || env.NOCODE_PLATFORM === 'codex'
    || env.NOCODE_PLATFORM === 'qoder' || env.NOCODE_PLATFORM === 'pi') {
    return env.NOCODE_PLATFORM;
  }
  if (env.QODER_PLUGIN_ROOT) return 'qoder';
  return env.PLUGIN_ROOT ? 'codex' : 'claude';
}

export function encodePretoolDecision(decision, platform) {
  if (!decision) return null;
  // All supported platforms accept this PreToolUse schema. A systemMessage fallback
  // would turn deny into an advisory warning and make safety gates fail open.
  if (decision.effect === 'deny') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: decision.reason,
      },
    };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: decision.context,
    },
  };
}

export function encodeSessionContext(content, platform) {
  if (platform === 'codex') return { systemMessage: content };
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: content,
    },
  };
}

export function encodeStopDecision(decision, platform) {
  if (!decision) return null;
  if (platform === 'codex' || platform === 'qoder') {
    return { continue: false, stopReason: decision.reason };
  }
  return { decision: 'block', reason: decision.reason };
}

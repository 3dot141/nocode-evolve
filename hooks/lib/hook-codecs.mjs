export function detectPlatform(env = process.env) {
  if (env.NOCODE_PLATFORM === 'claude' || env.NOCODE_PLATFORM === 'codex') {
    return env.NOCODE_PLATFORM;
  }
  return env.PLUGIN_ROOT ? 'codex' : 'claude';
}

export function encodePretoolDecision(decision, platform) {
  if (!decision) return null;
  if (platform === 'codex') {
    const prefix = decision.effect === 'deny'
      ? '[nocode 安全规则：当前 Codex Hook 无法硬阻断，请不要执行] '
      : '[nocode 规则提醒] ';
    return { systemMessage: `${prefix}${decision.context}` };
  }
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
  if (platform === 'codex') {
    return { continue: false, stopReason: decision.reason };
  }
  return { decision: 'block', reason: decision.reason };
}

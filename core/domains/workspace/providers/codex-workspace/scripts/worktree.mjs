#!/usr/bin/env node
import { workspaceProviderPlan } from '../../../../../../scripts/lib/workspace-provider.mjs';

export function plan(capability, input, options) {
  return workspaceProviderPlan('codex', capability, input, options);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [capability, raw, cwd] = process.argv.slice(2);
    process.stdout.write(`${JSON.stringify(plan(capability, JSON.parse(raw || '{}'), { cwd: cwd || process.cwd() }))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'WORKSPACE_PROVIDER_FAILED', message: error.message })}\n`);
    process.exitCode = 2;
  }
}

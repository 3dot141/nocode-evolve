#!/usr/bin/env node
import {
  cleanupSession, closeSession, openSession, readSession,
} from '../../../../../../scripts/session-state.mjs';
import {
  cleanupExecutions, createExecution, createPlan, publicExecution, readExecution, readExecutionPrivate, readPlan,
  updateExecution, updatePlan,
} from '../../../../../../scripts/workflow-state.mjs';
import {
  abandonHandoff, completeHandoff, handoffStatus, openHandoff,
} from '../../../../../../scripts/handoff-state.mjs';

export function executeStateCapability(capability, input, { dataRoot } = {}) {
  switch (capability) {
    case 'state.session.open': return openSession(input, { dataRoot });
    case 'state.session.close': return closeSession(input, { dataRoot });
    case 'state.cleanup': return cleanupSession(input, { dataRoot });
    case 'state.handoff.open': return openHandoff(input, { dataRoot });
    case 'state.handoff.complete': return completeHandoff(input, { dataRoot });
    case 'state.handoff.abandon': return abandonHandoff(input, { dataRoot });
    case 'state.handoff.status': return handoffStatus(input, { dataRoot });
    case 'state.execution.create': return publicExecution(createExecution({
      ...input.execution, sessionId: input.sessionId,
    }, { dataRoot }));
    case 'state.execution.read': return publicExecution(readExecution(input, { dataRoot }));
    case 'state.execution.recover': {
      if (typeof input?.provider !== 'string' || !input.provider) {
        throw Object.assign(new Error('execution recovery requires its provider owner'), {
          code: 'EXECUTION_PROVIDER_REQUIRED',
        });
      }
      return readExecutionPrivate(input, { dataRoot });
    }
    case 'state.execution.update': return publicExecution(updateExecution(input, { dataRoot }));
    case 'state.execution.cleanup': return cleanupExecutions(input, { dataRoot });
    case 'state.plan.create': return createPlan({
      ...input.plan, sessionId: input.sessionId,
    }, { dataRoot, planRef: input.plan.planRef });
    case 'state.plan.read': return readPlan(input, { dataRoot });
    case 'state.plan.update': return updatePlan(input, { dataRoot });
    default:
      throw Object.assign(new Error('unsupported runtime-state capability'), { code: 'STATE_CAPABILITY_UNSUPPORTED' });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [capability, raw] = process.argv.slice(2);
    const result = executeStateCapability(capability, JSON.parse(raw || '{}'), {
      dataRoot: process.env.NOCODE_PLUGIN_DATA,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'STATE_PROVIDER_ARGUMENT_INVALID' })}\n`);
    process.exitCode = 2;
  }
}

export class WorkflowControlError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

function planItems(input) {
  if (!Array.isArray(input?.items) || input.items.some((item) =>
    typeof item?.id !== 'string' || !item.id
      || typeof item.subject !== 'string' || !item.subject
      || (item.description != null && typeof item.description !== 'string')
      || !['pending', 'in_progress', 'completed'].includes(item.status))) {
    throw new WorkflowControlError('CONTROL_INPUT_INVALID', 'plan items are invalid');
  }
  return input.items.map((item) => ({
    ...item,
    markedSubject: item.handoff ? `[handoff:${item.handoff}] ${item.subject}` : item.subject,
    markedStep: `${item.handoff ? `[handoff:${item.handoff}] ` : ''}${item.subject}${item.description ? ` — ${item.description}` : ''}`,
  }));
}

export function controlProviderPlan(platform, capability, input, { structuredQuestions = true } = {}) {
  if (!['claude', 'codex'].includes(platform)) {
    throw new WorkflowControlError('CONTROL_PLATFORM_INVALID', platform);
  }
  if (capability === 'workflow.skill.invoke') {
    if (typeof input?.skill !== 'string' || !input.skill
      || !input.arguments || typeof input.arguments !== 'object' || Array.isArray(input.arguments)) {
      throw new WorkflowControlError('CONTROL_INPUT_INVALID', 'skill invocation is invalid');
    }
    return platform === 'claude'
      ? { tool: 'Skill', skill: input.skill, arguments: input.arguments }
      : { tool: 'skill', invocation: `$${input.skill}`, arguments: input.arguments };
  }
  if (capability === 'workflow.plan.create' || capability === 'workflow.plan.update') {
    if (capability === 'workflow.plan.update'
      && (typeof input?.planRef !== 'string' || !input.planRef)) {
      throw new WorkflowControlError('CONTROL_INPUT_INVALID', 'plan update requires planRef');
    }
    const items = planItems(input);
    if (platform === 'codex') {
      return {
        ...(capability.endsWith('update') ? { planRef: input.planRef } : {}),
        tool: 'update_plan',
        input: { plan: items.map((item) => ({ step: item.markedStep, status: item.status })) },
      };
    }
    return {
      ...(capability.endsWith('update') ? { planRef: input.planRef } : {}),
      tool: capability.endsWith('create') ? 'TaskCreateBatch' : 'TaskUpdateBatch',
      calls: items.map((item) => ({
        clientId: item.id,
        input: capability.endsWith('create')
          ? { subject: item.markedSubject, description: item.description || item.subject, activeForm: item.subject }
          : { status: item.status, subject: item.markedSubject },
      })),
    };
  }
  if (capability === 'workflow.decision.request') {
    if (typeof input?.question !== 'string' || !input.question || !Array.isArray(input.options)) {
      throw new WorkflowControlError('CONTROL_INPUT_INVALID', 'decision request is invalid');
    }
    if (!structuredQuestions) {
      return { tool: 'unstructured-turn-end', question: input.question, maxQuestions: 1 };
    }
    return platform === 'claude'
      ? { tool: 'AskUserQuestion', input }
      : { tool: 'request_user_input', input };
  }
  throw new WorkflowControlError('CONTROL_CAPABILITY_UNSUPPORTED', capability);
}

export function emitPlanChangeAfterSuccess(result, event, emit) {
  if (!result || result.error || result.is_error === true) return { emitted: false };
  emit(event);
  return { emitted: true };
}

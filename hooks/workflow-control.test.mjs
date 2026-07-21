import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  controlProviderPlan, emitPlanChangeAfterSuccess,
} from '../scripts/lib/workflow-control.mjs';

test('Claude and Codex control providers map Skill, plan and decision explicitly', () => {
  assert.equal(controlProviderPlan('claude', 'workflow.skill.invoke', {
    skill: 'reviewing', arguments: {},
  }).tool, 'Skill');
  const codexPlan = controlProviderPlan('codex', 'workflow.plan.update', {
    planRef: 'plan-one',
    items: [{ id: 'one', subject: 'Review', description: 'Run five-axis gate', status: 'in_progress', handoff: 'review' }],
  });
  assert.equal(codexPlan.tool, 'update_plan');
  assert.deepEqual(codexPlan.input.plan, [{
    step: '[handoff:review] Review — Run five-axis gate', status: 'in_progress',
  }]);
  assert.equal(codexPlan.planRef, 'plan-one');
  const claudePlan = controlProviderPlan('claude', 'workflow.plan.create', {
    items: [{ id: 'one', subject: 'Review', status: 'pending', handoff: 'review' }],
  });
  assert.equal(claudePlan.tool, 'TaskCreateBatch');
  assert.equal(claudePlan.calls[0].input.subject, '[handoff:review] Review');
  assert.equal(controlProviderPlan('claude', 'workflow.decision.request', {
    question: 'Choose', options: [],
  }).tool, 'AskUserQuestion');
  assert.equal(controlProviderPlan('codex', 'workflow.decision.request', {
    question: 'Choose', options: [],
  }).tool, 'request_user_input');
});

test('plan update requires the stable planRef returned by create', () => {
  assert.throws(() => controlProviderPlan('claude', 'workflow.plan.update', {
    items: [{ id: 'one', subject: 'Review', status: 'completed' }],
  }), (error) => error.code === 'CONTROL_INPUT_INVALID');
});

test('plan-change emits only after success and question fallback is one turn-end question', () => {
  const calls = [];
  assert.deepEqual(emitPlanChangeAfterSuccess({}, { action: 'complete' }, (event) => calls.push(event)), {
    emitted: true,
  });
  assert.deepEqual(emitPlanChangeAfterSuccess({ error: true }, {}, () => calls.push('bad')), {
    emitted: false,
  });
  assert.deepEqual(calls, [{ action: 'complete' }]);
  assert.deepEqual(controlProviderPlan('codex', 'workflow.decision.request', {
    question: 'Choose', options: [],
  }, { structuredQuestions: false }), {
    tool: 'unstructured-turn-end', question: 'Choose', maxQuestions: 1,
  });
});

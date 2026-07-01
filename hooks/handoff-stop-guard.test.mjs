import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayTaskState, findOpenHandoffTasks, decideStop } from './handoff-stop-guard.mjs';

// ===== transcript fixture 构造器 =====
// 每行一个 {message:{content:[...]}} 对象, 序列化成 JSONL 行。
function line(content) {
  return JSON.stringify({ message: { content } });
}

function taskCreate(id, subject, metadata) {
  return { type: 'tool_use', name: 'TaskCreate', id, input: { subject, description: '', activeForm: '', metadata } };
}

// tool_result: content 可为 string 或 [{type:'text',text}]。文本里含 `Task #<n>`。
function taskResult(toolUseId, taskNum, asArray = false) {
  const text = `Task #${taskNum} created`;
  const content = asArray ? [{ type: 'text', text }] : text;
  return { type: 'tool_result', tool_use_id: toolUseId, content };
}

function taskUpdate(taskId, status) {
  return { type: 'tool_use', name: 'TaskUpdate', id: 'toolu_upd_' + taskId, input: { taskId, status } };
}

// 一个完整的 handoff task 创建序列 (create + result), 默认 metadata:{handoff:true}, 拆成两行。
function handoffCreateLines(toolId, subject, taskNum, metadata = { handoff: true }, asArray = false) {
  return [line([taskCreate(toolId, subject, metadata)]), line([taskResult(toolId, taskNum, asArray)])];
}

// ===== replayTaskState =====

test('replayTaskState: TaskCreate(handoff) + tool_result(Task #5) 无 Update → #5 status=pending', () => {
  const lines = handoffCreateLines('toolu_a', '交接 dev-build', 5);
  const { tasks, parseStats } = replayTaskState(lines);
  assert.deepEqual(tasks['5'], { subject: '交接 dev-build', metadata: { handoff: true }, status: 'pending' });
  assert.equal(parseStats.total, 2);
  assert.equal(parseStats.parsed, 2);
  assert.ok(parseStats.toolUseSeen >= 1);
});

test('replayTaskState: tool_result content 为 [{type:text}] 数组也能提取 taskId', () => {
  const lines = handoffCreateLines('toolu_a', 's', 9, { handoff: true }, true);
  const { tasks } = replayTaskState(lines);
  assert.equal(tasks['9']?.status, 'pending');
});

test('replayTaskState: TaskUpdate 增量改 status', () => {
  const lines = [...handoffCreateLines('toolu_a', 's', 5), line([taskUpdate('5', 'completed')])];
  const { tasks } = replayTaskState(lines);
  assert.equal(tasks['5'].status, 'completed');
});

// ===== decideStop: block 路径 =====

test('decideStop: 未完成 handoff task → block', () => {
  const lines = handoffCreateLines('toolu_a', '交接 dev-build', 5);
  const out = decideStop({ transcript_path: 'x' }, lines);
  assert.ok(out);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /交接 dev-build/);
  assert.match(out.reason, /确实要停就再说一次/);
});

test('findOpenHandoffTasks: 命中活动态 handoff', () => {
  const { tasks } = replayTaskState(handoffCreateLines('toolu_a', 's', 5));
  assert.equal(findOpenHandoffTasks(tasks).length, 1);
});

// ===== W5: 唯一未竟工作门槛 =====

test('findOpenHandoffTasks: 还有其他非 handoff task 处于 pending → 不算未完成 (还没轮到)', () => {
  const lines = [
    ...handoffCreateLines('toolu_land', '阶段 8: Land', 6),
    line([taskCreate('toolu_plan', '阶段 4: Plan', {})]),
    line([taskResult('toolu_plan', 2)]),
  ];
  const { tasks } = replayTaskState(lines);
  assert.equal(findOpenHandoffTasks(tasks).length, 0);
});

test('findOpenHandoffTasks: 其他 task 都 completed，只剩 handoff task → 判定未完成 (真逼近终点)', () => {
  const lines = [
    ...handoffCreateLines('toolu_land', '阶段 8: Land', 6),
    line([taskCreate('toolu_plan', '阶段 4: Plan', {})]),
    line([taskResult('toolu_plan', 2)]),
    line([taskUpdate('2', 'completed')]),
  ];
  const { tasks } = replayTaskState(lines);
  assert.equal(findOpenHandoffTasks(tasks).length, 1);
});

// ===== decideStop: 放行路径 =====

test('decideStop: handoff task 已 completed → null (放行)', () => {
  const lines = [...handoffCreateLines('toolu_a', 's', 5), line([taskUpdate('5', 'completed')])];
  assert.equal(decideStop({ transcript_path: 'x' }, lines), null);
});

test('decideStop: handoff task 已 cancelled → null (W4 活动态白名单)', () => {
  const lines = [...handoffCreateLines('toolu_a', 's', 5), line([taskUpdate('5', 'cancelled')])];
  assert.equal(decideStop({ transcript_path: 'x' }, lines), null);
});

test('decideStop: 其他阶段仍 pending (如 devflow 中间阶段边界) → null (W5, 还没轮到)', () => {
  const lines = [
    ...handoffCreateLines('toolu_land', '阶段 8: Land', 6),
    line([taskCreate('toolu_plan', '阶段 4: Plan', {})]),
    line([taskResult('toolu_plan', 2)]),
  ];
  assert.equal(decideStop({ transcript_path: 'x' }, lines), null);
});

test('decideStop: 其他阶段都 completed，只剩 handoff task pending → block (W5, 真逼近终点)', () => {
  const lines = [
    ...handoffCreateLines('toolu_land', '阶段 8: Land', 6),
    line([taskCreate('toolu_plan', '阶段 4: Plan', {})]),
    line([taskResult('toolu_plan', 2)]),
    line([taskUpdate('2', 'completed')]),
  ];
  const out = decideStop({ transcript_path: 'x' }, lines);
  assert.ok(out);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /阶段 8: Land/);
});

test('decideStop: 无 handoff metadata 的 task → null', () => {
  const lines = handoffCreateLines('toolu_a', '普通 task', 5, {}); // metadata 无 handoff
  assert.equal(decideStop({ transcript_path: 'x' }, lines), null);
});

test('decideStop: agent_id 存在 (fork) → null (S1)', () => {
  const lines = handoffCreateLines('toolu_a', 's', 5);
  assert.equal(decideStop({ agent_id: 'sub_1', transcript_path: 'x' }, lines), null);
});

test('decideStop: stop_hook_active → null (防循环)', () => {
  const lines = handoffCreateLines('toolu_a', 's', 5);
  assert.equal(decideStop({ stop_hook_active: true, transcript_path: 'x' }, lines), null);
});

test('decideStop: 坏行混入 → 不崩, 正常处理其余 (W2)', () => {
  const lines = [
    'not json at all {{{',
    JSON.stringify({ some: 'other top-level row' }),
    ...handoffCreateLines('toolu_a', '交接 X', 5),
    '{ broken',
  ];
  const out = decideStop({ transcript_path: 'x' }, lines);
  assert.ok(out);
  assert.equal(out.decision, 'block');
});

test('decideStop: 0 tool_use (schema 漂移) → null (W3)', () => {
  // 行能 parse 但 content 里没有 tool_use
  const lines = [line([{ type: 'text', text: 'hello' }]), JSON.stringify({ foo: 1 })];
  assert.equal(decideStop({ transcript_path: 'x' }, lines), null);
});

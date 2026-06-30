#!/usr/bin/env node
// Stop hook (防跳步 Hook B): 重放 transcript 的 task 状态, 若有未完成的交接(handoff) task → block,
// 拦住 agent 在断链处停下。设计: docs/superpowers/specs/3dot141/260630-anti-skip-hook-design.md §7.2 (BF2-4) + §8。
//
// 安全姿态: 所有运行时失败一律偏向"放行"——最坏退化为"hook 不存在", 不卡死 session。
//
// transcript 真实结构 (已实测, 非设计文档 BF2 的假设字段名):
//   JSONL 每行一对象, 结构 {message:{content:[...]}}, 也可能有其他顶层行 → 容错 skip。
//   content[] 两类元素:
//     tool_use:    {type:'tool_use', name:'TaskCreate'|'TaskUpdate', id:'toolu_xxx', input:{...}}
//     tool_result: {type:'tool_result', tool_use_id:'toolu_xxx', content:<string | [{type:'text',text}]>}
//   TaskCreate.input: {subject, description, activeForm, metadata:{handoff:true}}  (metadata 在 input 里可见)
//   TaskUpdate.input: {taskId:'17', status:'completed'}  (taskId 是数字字符串)
//   taskId 关联: TaskCreate 的 tool_use 没有 taskId; 要从它对应的 tool_result (tool_use_id == TaskCreate.id)
//     的 content 文本里正则提取 `Task #(\d+)` → 得 taskId 数字字符串。
import fs from 'node:fs';

// ===== 纯函数 =====

// 把 tool_result 的 content 归一成可搜索文本 (string 或 [{type:'text',text}])。
function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
      .join('\n');
  }
  return '';
}

// 重放: 单遍扫 lines, 重建 taskId → {subject, metadata, status}。
// 返回 { tasks, parseStats:{total, parsed, toolUseSeen} }。
export function replayTaskState(lines) {
  const tasks = {}; // taskId(数字字符串) → {subject, metadata, status}
  const pending = {}; // TaskCreate tool_use.id → {subject, metadata}
  const stats = { total: 0, parsed: 0, toolUseSeen: 0 };

  for (const line of lines) {
    stats.total++;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // W2: 坏行跳过 (下游对漏读 completed 偏向放行兜)
    }
    if (!o || typeof o !== 'object') continue;
    stats.parsed++;

    const content = o.message?.content;
    if (!Array.isArray(content)) continue;

    for (const c of content) {
      if (!c || typeof c !== 'object') continue;

      if (c.type === 'tool_use') {
        stats.toolUseSeen++;
        if (c.name === 'TaskCreate') {
          pending[c.id] = {
            subject: c.input?.subject,
            metadata: c.input?.metadata || {},
          };
        } else if (c.name === 'TaskUpdate') {
          const tid = c.input?.taskId;
          if (tid != null && tasks[tid]) {
            tasks[tid].status = c.input?.status; // 增量重放 status
          }
        }
      } else if (c.type === 'tool_result') {
        const p = pending[c.tool_use_id];
        if (p) {
          // 从 result 文本提取 `Task #(\d+)` → taskId
          const m = /Task #(\d+)/.exec(resultText(c.content));
          if (m) {
            const taskId = m[1];
            tasks[taskId] = { subject: p.subject, metadata: p.metadata, status: 'pending' };
          }
        }
      }
    }
  }
  return { tasks, parseStats: stats };
}

// W4: 活动态白名单——只有 pending / in_progress 的 handoff task 才算"未完成", cancelled/completed 不拦。
export function findOpenHandoffTasks(tasks) {
  return Object.values(tasks).filter(
    (t) =>
      t.metadata?.handoff === true &&
      (t.status === 'pending' || t.status === 'in_progress'),
  );
}

// Stop decide: 有未完成交接 task → block; 否则 null (放行)。lines 可传入或由 transcript_path 读。
export function decideStop(payload, lines) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.agent_id) return null; // S1: fork/subagent 兜底, 不拦
  // 防循环: 优先用 Stop 输入的 stop_hook_active (官方文档可能有也可能没有, "存在即用")。
  // TODO(Plan 阶段实测 stop_hook_active 后定): 若该字段实测不存在, 改用 session 级标记文件
  //   (scratchpad .handoff-blocked-<session>) 兜底防 block 死循环。本版先不实现标记文件。
  if (payload.stop_hook_active) return null;

  let parsed;
  try {
    let src = lines;
    if (!src) {
      const raw = fs.readFileSync(payload.transcript_path, 'utf8');
      src = raw.split('\n').filter((l) => l.trim() !== '');
    }
    parsed = replayTaskState(src);
  } catch {
    return null; // 约束.2: 整体解析失败 → 放行, 不阻断 session
  }

  if (parsed.parseStats.toolUseSeen === 0) {
    // W3: 能 parse 但 0 个 tool_use = schema 漂移信号 → 静默失效优于误判, 放行 + canary
    console.error('handoff-stop-guard: canary stop-parsed-zero-tooluse (transcript 0 tool_use, 放行)');
    return null;
  }

  const open = findOpenHandoffTasks(parsed.tasks);
  if (open.length === 0) return null; // P2 负例: 无未完成交接 → 放行

  return {
    decision: 'block',
    reason:
      '还有交接 task 未完成：' +
      open.map((t) => t.subject).join('；') +
      '。完成交接再停；确实要停就再说一次。',
  };
}

// ===== CLI driver =====
if (import.meta.url === `file://${process.argv[1]}`) {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }
  const out = decideStop(payload);
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

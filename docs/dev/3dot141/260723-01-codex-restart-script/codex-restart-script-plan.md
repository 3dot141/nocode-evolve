# Codex Restart Helper Implementation Plan

**Goal**: 将 codex-restart 的状态检查与 daemon-only 重启提交固化为可测试脚本，并修正全局 worktree 路径。
**Architecture**: Skill 负责用户交互与即时确认，ESM helper 通过注入式 command/file/spawn seam 完成只读检查和官方 daemon restart 提交。发布脚本递归携带 helper 到 Codex，Claude 继续排除整个 Skill。
**Tech Stack**: Node.js ESM、`node:test`、Codex CLI、现有 platform compiler
**Design Doc**: `docs/dev/3dot141/260723-01-codex-restart-script/codex-restart-script-design.md`
**Test Objectives**: TO-1 至 TO-4
**Execution**: executing

## 依赖图

- Task 1（无依赖）
- Task 2（无依赖；已完成红绿验证）
- Task 3 → 依赖 Task 1
- Task 4 → 依赖 Task 1、Task 2、Task 3

## 切片策略

- Vertical：先让 `inspect` 从真实 Codex CLI 输出到稳定 JSON，解决最易漂移的解析风险。
- Vertical：再接入确认保护与 detached restart，端到端完成 daemon-only 用户路径。
- Migration：最后统一升级版本、生成发布树并验证。

## Task 1: 状态检查 CLI [Size: M]

**描述**: 新增 helper 与行为测试，使用允许列表从 doctor、daemon version、settings、进程表和 plugin list 汇总 schemaVersion 1 状态。

**验收标准**:
- [ ] 非零 doctor 只要 stdout 是合法 JSON仍可解析
- [ ] 单项失败返回 unknown/error，敏感 settings 字段不会进入输出
- [ ] proxy 精确计数且 App 可返回 running/stopped/unknown

**covers**: [P1, P4, P6, SC-1, SC-4, SC-6]
**designCovers**: [Q1, BF1, CONTRACT-1, SEC-1, TO-1]
**HITL / AFK**: AFK
**文件**:
- Create `skills/codex-restart/scripts/codex-restart.mjs`
- Create `hooks/codex-restart.test.mjs`
**依赖**: None
**验证命令**: `node --test hooks/codex-restart.test.mjs`，预期所有 inspect tests pass。

**真实改动**:

```js
export async function inspectCodex({ runCommand, readFile, listProcesses }) {
  const status = {
    schemaVersion: 1,
    daemon: { mode: 'unknown', status: 'unknown', version: null, pid: null },
    remoteControl: { enabled: 'unknown' },
    connections: { proxyCount: 0 },
    app: { status: 'unknown' },
    plugin: { name: 'nocode@nocode-market', status: 'not-found', version: null, path: null },
    errors: [],
  };
  // 每个检查独立捕获错误，只把允许列表字段写进 status。
  return status;
}
```

## Task 2: 同级扁平 worktree 路径 [Size: S]

**描述**: 校准全局 `using-git-worktrees` Skill，使路径只从项目根、父目录和扁平分支名确定。

**验收标准**:
- [x] 不再推荐 `.worktrees/`、`worktrees/` 或 `~/.config/superpowers/worktrees/`
- [x] `feat/codex-restart-helper` 推导为 `nocode-evolve-feat_codex-restart-helper`

**covers**: [兼容性.worktree-path]
**designCovers**: [Q3, TO-4]
**HITL / AFK**: AFK
**文件**:
- Modify `skills/using-git-worktrees/SKILL.md`
- Modify `hooks/workflow-consumers.test.mjs`
**依赖**: None
**验证命令**: `node --test hooks/workflow-consumers.test.mjs`，预期 18 tests pass。

**真实改动**:

```bash
project_parent="$(dirname "$project_root")"
project_name="$(basename "$project_root")"
branch_flat="${BRANCH_NAME//\//_}"
worktree_path="${project_parent}/${project_name}-${branch_flat}"
```

## Task 3: 已确认的 restart 提交与 Skill 交互 [Size: M]

**描述**: 在同一 helper 增加确认 guard 和 detached spawn，并将 Skill 改为 inspect → 动态后果 → 即时确认 → scheduled receipt 后结束。

**验收标准**:
- [ ] 缺少 `--confirmed` 非零退出且不 spawn
- [ ] 只提交 `codex app-server daemon restart`，options 为 detached/ignore，spawn 后 unref
- [ ] Skill 不再等待、重连或自动验证，不把 daemon-only 声称为完整 App 重载

**covers**: [P2, P3, P5, P6, SC-2, SC-3, SC-5, SC-6]
**designCovers**: [Q2, BF2, CONTRACT-2, SEC-1, LOG-1, TO-2]
**HITL / AFK**: AFK（真实 daemon 不在测试中重启）
**文件**:
- Modify `skills/codex-restart/scripts/codex-restart.mjs`
- Modify `hooks/codex-restart.test.mjs`
- Modify `skills/codex-restart/SKILL.md`
- Modify `skills/codex-restart/agents/openai.yaml`
**依赖**: Task 1
**验证命令**: `node --test hooks/codex-restart.test.mjs`，预期 restart tests pass。

**真实改动**:

```js
const child = spawn(codexPath, ['app-server', 'daemon', 'restart'], {
  detached: true,
  stdio: 'ignore',
});
await waitForSpawn(child);
child.unref();
return { schemaVersion: 1, action: 'restart', status: 'scheduled', proxyCount };
```

## Task 4: 17.2.0 发布同步 [Size: S]

**描述**: 增加平台边界断言、升级版本并由现有 generator 同步 Claude/Codex 发布树。

**验收标准**:
- [ ] Codex tree 包含 helper，Claude tree 不包含 codex-restart
- [ ] metadata 与两个 manifest 均为 17.2.0
- [ ] vendor、skills、platform check 与全量 hooks tests 通过

**covers**: [发布.双平台, SC-1, SC-6]
**designCovers**: [MIG-1, TO-3]
**HITL / AFK**: AFK
**文件**:
- Modify `hooks/compile.platform.test.mjs`
- Modify `plugin/metadata.json`
- Generate `plugins/claude/nocode/`
- Generate `plugins/codex/nocode/`
**依赖**: Task 1、Task 2、Task 3
**验证命令**:
- `node scripts/vendor-sync.mjs --check`，预期一致
- `node scripts/package.platform.mjs`，预期生成成功
- `node scripts/package.platform.mjs --check`，预期无 drift
- `node --test 'hooks/*.test.mjs'`，预期全部通过

**真实改动**:

```js
assert.equal(tree.has('skills/codex-restart/scripts/codex-restart.mjs'), false);
// Codex required:
'skills/codex-restart/scripts/codex-restart.mjs',
```

```json
{ "version": "17.2.0" }
```

## Checkpoint

Task 3 涉及 daemon 生命周期与敏感 settings 边界，完成后先跑定向测试；Task 4 后跑全量验证并复核 diff。

## Design → Task Coverage Matrix

| Design ID | Task | 处理方式 |
|---|---|---|
| Q1, BF1, CONTRACT-1, TO-1 | Task 1 | implement |
| Q3, TO-4 | Task 2 | implement |
| Q2, BF2, CONTRACT-2, SEC-1, LOG-1, TO-2 | Task 3 | implement |
| MIG-1, TO-3 | Task 4 | implement |

Plan Validation：P1–P6、SC-1–SC-6 与所有 required Design ID 均有覆盖；依赖无环；每个 task 可独立验证。

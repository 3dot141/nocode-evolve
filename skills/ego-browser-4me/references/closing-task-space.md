# 关闭 task space 的完整方案

主文件只给「默认用哪个」，这里展开为什么、以及各种边界情况。

## 四种关闭方式对照

| 意图 | 调用 | 空间是否消失 | 何时用 |
|---|---|---|---|
| 结果要给用户看 | `await task.finish({ keep: ["p1"] })` | 否，页面留给用户 | 任务产出需要用户接着操作 |
| 任务完成，什么都不用留 | `await task.finish({ keep: [] })` | **不一定**，见下 | 默认选择 |
| 确保空间消失 | `await completeTaskSpace(id, { keep: false })` | 是 | 需要干净收场时 |
| 千万别用 | `ego.deleteSpaces({ ids })` | 会弹确认框，无人值守时不返回 | 永远 |

## `finish({ keep: [] })` 为什么有时留着空间

源码 `package/ego-browser/src/page-model.ts:1064-1090`：

```ts
const hasProtectedTabs = tabs.some((tab) => {
  const managed = managedByTarget.get(tab.targetId);
  return !managed || managed.openedBy === "unknown";
});

if (options.keep !== "all" && options.keep.length === 0 && !hasProtectedTabs) {
  await this.#services.closeTaskSpace();       // 空间真的消失
  return { closedSpace: true, ... };
}

// 存在 protected tab → 走这里
for (const label of labelsToClose) await this.page(label).close();
await this.#services.completeTaskSpace();      // 空间保留，ownership 翻成 user
return { closedSpace: false, ... };
```

protected tab 的判定：**未托管的 tab**，或 `openedBy === "unknown"` 的 tab。`release(label)` 把页面还给用户后就会变成这种状态。

**这是设计行为，不是失败。** 用户手上有标签页时不该被强制关掉。

## 为什么 `completeTaskSpace` 能保证删掉

`package/ego-browser/src/helpers.ts:444-456`：

```ts
} else {                                   // keep: false
  if (match.ownership === "user") {
    await claimResolvedTaskSpace(match, "completeTaskSpace");
  } else {
    await selectTaskSpace(ego, match, "completeTaskSpace");
  }
  await invokeEgo("completeTaskSpace", () => ego.closeTaskSpace());
}
return { done: true };
```

**无条件调用 `ego.closeTaskSpace()`**，没有 protected tab 判断。

## 空名空间会让 helper 报 not found

`helpers.ts:568-572`：

```ts
function normalizeTaskSpace(space) {
  const taskId = space?.taskId ?? space?.name ?? space?.id;
  if (taskId === undefined || taskId === null || taskId === "") {
    return null;                     // 空串 → 整条丢弃
  }
  ...
}
```

空间 `name` 与 `taskId` 都为 `""` 时：

```
原生 ego.listTaskSpaces()      → 可见 [{id:8, name:"", taskId:""}]
helper listTaskSpaces()        → 过滤后为空
helper completeTaskSpace(8)    → 抛 "task space not found: 8"
```

绕过：直接用原生 API。

```js
ego.useTaskSpace(8);
await ego.closeTaskSpace();     // 返回 "8 task space closed."
```

`ownership === "user"` 时先 `await ego.claimTaskSpace(id)`（`claim` 不选中空间，要再 `useTaskSpace`）。

## 批量清理的正确顺序

```js
// 必须用原生 listTaskSpaces，helper 版会漏空名空间
const native = await ego.listTaskSpaces();
for (const sp of native.taskSpaces) {
  if (sp.ownership === "user") await ego.claimTaskSpace(sp.id);
  ego.useTaskSpace(sp.id);
  console.log(await ego.closeTaskSpace());
}
```

`closeTaskSpace` 返回 `"<id> task space closed."` 是成功信号。等 1-2 秒再复查，删除不是同一 tick 生效。

```js
await new Promise((r) => setTimeout(r, 2000));
console.log((await ego.listTaskSpaces()).taskSpaces.length);   // 应为 0
```

## 为什么不能用 deleteSpaces

接口形状：

```
ego.deleteSpaces(options)
  options: { scope: 'all' | 'task' } | { ids: number[] }   互斥
  返回:    { deletedSpaceIds: number[], skippedRunningSpaceIds: number[] }
```

官方 API Reference：「If the user cancels closing, the method returns an `EGO_OPERATION_FAILED` error object.」

它会**弹确认对话框**。无人值守的 agent 流程里既不返回也不报错，表现为脚本挂死（实测两次 2 分钟超时）。

另外它**不在开源仓库里**——`grep -rn "deleteSpaces"` 在 citrolabs/ego-lite @ `aecc583` 零命中，官方 `docs/native-bindings-api.md` 记录的 17 个原生方法也没有它。属于未文档化的原生方法，行为不在契约保证范围内。

# 已知坑速查

按现象查表。查到后**回到主文件继续**，或按表里的指引转入对应 reference。

- 空间关闭的完整方案 → [closing-task-space.md](closing-task-space.md)
- profile 清理与环境重置 → [profile-cleanup.md](profile-cleanup.md)

## profile 与导入

| 现象 | 原因 | 处理 |
|---|---|---|
| 一直重定向到登录页 | 该 profile 没有此站会话 | 换另一个 `browser_source`；或请用户先在那台浏览器登录一次再导入 |
| 导入后 profile 数量没变 | 导入的档案已存在 | 用 `--profile <dir_name>` 指名具体档案 |
| 删了 profile 目录，`profiles()` 里还在 | `Local State` 的 `info_cache` 把条目补回去 | 先退出 ego 再删目录 + 删 `info_cache`，见 [profile-cleanup.md](profile-cleanup.md) |
| 删完重启，又冒出一个更大的 profile | 来源浏览器仍可导入，ego 启动时按标记重新导入 | 用 `import list` 确认来源；不打算复用就别重启，见 [profile-cleanup.md](profile-cleanup.md) |
| 不知道新 profile 叫什么 | 编号 = `profiles_created` 计数器值 | 用 `profiles()` 查 `id`，别猜 |

## task space

| 现象 | 原因 | 处理 |
|---|---|---|
| `profileId only applies when creating…` | 空间已存在 | 换新空间名（用秒级时间戳命名天然避开） |
| `finish({ keep: [] })` 调完空间还在列表 | 空间含未托管或 `openedBy: "unknown"` 的 tab | 改用 `completeTaskSpace(id, { keep: false })` |
| `completeTaskSpace(id, …)` 报 `task space not found` | 该空间 `name` 为空串，helper 的 `normalizeTaskSpace` 会丢弃它 | 用原生 `ego.useTaskSpace(id)` + `ego.closeTaskSpace()` |
| 批量清理后仍有空间残留 | 用了 helper 版 `listTaskSpaces()`，它漏空名空间 | 改用原生 `ego.listTaskSpaces()` 列全量 |
| `deleteSpaces` 调用后不返回 | 它弹确认框等用户点击 | 不要用它；用 `closeTaskSpace` / `completeTaskSpace` |

详见 [closing-task-space.md](closing-task-space.md)。

## 其他

| 现象 | 原因 | 处理 |
|---|---|---|
| `gh:` 请求 GitHub Pages API 报 `Resource not accessible by integration` | `pages` **不是合法 OAuth scope**（`invalid_scope`）；该端点只认带 admin 权限的 PAT | 走网页端操作，不要反复试 API |
| `osascript` 退出 ego 无效 | 实测两次被拒，原因未查明 | 用 `kill -TERM $(pgrep -f "ego lite.app/Contents/MacOS/ego lite")` |

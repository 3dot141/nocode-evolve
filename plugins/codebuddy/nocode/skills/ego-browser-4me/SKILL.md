---
name: ego-browser-4me
description: Use when 消息里出现 ego-browser / ego lite / ego-lite（含询问工具自身能力：profile 管理、环境重置、task space 清理、版本与安装升级），或即将做任何浏览器自动化任务——打开站点、抓取页面数据、截图、访问后台、下载登录态资源、站点测试/dogfooding，包括看起来是公开、无需登录的站点（profile 选错会让登录态问题伪装成权限问题）。Not for 纯 HTTP 请求（curl/fetch 可直接完成）、桌面应用自动化、或用户点名 ego-browser 之外的其他浏览器工具时。
---

# ego-browser-4me

**任何浏览器自动化任务的默认入口。** 先按本 skill 选定正确的 profile，再按 `ego-browser` 的指南执行操作。

问到 ego 工具本身（有哪些 profile、怎么删 profile、怎么重置环境、task space 怎么清）也走本 skill——「profile 清理」章节就是 profile 删除与环境清理的完整方案，不要先去 `ego-browser` 里翻。

**两条清理规则的边界，别混：**

| 对象 | 何时清 |
|---|---|
| task space | **每次任务结束就清**（见「关闭 task space」），默认动作 |
| profile | **仅在用户明确说要清时**（见「profile 清理」），不主动做 |

浏览器操作本身（API、选择器、截图、CDP 逃逸口）全部以 `ego-browser` 为准：

> 动手前先 `Skill(nocode:ego-browser)` 读它的使用指南；本 skill 只补它没有的那一段
> ——「怎么拿到用户自己的登录态」。

为什么要先走这一步：`ego-browser` 的默认 profile 常常**不是**你要的那个——
它可能是另一个人格，或是另一台浏览器导入的。直接拿它访问站点，结果是一直停在登录页；
而这个现象看起来像「没权限」，容易误判成账号问题。

看起来公开的站点也可能踩：同一个 URL 在不同 profile 下可能是登录态、地域、账号权益不同的两份结果，
而失败时页面通常不会报错——你会拿到一份看起来正常、实际不是目标身份的数据。
所以「这次不需要登录」的预判本身不可靠，先确认 profile 是更便宜的顺序。

所以固定顺序：**先按本 skill 把 profile 换对，再按 `ego-browser` 的指南执行任务。**

## 流程

### 1. 列出可导入的来源

```bash
ego-browser import list
```

输出里每个 `browser_source` 是一台浏览器，其 `profiles[]` 是它下面的用户档案
（`dir_name` 用于下一步的 `--profile`）。

### 2. 导入

```bash
ego-browser import --browser <edge|chrome|brave|...> [--profile <dir_name>] --no-default
```

- **`--no-default` 必须加**：不加会把 ego 设成系统默认浏览器，静默改掉用户的系统设置。
- 省略 `--profile` 时导入该浏览器的默认档案。

### 3. 确认新 profile 的 id

```bash
ego-browser nodejs -e 'console.log(JSON.stringify(await profiles(), null, 2))'
```

返回 `[{ id: "Profile N", name: "…", isDefault }]`。

**这一步不能跳**：`id` 是下一步唯一的锚点，名字（`name`）只是显示用的标签。
凭名字猜 id 会直接重演「登录态缺失」，且没有报错提示。

### 4. 用该 id 新建任务空间

```js
const task = await taskSpace("<topic>-<yymmdd>-<hhmmss>", { profileId: "Profile N" });
```

**命名固定为 `<topic>-<yymmdd>-<hhmmss>`**，例如 `asc-upload-261026-134512`。

- `topic`：2–8 字符的 kebab-case 任务主题，可检索（`asc-upload`、`jira-triage`）
- `yymmdd`：**创建当日**日期
- `hhmmss`：24 小时制，本地时间，补零

为什么带时分秒：`taskSpace()` 撞名时两种结果都不是你要的——不传 `profileId` 会**静默复用**旧空间（继承它残留的 tab、登录态、页面状态，任务从半途开始且无提示）；传了 `profileId` 则直接报错 `profileId only applies when creating a new task space`。秒级时间戳让每次创建都落在新名字上，两种撞名都不会发生，也省掉先查名是否被占这一步。

```bash
date "+%y%m%d-%H%M%S"   # 取当前时间戳
```

`profileId` 只在**创建**空间时生效。对已存在的空间再传会直接报错：

```
taskSpace profileId only applies when creating a new task space; "xxx" already exists
```

→ 换一个没被占用过的空间名，不要试图修改旧空间。

### 5. 先验证登录态，再执行任务

```js
await page.goto("https://<目标站>");
console.log(await page.evaluate(() => ({ url: location.pathname, title: document.title })));
```

- 落在登录页 → 这个 profile 没有该站会话，**回第 1 步换个来源**
- 正常进入 → 至此前置条件就绪，**回到 `Skill(nocode:ego-browser)` 按它的指南执行**
  （本 skill 不重复描述 snapshot / click / evaluate 的用法，那些以它为准）

### 6. 任务结束关闭空间

按「关闭 task space」章节执行。默认 `await task.finish({ keep: [] })`；要确保空间消失就用 `completeTaskSpace(id, { keep: false })`。**别把空间留到下次。**

空间关掉就够了，**profile 不要动**——登录态下次还要用，除非用户明确要求清理。

## 关闭 task space（任务结束时必做）

任务做完就关空间，不要留在那里——每留一个就占一份内存、一个窗口，而且下次同名创建会踩到复用陷阱。这一步**放在任务的最后一次脚本里做完**，不要留到「下次」。

### 按意图选关闭方式

| 意图 | 调用 | 空间是否消失 |
|---|---|---|
| 结果要给用户看 | `await task.finish({ keep: ["p1"] })` | 否，页面留给用户 |
| 任务完成，什么都不用留 | `await task.finish({ keep: [] })` | **不一定**，见下 |
| 确保空间消失 | `await completeTaskSpace(id, { keep: false })` | 是 |
| 千万别用 | `ego.deleteSpaces({ ids })` | 会弹确认框，无人值守时不返回 |

### `finish({ keep: [] })` 为什么有时留着空间

空间里只要有未托管的 tab、或 `openedBy === "unknown"` 的 tab（`release()` 还给用户的页面就是这种），`finish` 会走另一条分支：关掉 agent 页面后只把 `ownership` 从 `agent` 翻成 `user`，空间留在列表里。**这是设计行为，不是失败。**

`completeTaskSpace(id, { keep: false })` 没有这个判断，无条件调用 `closeTaskSpace()`。任务结束时想干净收场，用它。

### 空间名为空时 helper 找不到它

`completeTaskSpace()` / `taskSpace()` 依赖名字解析。实测遇到 `name: ""` 的空间时，helper 版 `listTaskSpaces()` 会把它直接过滤掉（`helpers.ts` 的 `normalizeTaskSpace` 用 `name` 组装 `taskId`，空串被判无效返回 `null`），于是 `completeTaskSpace(8, …)` 报 `task space not found: 8`，而原生 `ego.listTaskSpaces()` 明明能看到它。

用原生 API 直接关：

```js
ego.useTaskSpace(id);
await ego.closeTaskSpace();     // 返回 "<id> task space closed."
```

空间是 user-owned 时先 `await ego.claimTaskSpace(id)`。

### 批量清理时的顺序

先查再关，别盲删：

```js
const native = await ego.listTaskSpaces();
const ids = native.taskSpaces.map((x) => x.id);
for (const id of ids) {
  const sp = native.taskSpaces.find((x) => x.id === id);
  if (sp.ownership === "user") await ego.claimTaskSpace(id);
  ego.useTaskSpace(id);
  await ego.closeTaskSpace();
}
```

用原生 `ego.listTaskSpaces()` 而不是 helper 版——helper 会漏掉空名空间，导致你以为清完了其实还剩。

## 已知坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 一直重定向到登录页 | 该 profile 没有此站会话 | 换另一个 browser_source；或请用户先在那台浏览器登录一次再导入 |
| `profileId only applies when creating…` | 空间已存在 | 换新空间名 |
| 导入后 profile 数量没变 | 导入的档案已存在 | 用 `--profile` 指名具体档案 |
| 删了 profile 目录，`profiles()` 里还在 | 索引没删干净时，ego 用 `Local State` 的 `info_cache` 把条目补回去；带 `ego_import_source_browser` 标记的条目还会在下次导入时按来源重建 | 先退出 ego 再删目录 + 删 `info_cache` 条目，见「profile 清理」 |
| 删完重启，又冒出一个更大的 profile | 来源浏览器仍可导入，ego 启动时会按标记重新导入 | 用 `import list` 确认来源；不打算复用就别重启 ego，见「profile 清理」第 4 步 |
| `finish({ keep: [] })` 调完空间还在列表 | 空间含未托管或 `openedBy: "unknown"` 的 tab，走了 `completeTaskSpace` 分支 | 改用 `completeTaskSpace(id, { keep: false })`，见「关闭 task space」 |
| `completeTaskSpace(id, …)` 报 `task space not found` | 该空间 `name` 为空串，helper 的 `normalizeTaskSpace` 会把它丢弃 | 用原生 `ego.useTaskSpace(id)` + `ego.closeTaskSpace()` |
| 批量清理后仍有空间残留 | 用了 helper 版 `listTaskSpaces()`，它漏掉空名空间 | 改用原生 `ego.listTaskSpaces()` 列全量 |
| `deleteSpaces` 调用后脚本挂住不返回 | 它弹确认框等用户点击，无人值守时不返回也不报错 | 不要用它清理；用 `closeTaskSpace` / `completeTaskSpace` |
| `gh:` 请求 GitHub Pages API 报 `Resource not accessible by integration` | `pages` **不是合法 OAuth scope**（`invalid_scope`）；该端点只认带 admin 权限的 PAT | 走网页端操作，不要反复试 API |

## 不要

- **用默认 profile 去开需登录的站点** —— 默认 profile 往往是另一个账号，表现为莫名停在登录页。
- **导入时省掉 `--no-default`** —— 会改掉用户的系统默认浏览器。
- **不验证就点按钮** —— 在登录页上找元素，得到的全是「找不到」。
- **把本 skill 当成 `ego-browser` 的完整替代** —— 这里只有换 profile 这一段；
  API 用法、选择器语法、截图与 CDP 逃逸口一律去 `ego-browser` 查，不要凭记忆写。

## profile 清理（仅在用户明确要求时）

**默认不清理 profile。** 任务结束只关 task space（见上一章），profile 留着——它装着登录态，下次任务还要接着用。导入一次 3.5GB，删了再导要重来一遍。

只有用户**明确说了要清理**（「清掉这个 profile」「删了我不要了」「重置环境」这类），才往下走。判断不准就问一句，不要自己决定删。

### 先确认三件事

```js
const profiles = await profiles();          // 现存哪些
const native = await ego.listTaskSpaces();  // 谁在占用
```

1. **要删哪个** —— 按 `id` 确认（`Profile N`），名字可能重复
2. **谁在占用** —— 有 space 用着它就先关空间，否则删不干净
3. **是不是唯一** —— 删到 0 个 profile 前先问用户，可能需要先建一个

### 1. 关掉占用它的 task space

见「关闭 task space」章节。**用原生 `ego.listTaskSpaces()` 列全量**，helper 版会漏空名空间。

### 2. 退出 ego

```bash
osascript -e 'quit app "ego lite"'
```

`osascript` 有时被拒（实测两次都失败），兜底用 SIGTERM：

```bash
kill -TERM $(pgrep -f "ego lite.app/Contents/MacOS/ego lite")
```

**这一步不能省。** ego 运行时会用内存副本周期性把 `info_cache` 写回 `Local State` —— 只删目录或只改索引都会被覆盖回去，表现为「删了还在」。

### 3. 删目录 + 删索引

两处都要删：只删目录 → 索引残留；只删索引 → 磁盘不回收。

```bash
P=~/Library/Application\ Support/Citro\ Labs/ego\ lite
rm -rf "$P/Profile N"
```

```python
import json, os

p = os.path.expanduser("~/Library/Application Support/Citro Labs/ego lite/Local State")
KEEP = "Profile K"          # 要保留的那个 id
TARGET = "Profile N"        # 要删的那个 id

d = json.load(open(p))
prof = d["profile"]

prof["info_cache"].pop(TARGET, None)                       # 条目本身
for key in ("profiles_order", "last_active_profiles"):     # 顺序与活跃列表
    if prof.get(key):
        prof[key] = [x for x in prof[key] if x != TARGET]
if prof.get("last_used") == TARGET:                        # 默认指向
    prof["last_used"] = KEEP

json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
```

`info_cache` 条目里带 `ego_import_source_browser` 等标记，条目删掉标记一并消失。

### 4. 重启前先想清楚

```bash
open -a "ego lite"
```

**重启可能把你刚删的东西造回来。** ego 启动时若发现来源浏览器还可导入，会按 `ego_import_source_*` 标记重新导入一个（实测：`--clear-existing-profiles` 后重启，`new_profile_dirs: []` 但仍生成了新 profile，因为新 profile 是重启后应用自己导的，不在 CLI 流程里）。

| 情况 | 做法 |
|---|---|
| 用户还要继续用 ego | 重启，然后复查 `profiles()`，出现新 profile 属于预期 |
| 用户暂时不用 | **跳过重启**，下次手动打开时再处理 |
| 想彻底不再导入 | 只能从源头断：在源浏览器里退出该 profile，或删掉它 |

### 5. 验证

```js
console.log(await profiles());
console.log(await ego.listTaskSpaces());
```

确认目标 profile 已消失、剩下的那个仍是用户要的。若冒出新 profile，向用户说明这是重新导入的结果，问是否要再清一次——不要默默反复删。

### 绝不主动做的事

- 任务结束时顺手清 profile
- 因为「看起来是一次性导入」就自行删除
- 没用 `--clear-existing-profiles` 之外的途径批量删（那个 flag 会清掉**所有** profile，包括用户要留的）

## 一次性导入的复用

为某次任务临时导入的 profile，任务结束后**仍然默认保留**。下次要用直接取它的 `id` 建新空间，不必重新导入。

只有用户说过「这个导入是一次性的、用完清掉」且**在任务结束时再次确认**，才走上一章的清理流程。

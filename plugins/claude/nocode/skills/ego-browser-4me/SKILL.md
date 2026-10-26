---
name: ego-browser-4me
description: Use before ANY browser automation task — 打开站点、抓取页面数据、截图、访问后台、下载登录态资源、站点测试/dogfooding，包括看起来是公开、无需登录的站点（profile 选错会让登录态问题伪装成权限问题）。Not for 纯 HTTP 请求（curl/fetch 可直接完成）、桌面应用自动化、或用户点名其他浏览器工具时。
---

# ego-browser-4me

**任何浏览器自动化任务的默认入口。** 先按本 skill 选定正确的 profile，再按 `ego-browser` 的指南执行操作。

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
const task = await taskSpace("<任务名>-<yymmdd>", { profileId: "Profile N" });
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

## 已知坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 一直重定向到登录页 | 该 profile 没有此站会话 | 换另一个 browser_source；或请用户先在那台浏览器登录一次再导入 |
| `profileId only applies when creating…` | 空间已存在 | 换新空间名 |
| 导入后 profile 数量没变 | 导入的档案已存在 | 用 `--profile` 指名具体档案 |
| 删了 profile 目录，`profiles()` 里还在 | ego 运行中，它用内存副本把索引写回 `Local State` | 先退出 ego 再改索引，见「收尾」 |
| `gh:` 请求 GitHub Pages API 报 `Resource not accessible by integration` | `pages` **不是合法 OAuth scope**（`invalid_scope`）；该端点只认带 admin 权限的 PAT | 走网页端操作，不要反复试 API |

## 不要

- **用默认 profile 去开需登录的站点** —— 默认 profile 往往是另一个账号，表现为莫名停在登录页。
- **导入时省掉 `--no-default`** —— 会改掉用户的系统默认浏览器。
- **不验证就点按钮** —— 在登录页上找元素，得到的全是「找不到」。
- **把本 skill 当成 `ego-browser` 的完整替代** —— 这里只有换 profile 这一段；
  API 用法、选择器语法、截图与 CDP 逃逸口一律去 `ego-browser` 查，不要凭记忆写。

## 收尾

任务完成后**主动清理**，否则每跑一次就多一个 3.5GB 的 profile 目录。

### 1. 先查有没有别的工作空间在用

```js
const spaces = await listTaskSpaces();
```

返回每项含 `{ id, name, profileId, profileName, ownership }`。

**如果还有别的空间在跑**（`spaces` 非空，且不是自己正在关的那个），
先问用户：「还有 N 个工作空间在运行（列出名字），清理 profile 会中断它们，确认继续？」
得到肯定答复再往下。没有其它空间 → 直接执行。

### 2. 关掉本次的任务空间

```js
await task.finish({ keep: [] });
```

`finish()` 只能调用一次，之后不能再操作它的任何 Page。

### 3. 退出 ego

```bash
osascript -e 'quit app "ego lite"'
```

**这一步不能省。** ego 运行时会用内存里的副本周期性把 `info_cache` 写回
`Local State` —— 只删目录或只改索引，都会被它覆盖回去，表现为「删了还在」。

### 4. 删目录 + 删索引

```bash
P=~/Library/Application\ Support/Citro\ Labs/ego\ lite
rm -rf "$P/Profile N"
```

```python
import json, os
p = os.path.expanduser("~/Library/Application Support/Citro Labs/ego lite/Local State")
d = json.load(open(p))
d.get("profile", {}).get("info_cache", {}).pop("Profile N", None)
json.dump(d, open(p, "w"), ensure_ascii=False)
```

两处都要删：只删目录 → 索引残留，下次误用该 id 会重建一个空 profile；
只删索引 → 目录留在磁盘上，3.5GB 不回收。

### 5. 重启并验证

```bash
open -a "ego lite"
```

```js
console.log(await profiles());   // 应当只剩需要保留的那几个
```

## 复用

如果这个 profile **还会继续用**（比如每天都要访问同一个后台），就跳过收尾的
3~5 步，只做第 2 步。下次直接取它的 `id` 建新空间即可，不必重复导入。

判断依据是「一次性导入 vs 长期使用」：为某次任务临时导入的，用完就清。

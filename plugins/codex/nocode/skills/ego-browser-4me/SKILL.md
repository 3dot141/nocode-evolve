---
name: ego-browser-4me
description: "Use when a browser task needs the user's own logged-in session — App Store Connect, 飞书/Lark, 各类…"
---

# ego-browser-4me

`ego-browser` 的默认 profile 常常**没有**你要的登录态 —— 它可能是另一个人格，
或是另一台浏览器导入的。直接拿它访问需要登录的站点，结果是一直停在登录页；
而这个现象看起来像「没权限」，容易误判成账号问题。

本 skill 固定一条顺序，避免在登录页上白费功夫。

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
- 正常进入 → 才开始执行用户的实际任务

## 已知坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 一直重定向到登录页 | 该 profile 没有此站会话 | 换另一个 browser_source；或请用户先在那台浏览器登录一次再导入 |
| `profileId only applies when creating…` | 空间已存在 | 换新空间名 |
| 导入后 profile 数量没变 | 导入的档案已存在 | 用 `--profile` 指名具体档案 |

## 不要

- **用默认 profile 去开需登录的站点** —— 默认 profile 往往是另一个账号，表现为莫名停在登录页。
- **导入时省掉 `--no-default`** —— 会改掉用户的系统默认浏览器。
- **不验证就点按钮** —— 在登录页上找元素，得到的全是「找不到」。

## 复用

导入过的 `Profile N` 会保留。同类任务下次直接取它的 `id`，
不必重复导入 —— 否则每跑一次就多一个 Profile，越堆越乱。

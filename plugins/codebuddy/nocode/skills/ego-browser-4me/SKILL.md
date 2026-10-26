---
name: ego-browser-4me
description: Use when 消息里出现 ego-browser / ego lite / ego-lite（含询问工具自身能力：profile 管理、环境重置、task space 清理、版本与安装升级），或即将做任何浏览器自动化任务——打开站点、抓取页面数据、截图、访问后台、下载登录态资源、站点测试/dogfooding，包括看起来是公开、无需登录的站点（profile 选错会让登录态问题伪装成权限问题）。Not for 纯 HTTP 请求（curl/fetch 可直接完成）、桌面应用自动化、或用户点名 ego-browser 之外的其他浏览器工具时。
---

# ego-browser-4me

**任何浏览器自动化任务的默认入口。** 先按本 skill 选定正确的 profile，再按 `ego-browser` 的指南执行操作。

浏览器操作本身（API、选择器、截图、CDP 逃逸口）全部以 `ego-browser` 为准——动手前先 `Skill(nocode:ego-browser)`。本 skill 只补它没有的那一段：**怎么拿到用户自己的登录态**。

`ego-browser` 的默认 profile 常常**不是**你要的那个——可能是另一个人格，或是另一台浏览器导入的。直接拿它访问站点会一直停在登录页，而这个现象看起来像「没权限」，容易误判成账号问题。

看起来公开的站点也可能踩：同一个 URL 在不同 profile 下可能是登录态、地域、账号权益不同的两份结果，失败时页面通常不报错——你会拿到一份看起来正常、实际不是目标身份的数据。所以「这次不需要登录」的预判本身不可靠。

## 两条清理规则的边界

| 对象 | 何时清 |
|---|---|
| task space | **每次任务结束就清**，默认动作 |
| profile | **仅在用户明确说要清时**，不主动做 |

## 流程

### 1. 选 profile

```bash
ego-browser import list        # 看有哪些浏览器可导入
ego-browser import --browser <edge|chrome|brave> [--profile <dir>] --no-default
```

**`--no-default` 必须加**：不加会把 ego 设成系统默认浏览器，静默改掉用户系统设置。

已经导入过就直接跳到第 2 步，不必重复导入。

### 2. 确认 profile id

```bash
ego-browser nodejs -e 'console.log(JSON.stringify(await profiles(), null, 2))'
```

**这一步不能跳**：`id` 是下一步唯一的锚点，`name` 只是显示标签，可能重复。

### 3. 建任务空间

```js
const task = await taskSpace("<topic>-<yymmdd>-<hhmmss>", { profileId: "Profile N" });
```

命名固定 `<topic>-<yymmdd>-<hhmmss>`，如 `asc-upload-261026-134512`。取时间戳：`date "+%y%m%d-%H%M%S"`。

为什么带秒：撞名时不传 `profileId` 会**静默复用**旧空间（继承残留 tab 与登录态，任务从半途开始），传了则报 `profileId only applies when creating a new task space`。秒级时间戳两种都不发生。

### 4. 验证登录态

```js
await page.goto("https://<目标站>");
console.log(await page.evaluate(() => ({ url: location.pathname, title: document.title })));
```

落在登录页 → 回第 1 步换个来源。正常进入 → 前置条件就绪，**回 `Skill(nocode:ego-browser)` 执行任务**。

### 5. 任务结束关闭空间

```js
await task.finish({ keep: [] });                      // 默认
await completeTaskSpace(id, { keep: false });         // 要确保空间消失
```

**别把空间留到下次。** profile 不要动——登录态下次还要用。

需要批量清理、空名空间、或想搞清楚 `finish` 为什么有时留着空间 → `references/closing-task-space.md`。

## 按需展开

| 场景 | 读 |
|---|---|
| 空间关不掉、批量清理、`deleteSpaces` 相关 | `references/closing-task-space.md` |
| 用户明确要求清理 profile / 重置环境 | `references/profile-cleanup.md` |
| 遇到报错或异常现象 | `references/troubleshooting.md` |

## 不要

- **用默认 profile 去开需登录的站点** —— 往往是另一个账号，表现为莫名停在登录页。
- **导入时省掉 `--no-default`** —— 会改掉用户的系统默认浏览器。
- **不验证登录态就点按钮** —— 在登录页上找元素，得到的全是「找不到」。
- **任务结束时顺手清 profile** —— 登录态会被清掉，下次任务要重新导入。
- **把本 skill 当成 `ego-browser` 的完整替代** —— API 用法、选择器、截图与 CDP 一律去 `ego-browser` 查。

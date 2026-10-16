---
name: browser-ego-default
description: >-
  任何任务需要打开、操作或自动化浏览器（访问网页、下载带登录态的资源、截图、站点测试/dogfooding、访问需登录的内部系统）时触发——默认走 Skill(nocode:ego-browser) 完成，不启动 Playwright/puppeteer/独立 headless 等替代浏览器方案；当 ego-browser 缺少目标站点登录态时，agent 自行执行 ego-browser import 从 Edge 导入登录数据（不要让用户手动登录或手动导入），导入失败按返回码排错。不触发：用户明确点名其他浏览器工具、纯 HTTP 无浏览器语义的请求（curl/fetch 直接请求）、桌面应用自动化。
skip: false
---

# 浏览器方案默认 ego-browser，登录态默认从 Edge 同步

## 默认路径

需要浏览器的任务一律先走 `Skill(nocode:ego-browser)`（taskSpace → page → goto/下载/截图等）。
不要默认开 Playwright/puppeteer/`browser` 类 MCP 或其他 headless 方案替代；仅当用户点名或 ego-browser 明确不可用时才换，并在回复中说明原因。

## 登录态缺失的处理顺序

1. **先直接尝试**：ego-browser 复用用户配置文件，残留登录态可能已够用——不要预判失败。
2. **遇到登录墙/token 缺失**（如接口返回 `Token is empty`、跳登录页）：**agent 自行执行 ego-browser 导入 Edge 登录数据**，不要让用户手动操作：
   ```bash
   ego-browser import list                        # 先查可用浏览器与 profile
   ego-browser import --browser edge [--profile <dir-name>]
   ```
   返回结构化 JSON 结果；`source_no_importable_profiles`（code 4）表示 Edge 无可导入 profile——检查 Edge 是否装有 profile 数据、ego lite 对 Edge 数据目录的磁盘访问权限，向用户说明后重试或降级。导入成功后在同一 taskSpace 重试原操作。
3. 导入后仍失败：向用户说明卡点（哪个域/哪种 token 拿不到），由用户决定手动登录或其他方案——不要静默放弃或伪造成功。

## 边界

- 纯 HTTP 请求（无浏览器语义）仍走 curl/fetch，本规则不接管。
- 用户显式要求其他浏览器工具时按用户要求执行。
- 不要主动 inspect 或选择 Ego Lite profile（遵循 ego-browser skill 自身约束）。

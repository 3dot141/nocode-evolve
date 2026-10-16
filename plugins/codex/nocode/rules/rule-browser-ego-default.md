---
name: browser-ego-default
description: >-
  任何任务需要打开、操作或自动化浏览器（访问网页、下载带登录态的资源、截图、站点测试/dogfooding、访问需登录的内部系统）时触发——默认走 Skill(nocode:ego-browser) 完成，不启动 Playwright/puppeteer/独立 headless 等替代浏览器方案；当 ego-browser 缺少目标站点登录态时，默认指引从 Edge 导入/同步登录数据到 ego lite，而不是让用户在 ego-browser 里手动重新登录。不触发：用户明确点名其他浏览器工具、纯 HTTP 无浏览器语义的请求（curl/fetch 直接请求）、桌面应用自动化。
skip: false
---

# 浏览器方案默认 ego-browser，登录态默认从 Edge 同步

## 默认路径

需要浏览器的任务一律先走 `Skill(nocode:ego-browser)`（taskSpace → page → goto/下载/截图等）。
不要默认开 Playwright/puppeteer/`browser` 类 MCP 或其他 headless 方案替代；仅当用户点名或 ego-browser 明确不可用时才换，并在回复中说明原因。

## 登录态缺失的处理顺序

1. **先直接尝试**：ego-browser 复用用户配置文件，残留登录态可能已够用——不要预判失败。
2. **遇到登录墙/token 缺失**（如接口返回 `Token is empty`、跳登录页）：指引或协助用户在 ego lite 中**从 Edge 导入登录数据**——ego lite 原生支持从 Chrome/其他浏览器导入（onboarding 的 "import data from another browser"，或 App 内设置里的导入入口）；导入完成后在同一 taskSpace 重试。
3. 导入后仍失败：向用户说明卡点（哪个域/哪种 token 拿不到），由用户决定手动登录或其他方案——不要静默放弃或伪造成功。

## 边界

- 纯 HTTP 请求（无浏览器语义）仍走 curl/fetch，本规则不接管。
- 用户显式要求其他浏览器工具时按用户要求执行。
- 不要主动 inspect 或选择 Ego Lite profile（遵循 ego-browser skill 自身约束）。

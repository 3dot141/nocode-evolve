# 配置

配置解析顺序：**shell 环境变量优先**（可在 `~/.zshenv` 等处直接 `export`，无需文件）→ env 文件兜底（默认 `~/.config/nocode/work-log.env`）。可从模板复制：

```bash
mkdir -p ~/.config/nocode && cp <插件>/skills/lark-project/worklog/work-log.env.example ~/.config/nocode/work-log.env
```

## key 失效自动抓取 SOP（2026-09-07 首测，2026-09-09 复测补 fallback；README.md 不随发布物分发，运行时读本文件）

**端点分工**：抓钥匙经 `/open_api/**`（重载后稳定重发），**提交工时继续走 `/api/worklogs` 老端点**——work-log.mjs 的时段分配/北京时间换算/校验都建在它上面，且已验证与新钥匙兼容。只有老端点出现 404/410（真废弃，非 401 过期）才需要逆向插件提交请求迁移到 open_api，不要预先迁移。key（36 位，长期有效）同网关两端口通用，已实测完全一致——任一处抓到即用。

key 过期后用 ego-browser 自动抓取，无需用户抄取。**方案 A（网络层）为主，方案 B（应用层）为 fallback**，任一成功即止：

**前置（两方案共用）**：

1. **打开工时看板**：`useOrCreateTaskSpace` → `openOrReuseTab('https://project.feishu.cn/')`（登录态继承）→ 左栏「功能」→「工时管理」。页面 URL 形如 `project.feishu.cn/{space}/meegoPlg/MII_..._board_...`。
2. **工时插件是跨域 iframe（OOPIF）**：宿主 `projectplg.feishupkg.com`，主 frame 的 `Network.enable` **抓不到**其请求——必须 `Target.getTargets` 找 `feishupkg` iframe → `Target.attachToTarget`（flatten:true）→ 对该 session `Network.enable`。
   ⚠ 这些按 session 的命令要走 **legacy 全局** `cdp(method, params, sessionId)`（方案 B 注入 patch 同理，用 `js(expr, targetId)`），事件用 `await drainEvents()` 读回（带 sessionId 标记）：v2 的 `page.cdp()` / `task.cdp()` 只接受 `{ timeout }`、没有 session 参数，照 v2 文档写会直接报 unknown option。完整写法见 ego-browser skill 的 OOPIF 段。

**方案 A · 网络层抓重载请求（主路径）**：

3. 主文档改 `iframe.src` 追加无意义 query（如 `&regrab=1`）触发插件重载；**重载后 ≤0.5s 内立即重新 `getTargets`+`attach`+`Network.enable`**（导航使旧 session 失效），再轮询事件收 `/open_api/{spaceId}/teams/all` 的请求头。
   ⚠ **时序是成败关键**：先等 1~3 秒再 attach，`teams/all` 在监听就位前已发完——表现为「只有静态资源、无 open_api」。这是 attach 晚了的竞态，**不是**「重载破坏 postMessage 握手」（2026-09-09 曾误判，复测推翻：时序正确时该请求稳定发出且插件正常渲染）。此时直接转方案 B，不要反复重载。

**方案 B · 应用层 patch + UI 触发（fallback）**——A 轮询约 15s 无 open_api 请求、或页面已渲染出工时数据（初始请求早发完）时用：

4. attach iframe session 后 `Runtime.evaluate` 注入 patch：重写 `window.fetch` **与** `XMLHttpRequest.prototype.open/setRequestHeader/send`（漏 XHR 则插件走 XHR 时抓不到），把每个请求的 `{url, headers}` 推进 `window.__caps` 数组。
5. 点 UI 触发真实请求——实测点「切换到周视图」按钮有效（触发 `POST /api/worklogs/query`，头带 key）；从 `window.__caps` 读出 `X-WORKLOG-KEY`。

**收尾（两方案共用）**：

6. **认证头是 `X-WORKLOG-KEY` 全大写**——按小写/混合大小写匹配会「看着抓到了其实没认出」。
7. **写入不回显**：key 值直接写入 `~/.zshenv`（`export FEISHU_WORKLOG_KEY=...`）与 `~/.config/nocode/work-log.env` 双处，终端只报长度与前 4 位。
8. 重跑 `submit --execute` 验证 200；完成后 `completeTaskSpace(keep:false)` 收尾。

## 必填项（唯一）

| 变量 | 含义 |
|---|---|
| `FEISHU_WORKLOG_KEY` | 工时 API 的 `x-worklog-key`（用户从工时看板请求头抄取一次，静态维护在 `.zshenv`） |

## 动态注入项（不配置，submit 前由调用方经 meegle 现查注入）

| 环境变量 | 获取方式 |
|---|---|
| `FEISHU_SPACE_ID` | `meegle workitem get <任务ID> --fields '["_all"]'` → `owned_project.key`（或 `project search`） |
| `FEISHU_USER_ID` | `meegle user me` → `user_key` |

## 可选保留项

| 变量 | 含义 |
|---|---|
| `FEISHU_WORKLOG_API` | 飞书工时 POST API 地址（以本团队真实值为准，如 `https://feishu-worklog.sre.jdydevelop.com/api/worklogs`） |

## 可选项

| 变量 | 含义 |
|---|---|

配置文件只接受一行一个 `KEY=value`；值包含空格时可用单引号或双引号包裹，不要在值后写行内注释。

Bitbucket token 只需要读取权限。配置文件不得提交到 Git，不要在聊天、日志或命令输出中打印 token 与 `FEISHU_WORKLOG_KEY`。只使用可信的 HTTPS 地址；修改 API 地址前先核对目标主机。

key 失效时按上方「key 失效自动抓取 SOP」用 ego-browser 抓取并更新两处配置。
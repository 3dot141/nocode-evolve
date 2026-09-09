# 配置

配置解析顺序：**shell 环境变量优先**（可在 `~/.zshenv` 等处直接 `export`，无需文件）→ env 文件兜底（默认 `~/.config/nocode/work-log.env`）。可从模板复制：

```bash
mkdir -p ~/.config/nocode && cp <插件>/skills/lark-project/worklog/work-log.env.example ~/.config/nocode/work-log.env
```

## key 失效自动抓取 SOP（2026-09-07 实测；README.md 不随发布物分发，运行时读本文件）

**端点分工**：抓钥匙经 `/open_api/**`（页面上唯一稳定重发的请求），**提交工时继续走 `/api/worklogs` 老端点**——work-log.mjs 的时段分配/北京时间换算/校验都建在它上面，且已验证与新钥匙兼容。只有老端点出现 404/410（真废弃，非 401 过期）才需要逆向插件提交请求迁移到 open_api，不要预先迁移。

key（36 位，长期有效，同网关 `/api/worklogs` 与 `/open_api/**` 通用）过期后用 ego-browser 自动抓取，无需用户抄取：

1. **打开工时看板**：`useOrCreateTaskSpace` → `openOrReuseTab('https://project.feishu.cn/')`（登录态继承）→ 左栏「功能」→「工时管理」。页面 URL 形如 `project.feishu.cn/{space}/meegoPlg/MII_..._board_...`。
2. **工时插件是跨域 iframe（OOPIF）**：宿主 `projectplg.feishupkg.com`，主 frame 的 `Network.enable` **抓不到**其请求——必须 `Target.getTargets` 找 `feishupkg` iframe → `Target.attachToTarget`（flatten:true）→ 对该 session `Network.enable`。
3. **触发请求**：主文档改 `iframe.src` 追加无意义 query（如 `&regrab=1`）触发插件重载，初始请求 `/open_api/{spaceId}/teams/all` 会带 key 重发（比点 UI 可靠）。
4. **认证头是 `X-WORKLOG-KEY` 全大写**——按小写/混合大小写匹配会「看着抓到了其实没认出」。
5. **写入不回显**：key 值直接写入 `~/.zshenv`（`export FEISHU_WORKLOG_KEY=...`）与 `~/.config/nocode/work-log.env` 双处，终端只报长度与前 4 位。
6. 重跑 `submit --execute` 验证 200；完成后 `completeTaskSpace(keep:false)` 收尾。

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
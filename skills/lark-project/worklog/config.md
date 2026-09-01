# 配置

配置解析顺序：**shell 环境变量优先**（可在 `~/.zshenv` 等处直接 `export`，无需文件）→ env 文件兜底（默认 `~/.config/nocode/work-log.env`）。可从模板复制：

```bash
mkdir -p ~/.config/nocode && cp <插件>/skills/lark-project/worklog/work-log.env.example ~/.config/nocode/work-log.env
```

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

key 失效时从工时看板请求头重新抄取并更新 `.zshenv`。
# 配置

默认配置文件为 `~/.codex/work-log.env`；Windows 对应 `%USERPROFILE%\.codex\work-log.env`。可从技能模板复制：

```powershell
Copy-Item .agents/skills/feishu-work-log/assets/work-log.env.example "$env:USERPROFILE\.codex\work-log.env"
```

## 必填项

| 变量 | 含义 |
|---|---|
| `BITBUCKET_BASE_URL` | Bitbucket Server HTTPS 根地址 |
| `BITBUCKET_TOKEN` | 具备仓库读取权限的个人令牌 |
| `FEISHU_WORKLOG_API` | 飞书工时 POST API 的 HTTPS 地址 |
| `FEISHU_WORKLOG_BOARD_URL` | 已登录后可打开的飞书工时看板地址 |
| `FEISHU_WORKLOG_KEY` | 每日变化的 `x-worklog-key`；刷新脚本会更新此值 |
| `FEISHU_SPACE_ID` | 飞书项目空间 ID |
| `FEISHU_USER_ID` | 工时归属用户 ID |
| `FEISHU_G_WORK_OBJECT_ID` | `g-` 任务对应的自定义工作对象 ID |

## 可选项

| 变量 | 含义 |
|---|---|
| `CHROME_PATH` | Chrome 可执行文件路径；自动探测失败时填写 |
| `CHROME_PROFILE_DIR` | 工时登录专用 Chrome profile 目录 |

配置文件只接受一行一个 `KEY=value`；值包含空格时可用单引号或双引号包裹，不要在值后写行内注释。

Bitbucket token 只需要读取权限。配置文件不得提交到 Git，不要在聊天、日志或命令输出中打印 token 与 `FEISHU_WORKLOG_KEY`。只使用可信的 HTTPS 地址；修改 API 地址前先核对目标主机。

首次刷新 key 时运行：

```powershell
node .agents/skills/feishu-work-log/scripts/refresh-worklog-key.mjs --login
```

脚本使用独立 Chrome profile，监听随机本地 DevTools 端口，只接受来自配置中工时 API 源站与路径的认证请求，写入 key 后关闭浏览器调试会话。后续可去掉 `--login` 无头刷新。

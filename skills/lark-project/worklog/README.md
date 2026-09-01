# 工时登记（worklog）

> 本目录是 lark-project 的内置工时登记能力（自 fx-data-agents 项目级 skill feishu-work-log 迁入）：
> 从 Bitbucket 已合并 PR 提取工作内容，生成可核对的北京时间工时表，用户确认后提交飞书项目。
> 脚本路径在插件内按本目录相对引用（下文 `node worklog/...` 均相对 `skills/lark-project/`）。

从 Bitbucket PR 提取工作内容，生成可核对的北京时间工时表，并在用户确认后提交飞书项目。

**核心原则**：PR 和代码改动量只能帮助识别任务与分配相对权重，不能证明实际工时。提交内容必须由用户确认，外部写入必须与最后展示的批次完全一致。

## 适用边界

- 处理 Bitbucket 已合并 PR、飞书项目工时、工作日志或工时报告。
- 仓库 `docs/work-logs/` 下的任务日志使用各仓库的 work-log 任务日志技能，不使用本能力。
- 没有实际时长或用户确认的总时长时，先询问；不要为了凑满一天自行扩充工时。

## 工作流

### 1. 配置

配置 shell 环境变量优先（`~/.zshenv` 直接 export 即可），env 文件兜底。缺项时读 [config.md](./config.md)，只帮助创建本地配置，不把凭据写入仓库。

### 2. 获取 PR 与详情

```bash
node worklog/work-log.mjs fetch --range today
node worklog/work-log.mjs details --project FX --repo agents --pr 123
```

`fetch` 支持 `today`、`yesterday`、`week`，按北京时间日期过滤并遍历 Bitbucket 分页。`details` 从 PR 标题提取 `f-`、`g-`、`m-` 任务编号，并统计新增与删除行数。

PR 没有任务编号时，展示 PR 并让用户补充映射，不猜测任务。

### 3. 分配工时

用户给出或确认总分钟数后，将待分配项保存为 JSON 数组：

```json
[
  { "taskCode": "f-6772916146", "description": "修复联动问题", "mergedAt": "2026-08-28T02:00:00.000Z", "weight": 200 },
  { "taskCode": "g-6622627363", "description": "删除冗余代码", "mergedAt": "2026-08-28T08:00:00.000Z", "weight": 360 }
]
```

```bash
node worklog/work-log.mjs allocate --input <json-path> --date 2026-08-28 --minutes 540
```

脚本按 15 分钟粒度分配，工作时段为 `09:00-12:00`、`13:30-19:30`。当天结束锚点为当前北京时间与 `19:30` 的较早者；历史日期使用 `19:30`。输出中的 `startedAtUtc` 已按北京时间减 8 小时生成，提交时原样使用。

上例的确定结果为：

| 任务编号 | 分钟 | 北京时间 | `startedAtUtc` |
|---|---:|---|---|
| `f-6772916146` | 195 | `09:00-12:00、13:30-13:45` | `2026-08-28T01:00:00.000Z` |
| `g-6622627363` | 345 | `13:45-19:30` | `2026-08-28T05:45:00.000Z` |

### 4. 展示并确认

提交前展示以下字段：任务编号、PR 标题、改动量、分钟数、北京时间区间、`startedAtUtc`。同时说明：

- 这是将写入飞书的完整批次；
- 已成功的旧记录不会自动重提；
- 用户可以修改时长、描述或任务映射。

即使用户在流程开头说“直接提交”或经理要求尽快完成，也要在实际写入前展示最终批次并获得明确确认。

### 5. 动态注入身份、预览、提交

submit 前由调用方用 meegle 现查两个身份并注入环境变量（不落配置）：

```bash
FEISHU_SPACE_ID=$(meegle workitem get <任务ID> --fields '["_all"]' --format json | 提取 owned_project.key)
FEISHU_USER_ID=$(meegle user me --format json | 提取 user_key)
```

### 6. 预览、提交

不带 `--execute` 的 `submit` 只生成预览，不访问飞书：

```bash
node worklog/work-log.mjs submit --task-code f-6772916146 --minutes 195 --started-at 2026-08-28T01:00:00.000Z --description "修复联动问题"
```

用户确认后，每次提交批次前刷新 key：

```bash
node worklog/refresh-worklog-key.mjs
```

无头刷新失败时，说明登录可能过期。先告知用户将打开专用 Chrome，再运行：

```bash
node worklog/refresh-worklog-key.mjs --login
```

按确认顺序逐条提交：

```bash
node worklog/work-log.mjs submit --task-code f-6772916146 --minutes 195 --started-at 2026-08-28T01:00:00.000Z --description "修复联动问题" --execute
```

每条记录成功后立即记录结果。任何一条失败就停止后续提交，列出已成功、失败、未执行三组；先核对飞书现状，再决定是否补交。不要全量重跑，也不要自动删除记录。

## 快速参考

| 目的 | 命令 |
|---|---|
| 查询已合并 PR | `work-log.mjs fetch --range today` |
| 查询 PR 详情 | `work-log.mjs details --project <key> --repo <slug> --pr <id>` |
| 分配工时 | `work-log.mjs allocate --input <json> --date <YYYY-MM-DD> --minutes <n>` |
| 预览提交 | `work-log.mjs submit ...` |
| 刷新认证 key | `refresh-worklog-key.mjs` |
| 实际提交 | `work-log.mjs submit ... --execute` |

## 常见错误

| 现象 | 处理 |
|---|---|
| `401` 或没有权限 | 刷新 key；无头模式失败后由用户登录专用 Chrome |
| 开始时间是未来时间 | 重新运行 `allocate`，不要手改 `Z` 时间 |
| 任务编号不合法 | 使用完整 `f-`、`g-`、`m-` 前缀编号 |
| 缺少 `FEISHU_G_WORK_OBJECT_ID` | 按配置指南补充自定义对象 ID |
| 批量提交部分失败 | 停止并按单条记录核对，不重提成功项 |

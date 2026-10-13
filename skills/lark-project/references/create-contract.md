# 创建工作项契约（按需加载）

> 触发：arguments 含创建意图（创建 bug / 缺陷 / 需求 / 任务）。meegle 通用流程（元数据收集 → 模板匹配 → STRING 协议 → create）见其创建 SOP；本文只沉淀本业务空间的实测事实，省掉现场探查。事实均标实测日期，失效时以 `meta-fields` 现场返回为准并重新沉淀。

## 1. 先定空间（消歧一次到位）

- 本团队任务号（`f-` / `g-` / `m-` 前缀）统一归属「一体化产研团队」：project_key `67d7ba04296cba3d3ece0694`。直接用 project_key；按 simple_name `b2rl2h` 查会报 ProjectMultipleMatches（存在同名空间）。
- FX（`fanruan-fx`）空间 issue 的版本关联字段挂在**空的** version 类型上——需要关联版本的工作项不要建在 FX。
- 冷启动不确定归属：任拿一个已知任务号 `workitem get --work-item-id <纯数字ID>` 看 `owned_project` 定归属。

## 2. 缺陷（issue）必填字段实测值（2026-10）

| 字段 | key | 取值事实 |
|---|---|---|
| 缺陷类型* | `template` | 迭代BUG=`2769350`、设计确认=`2768402`；其余选项 disabled |
| 业务线* | `business` | 树形选叶子 option_id，AI=`68a531d1357ee1bc6a56d0ca`；其余叶子现场 `meta-fields` 查 |
| 任务维度* | `field_f8a626` | 功能=`gtn2f_9xp` 安全=`orpdjp39u` 前端性能=`mzqxmhhx7` 后端性能=`w6y78hzpb` 稳定性=`iuihxy_v_` |
| 标题* | `name` | text |

（* = `meta-create-fields` 必填）

> ⚠ `meta-create-fields` 返回的 `default_value.option_id` 可能已失效（实测任务维度 default `gtn2mf_9xp` 不在 options 中）——枚举一律以 `meta-fields` 的 options 为准。

## 3. 版本字段（`influence_version`，workitem_related_multi_select）

- 版本是 version 类型工作项，命名 `fx-data-X.Y.Z`。用户给两段口径（如 10.19）→ 补全成 `fx-data-10.19.0` 再查；给非常规三段口径（如 10.0.19）先按版本列表比对，无匹配则问用户，不猜。
- 查找与取 ID（坑：状态字段是 `work_item_status`，`status` 报 attr not found；MQL 细节见 meegle 的 mql-syntax）：

```bash
meegle workitem query --project-key 67d7ba04296cba3d3ece0694 \
  --mql "SELECT \`name\`, \`work_item_status\` FROM \`67d7ba04296cba3d3ece0694\`.\`version\` WHERE \`name\` LIKE '%fx-data-10.19%'"
meegle workitem get --name "fx-data-10.19.0" --project-key 67d7ba04296cba3d3ece0694   # 读 work_item_id
```

- 写入按 STRING 协议 stringified 数组：`"[<work_item_id>]"`。

## 4. 截图 / 附件（`multi_attachment`）

创建前预上传（工作项尚无 ID，用 `--work-item-type`）：

```bash
meegle attachment +upload <file> --resource-type 15 --project-key <project_key> \
  --work-item-type issue --field-key multi_attachment --filename "<展示名>"
```

create 时写 stringified 数组 `[{"name","type","size","fileToken"}]`。

## 5. 收尾与边界

- 创建后 `workitem get` 回读关键字段（附件 / 版本 / 枚举）核验落值，再向用户报告链接——附件与关联字段可能静默失败，空成功不代表落值。
- **创建项目空间**：CLI project 域只有 `search` 无 create——明确告知做不到，走页面创建。
- 创建需求 / 任务：同流程换 `--work-item-type story / sub_task`（或空间产研任务类型 key），必填字段以 `meta-create-fields` 实时返回为准，不硬编码本表。

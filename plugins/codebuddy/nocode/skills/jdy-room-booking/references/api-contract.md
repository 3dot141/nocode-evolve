# 简道云会议预约 · 接口契约与实现细节

> 全部经真实抓包 + 实测确认（含成功创建预约验证）。固定标识与字段 key 见 `config.json`。

## 运行模型

skill 不直接调简道云 HTTP，而是通过 CDP 在**已登录简道云的 headless Chrome 页面内**执行 `fetch`：

- **认证零落盘**：cookie 由 `credentials:'include'` 自动带；csrf 从页面 `<meta name=csrf-token>`（或 `window.jdy_csrf_token`）读；固定头 `x-jdy-ver: 11.4.2`。凭证全程留在浏览器，脚本不提取。
- 载体：`scripts/jdy-cdp.mjs` 的 `evalInPage(expr)`——连 `127.0.0.1:9222` → 开 dashboard target → 页面内跑 `expr(H, CFG)` → 返回 JSON。
- **官方开放 API 不用**：官方 `data/create` 不支持"选择数据"字段（会议室正是选择数据关联），且需管理员签发 API Key。私有 `/_/` 接口走用户真实会话，权限/业务逻辑与手工提交完全一致。
- **MCP 只读**：`mcp.jiandaoyun.com` 的工具全是查询类、无 create，只能当读补充，替代不了写。

## 读：查空闲会议室 `POST /_/data_process/data/filter_link`

- 语义：会议预约明细表（`bookingFormId`）里只存"已提交预约"，**没有空闲记录**；filter_link 是 UI 侧实时算出的"空闲槽"（房间主表 × 时段字典 − 已订）。每行 = 一个「房间×日期×时段」空闲槽。
- 返回：`{ dataList: [...], fields, ... }`。行字段见 `config.json.fields`（name/area/place/capacity/date/timeslot/compositeKey/photo/_id）。
- **模板法（关键）**：filter_link 对 filter **结构敏感**——删任何条件都报 `The configurations for the form have been changed`。所以只能拿 `filter-link.template.json` **改值不改结构**：
  - datetime 条件值 → 目标日期（如 `["2026-07-12"]`）
  - area 条件值 → 区域数组
  - 上午/下午/晚上 条件（`periodOnBookingForm`）值 → 时段段
  - timeslot 条件值 → 具体半小时槽
  - `nin` 条件值 → **`[]`**（模板里它是"排除已选房"，全新查询必须置空，否则误排除约 40 间房；但**不能删这个条件**，只能清空值）
- 分页：`skip += limit(100)`，返回 < limit 即取完。

## 写：创建预约 `POST /_/data_process/data/create`

- entryId = `684a3381...`（快速预约表单）。返回 `{ check_code: 0, data: { _id } }` 即成功。
- **子表 = 真正决定预约的部分**：`roomSubtable` 数组**每行 = 一个被订的槽**。订 N 个槽 → N 行。顶层 `slotsArr` / 派生字段是展示/计算用，不决定预约。
- **每行来自 filter_link 的该槽记录**：
  - `subRelationId.data.id` = 该槽的 filter_link `_id`（**实测：filter_link 槽 _id 直接就是关联 id**）
  - `subCompositeKey` = `房号@日期@时段`；`subRoomName` / `subSlot` / `subPhoto`(用该行 photo) / `subStartTs`/`subEndTs`(该槽起止毫秒，东八区)
- **顶层派生字段确定性可算**（见 `jdy-book.mjs`）：dateTs=当日东八区午夜毫秒；regionArr/periodArr/slotsArr；derivedSlotsCsv=槽逗号连；derivedRegionPeriodSlots=`区域+段+槽`；derivedFilterJson=含 date+time 的 JSON；起止时间串=`日期 时:分:秒`。
- **原样复用的字段**：一个不透明 lookup 值（`14664715`，来自另一表关联，实测复用对不同房仍被接受）、全部房名列表、看板 URL 等静态项——留模板值不动。
- `dataOpId`：每次换新 UUID（避免被当重复提交去重）。
- **必带新头 + 认证**同读路径。

## 已验证结论

| 场景 | 状态 |
|---|---|
| 读：任意日期/区域/时段查空闲（模板改值 + nin 置空 + 分页） | ✅ |
| 写：单槽预约（202） | ✅ check_code:0，明细落库 |
| 写：多槽预约（906 两槽 → 明细两行） | ✅ |
| 写：非模板房（906≠202）不透明字段复用 | ✅ 被接受 |

## 已知限制 / 风险

- **无删除 API**：`/_/data_process/data/delete` 等路由均 404。取消预约走「会议室预约取消&转让」流程表单（未实现；本 skill v1 只做订）。
- **headless 延迟**：一次操作约 40s（重型 dashboard SPA 加载）。已加防节流参数（`--disable-background-timer-throttling` 等）+ 关 socket 干净退出。
- **不透明字段 `14664715`**：来源未完全解明，当前复用模板值；已验证对 202/906、07-12 成立，跨更多房/日期若被严格校验可能需按房源取（届时逆向"选择数据"弹窗的 data/link）。
- **表单配置变更**：若简道云改了快速预约表单字段结构，模板会失效（filter_link 报"配置已变更"、create 可能缺字段）——需重新抓包更新 `*.template.json` 与 `config.json`。

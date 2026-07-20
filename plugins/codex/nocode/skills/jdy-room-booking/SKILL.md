---
name: jdy-room-booking
description: "预约简道云会议室（无锡/南京/成都会议管理应用）。当用户说「订会议室 / 预约会议室 / 查空闲会议室 / 订个会 / 明天下午无锡有没有空会议室 / book a meeting room…"
---

# 简道云会议室预约

一句话订到符合条件的空闲会议室，替代手工在快速预约表单里点几十步。读（查空闲）走 `filter_link`，写（提交预约）走 `data/create`，都通过 CDP 在已登录的 headless Chrome **页面内 fetch** 完成，凭证不落盘。技术契约见 `references/api-contract.md`。

## 前置检查（每次开工先做）

1. **调试端口在否**：`curl -s --max-time 4 http://127.0.0.1:9222/json/version`。
   - 无响应 → 启动 headless（带防节流参数，一次性登录见下）：
     ```bash
     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
       --user-data-dir="$HOME/.jdy-room-booking/chrome-profile" --remote-debugging-port=9222 \
       --no-first-run --disable-background-timer-throttling \
       --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-gpu >/dev/null 2>&1 &
     ```
2. **登录态**：任何脚本报「简道云未登录」= profile 没登录。**登录是用户的事，不代劳**：让用户用**可见 Chrome**（把 `--headless=new` 去掉，同一 `--user-data-dir`）打开简道云登录一次、关掉，cookie 存进 profile 后再以 headless 跑。不索取/不代填密码。

> 提示用户：headless 下一次操作约 40s（重型 SPA 加载），属正常。

## Step 1 — 解析意图

从用户的话解析：
- **日期**：默认今天；「明天/后天/周几/7月12日」等换算成 `YYYY-MM-DD`。
- **时段**：整段「上午/下午/晚上」→ 传 `--period`；精确区间「14 点到 15 点」→ 换成半小时槽传 `--slots`（如 `14:00:00-14:30:00,14:30:00-15:00:00`）。两种都支持（时段窗口：上午 09:00–12:00 / 下午 12:00–17:30 / 晚上 17:30–21:00）。
- **区域**：无锡 / 南京 / 成都，**可多选**（`--regions 无锡,南京`）。
- **可选**：具体房间（「订 501」）、人数（「10 人」）、会议名（默认自动）。

缺日期/时段/区域，或有歧义（如只说「订个会议室」）→ 回问补齐，不猜。

## Step 2 — 查空闲

```bash
node scripts/jdy-query.mjs --date <日期> --regions <区域,逗号分隔> --period <上午|下午|晚上>
# 或精确槽： --slots 14:00:00-14:30:00,14:30:00-15:00:00
```
输出 `fullyFreeRooms`（在要求时段**全空**的房，按容量降序，带区域/地点/容量）+ `partialRooms`。

## Step 3 — 判定：直接订 or 确认

**直接订**（唯一确定、无歧义时）——满足其一即唯一确定：
- 用户点名了具体房间，且它在 `fullyFreeRooms` 里；
- 或按规则自动挑出一间：
  - **说了人数** → `fullyFreeRooms` 里容量 ≥ 人数中**容量最小**的一间（少浪费）；
  - **没说人数** → `fullyFreeRooms` 里**容量最大**的一间。

**停下来确认/回问**：
- 点名的房不在 fullyFreeRooms（被占或只空部分时段）→ 报实情 + 给 `fullyFreeRooms` 里的替代，等用户选；
- `fullyFreeRooms` 为空 → 告知无空房 + 建议换时段/区域；
- 日期/时段/区域缺失或有歧义 → 回 Step 1 补齐。

## Step 4 — 提交

对选定的房：
```bash
node scripts/jdy-book.mjs --date <日期> --region <单个区域> --room <房号> \
  --period <段> 或 --slots <槽,逗号分隔> --name "<会议名>"
```
成功输出 `{ ok:true, recordId, room, slots, ... }`。失败会报 `not_free`（被抢订）/ `create 未成功`——据此回 Step 2 重查或告知用户。

## Step 5 — 回执

无论直接订还是确认后订，**订完立刻给一行回执**：
> 已订 **无锡·501(大培训室)** · 2026-07-12 · 09:00–10:00 · 记录 id `xxx`

回执让用户一眼核对（万一日期/房间解析错好及时处理）。

## 安全语义（务必遵守）

- **只有 Step 3「直接订」分支才自动调 `jdy-book`**；其余一律先把候选/实情呈现给用户，等其选。
- `jdy-book` 是**写操作**（真实创建预约、占房、可能通知与会人）。查询类（`jdy-query`）只读，随意跑。
- **绝不 POST 到 `create` 以外的写接口**。
- 预约**无删除 API**，取消要走用户平时的「会议室预约取消&转让」流程——本 skill v1 不做取消，订错了如实告知用户去取消。

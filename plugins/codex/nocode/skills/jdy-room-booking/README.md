# jdy-room-booking

简道云会议管理应用的会议室预约 skill。用户一句自然语言（「订明天下午无锡的会议室」）即完成"查空闲 → 选房 → 提交预约"，替代手工在快速预约表单点几十步。

> 面向特定的简道云会议应用（appId `67e6429f…`）。换应用/表单需更新 `references/config.json` 与 `references/*.template.json`。

## 结构

```
SKILL.md                     执行入口：前置检查 + Step 1-5 + 安全语义
references/
  api-contract.md            接口契约、运行模型、已知限制（技术单源）
  config.json                固定标识 + 字段映射 + 时段字典
  filter-link.template.json  查空闲的 payload 模板（改值不改结构）
  create.template.json       创建预约的 payload 模板
scripts/
  jdy-cdp.mjs                共享 CDP 助手（连 headless 9222，页面内 fetch）
  jdy-query.mjs              查空闲会议室（读）
  jdy-book.mjs               提交预约（写）
```

## 一次性设置

1. 建 profile 并**登录一次**（用可见 Chrome，同一 `--user-data-dir`，登录简道云后关闭）：
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --user-data-dir="$HOME/.jdy-room-booking/chrome-profile" https://www.jiandaoyun.com
   ```
2. 之后 skill 以 headless 复用该 profile（cookie 持久化，无需重复登录）。

凭证全程留在浏览器里——skill 通过 CDP 页面内 fetch，cookie 自动带、csrf 从页面读，**不提取/不存储任何 cookie 或 token**。

## 验证状态（真实环境实测）

| 能力 | 状态 |
|---|---|
| 查空闲（任意日期/区域/时段，分页取全）| ✅ 实测 |
| 订单槽 | ✅ check_code:0，明细落库 |
| 订多槽（子表多行）| ✅ 906 两槽实测 |
| 换房（非模板房复用不透明字段）| ✅ 906 实测被接受 |

**残留风险**：不透明字段 `14664715` 当前复用模板值（已验证对 202/906 成立）；无删除 API，取消走流程未实现；headless 单次约 40s。详见 `references/api-contract.md`。

## 来历

方案经完整评估后定案：官方开放 API 需管理员 API Key 且 create 不支持"选择数据"字段；官方 MCP 只读无 create；最终选私有 `/_/` 接口 + CDP 页面内 fetch（走用户真实会话，权限/逻辑与手工提交一致）。接口契约由真实抓包 + 实测反推。

## Changelog

- **1.0.0** — 初版：查空闲 + 提交预约（读写均真实环境验证）。

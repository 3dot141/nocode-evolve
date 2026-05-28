# statusline 第二行:日/周 usage 配速条

> 设计文档 · 2026-05-28 · 集成进 nocode-evolve 插件

## 背景

当前 statusline 由 `~/.claude/scripts/context-bar.sh` 提供,单行:
`dir · branch · git(脏文件/同步/sync-ago) · context-bar pct%·max`。

参考 `jarrodwatts/claude-hud`(用户口中的 "claude hub"),希望在保留第一行的前提下,**新增第二行展示订阅额度**:5h 窗口(日)+ 7d 窗口(周)的已用百分比、重置倒计时,并用 pacing 配速条直观显示"按匀速现在该用到哪"。

## 目标 / 非目标

**目标**
- 第一行视觉完全不变(原样移植 context-bar.sh)。
- 第二行新增:`日 <pbar> N% <倒计时>   周 <pbar> N% <倒计时>`,pacing 配速条形态。
- 零网络请求、零 token 消耗。
- 一条命令完成 statusLine 接线。

**非目标**
- 不新建独立 `nocode-hub` repo / marketplace —— 直接集成进现有 `nocode-evolve` 插件。
- 不做 OAuth API fallback(放弃零成本优势 + 引入未公开 endpoint 依赖)。
- 不改第一行任何字段 / 配色 / 逻辑。

## 决策摘要

| 维度 | 决策 | 理由 |
|---|---|---|
| 落地位置 | 集成进 `nocode-evolve`,新增 `scripts/statusline.sh` | 用户既有插件 + 稳定 dev 路径,免新建 repo/分发外壳 |
| 接线方式 | `statusLine.command` 指向 repo 内脚本绝对路径 | 路径稳定不漂移;插件 manifest 无法声明主 statusLine |
| 第一行 | 原样移植 context-bar.sh | 用户明确"第一行挺好看的,不动" |
| 第二行形态 | pacing 配速条(8 格 bar + 白 `│` 标记) | 用户从 A/B/C 三选中选 C |
| 数据源 | 原生 stdin `rate_limits` | 零成本;CC 2.1.153 ≥ 2.1.80 支持 |
| 缺失降级 | rate_limits 缺失 → 不输出第二行 | 退回单行 = 现状,绝不发网络请求 |
| setup | 新增 `/statusline-setup` 命令 | 一键写 settings.json,可复用到其他机器 |

## 组件

### 1. `scripts/statusline.sh`(核心)

自包含 bash 脚本,读 stdin JSON,输出 1~2 行。

- **Line 1**:照搬 `~/.claude/scripts/context-bar.sh` 全部逻辑(palette、trunc、git 信息、context-bar sub-cell 渲染)。
- **Line 2**:读 `rate_limits`,渲染日/周;缺失则不输出该行。

### 2. `commands/statusline-setup.md`(接线命令)

`/statusline-setup` 命令:把 `~/.claude/settings.json` 的 `statusLine.command` 设为 `sh <plugin-root>/scripts/statusline.sh`。

- 复用内置 `statusline-setup` agent(Read/Edit)落 settings.json。
- 保留 settings.json 其余字段;幂等(重复执行结果一致)。
- 路径解析:优先 `${CLAUDE_PLUGIN_ROOT}`,本机 dev 退化为 `/Users/yes365/AI/nocode-evolve`。

### 3. settings.json 接线(一次性)

`statusLine.command`: `sh ~/.claude/scripts/context-bar.sh` → `sh <repo>/scripts/statusline.sh`。
旧 `context-bar.sh` 保留作回退,不删。

## 第二行渲染规格

### 数据契约(stdin)

```json
"rate_limits": {
  "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
  "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
}
```

**Gotchas(已从官方 docs 验证)**:
- 仅 Claude.ai Pro/Max 订阅出现;纯 API-key 计费完全没有。
- 会话首次 API 调用之后才出现(刚开会话为空)。
- `five_hour` / `seven_day` 可能各自独立缺失。
- 读取一律 `// empty` 防御,缺啥隐藏啥。

### 布局

```
日 <pbar8> N% <countdown>   周 <pbar8> N% <countdown>
```

- 标签 `日`/`周` 用 dim/label 色。
- 两段之间 3 空格分隔。

### pacing 配速条 `pbar`

- 宽度 8 格。
- `used%` 决定填充格数:`full = used_pct * 8 / 100`。
- pacing 标记位置:`pace_pct = (1 − (resets_at − now) / window) × 100`;`window`:5h = 18000s,7d = 604800s。`pidx = pace_pct * 8 / 100`(钳制到 0..7)。
- 渲染:`pidx` 处画白 `│`;`< full` 画 `█`(阈值色);其余画 `░`(empty 色)。

### 倒计时格式

`secs = resets_at − now`:
- `< 1h` → `Mm`(如 `42m`)
- `< 1d` → `Hh Mm`(如 `4h42m`,实现可压成 `4h42m` 无空格)
- `≥ 1d` → `Dd Hh`(如 `5d8h`)

### 配色阈值(复用 line1 palette)

`used%`:绿 `<50` / 黄 `50–80` / 红 `>80`。pacing `│` 用白色。

### 降级

- `rate_limits` 整体缺失 → **不 echo 第二行**(脚本只输出 line1)。
- 仅 `five_hour` 缺 → 只输出 `周 …`;仅 `seven_day` 缺 → 只输出 `日 …`。

## 测试

stdin 喂样例 JSON 验证渲染:

```bash
echo '{"cwd":"'$PWD'","context_window":{"context_window_size":1000000,"used_percentage":40},"rate_limits":{"five_hour":{"used_percentage":3,"resets_at":'$(($(date +%s)+16920))'},"seven_day":{"used_percentage":29,"resets_at":'$(($(date +%s)+460800))'}}}' | sh scripts/statusline.sh
```

用例:
1. 双窗口齐全 → 两行,日/周都在。
2. 无 `rate_limits` → 单行(= 现状)。
3. 仅 five_hour → 第二行只有日。
4. used% 跨阈值(如 85%)→ 红色;pacing 标记落在填充区右侧(超速)/左侧(省着)。

## 版本

改动落 `nocode-evolve`,按仓库 CLAUDE.md:**minor** bump(新增 statusline 能力 + 新命令)。`plugin.json` 2.7.0 → 2.8.0,与实现 commit 同批。

## 风险

- pacing `window` 取固定 5h/7d;若 Anthropic 调整窗口长度则标记位置偏移(低概率,易改常量)。
- `${CLAUDE_PLUGIN_ROOT}` 在 statusLine.command 运行时是否注入未验证 → setup 命令写**解析后的绝对路径**规避。

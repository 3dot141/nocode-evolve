---
description: 把 Claude Code 的 statusLine 接到 nocode-evolve 的 scripts/statusline.sh（第一行 context-bar 风 + 第二行日/周 usage 配速条），写入 ~/.claude/settings.json
---

# /statusline-setup — 接线 statusline

把 `~/.claude/settings.json` 的 `statusLine.command` 指向本插件的 `scripts/statusline.sh`。脚本第一行是 context-bar 风（dir · branch · git · context bar），第二行是日/周（5h / 7d）usage 的 pacing 配速条，数据走原生 stdin `rate_limits`，零网络、零 token。

## 你要做的

### 1. 解析脚本绝对路径
- 优先插件根：若环境变量 `${CLAUDE_PLUGIN_ROOT}` 非空，路径 = `${CLAUDE_PLUGIN_ROOT}/scripts/statusline.sh`。
- 否则用本仓库 dev 路径：`/Users/yes365/AI/nocode-evolve/scripts/statusline.sh`。
- 用 Bash `test -f "$SCRIPT"` 确认存在；不存在则报错并停止，提示用户先确认插件已安装 / 路径正确。

### 2. 更新 settings.json（保留其余字段、幂等）
先备份，再用 jq 原子更新（保留所有其他 key）：

```bash
SCRIPT="<上一步解析的绝对路径>"
cp ~/.claude/settings.json ~/.claude/settings.json.bak.$(date +%s)
TMP=$(mktemp)
jq --arg cmd "sh $SCRIPT" '.statusLine = {type:"command", command:$cmd}' ~/.claude/settings.json > "$TMP" && mv "$TMP" ~/.claude/settings.json
```

若 `~/.claude/settings.json` 不存在，先 `echo '{}' > ~/.claude/settings.json` 再执行上面的 jq。

### 3. 确认
打印新的 statusLine 配置：

```bash
jq '.statusLine' ~/.claude/settings.json
```

提示用户：旧的 `~/.claude/scripts/context-bar.sh` 仍保留作回退；statusLine 在新会话 / 重启后生效。

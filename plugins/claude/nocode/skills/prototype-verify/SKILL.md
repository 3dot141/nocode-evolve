---
name: prototype-verify
description: "验证 pd-vd 产出的本地交互原型并生成截图与 verify-report；仅用于已物化的原型目录，不负责设计或修改原型"
argument-hint: <prototype-dir> [--interactions interactions.json]
---

# /prototype-verify：验证交互原型

从 `$ARGUMENTS` 解析一个原型目录和可选的 `--interactions <json-path>`。先把两个路径解析为绝对路径并确认存在；不接受其它选项。然后用独立、带引号的 argv 调用验证器：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/prototype-verify.mjs" "<absolute-prototype-dir>" --interactions "<absolute-interactions-json>"
```

没有 `--interactions` 时省略该参数和值。返回 `verify-output/screenshots/` 与 `verify-report.json` 的绝对路径，并明确报告 error 数；不得拼接 shell 字符串，也不得在此入口修改原型。

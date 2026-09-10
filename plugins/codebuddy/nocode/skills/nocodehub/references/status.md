# nocodehub status：插件健康概览

本动作只读，不自动修复漂移，也不修改版本号。

## 执行

1. 读取 `plugin/metadata.json` 的版本。
2. 统计 `rules/rule-*.md` 和 `skills/*/SKILL.md` 数量。
3. 运行 `node scripts/vendor-sync.mjs --check`。
4. 运行 `node --test 'hooks/*.test.mjs'`。
5. 运行 `node scripts/compile.rule.js --check`、`node scripts/compile.hooks.js --check` 和 `node scripts/package.platform.mjs --check`。
6. 汇总版本、rule 数、skill 数、vendor、测试和漂移状态；任一检查失败时建议运行 `/nocodehub dream`，但不直接修复。

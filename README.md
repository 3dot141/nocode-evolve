# nocode

Harrison 的 Claude Code 个人插件。架构(**两类知识分离 + 每文件自带单源**):

- **规则知识 (reactive)**:SessionStart 注入**完整 rule 路由**(catalog 分片常驻 context,必在、无软触发漏);agent 命中后按需 `Read` 对应 `rules/rule-*.md`。
- **编排知识 (proactive)**:`nocode:devflow` 可被 model 主动调起,也可用户 `/调` 进入,给「当前阶段判断 + 下一步建议 + 备选」,**用户拍板,不替执行**。
- **硬拦截**:`PreToolUse` hook 对危险 Bash 命令(`bkt PUT` / 裸 curl 等)`deny` / `inject`,唯一的确定性机制。
- **两条独立生成链**:`rules/rule-*.md`(每文件自带 `name`/`description`/`skip` frontmatter)→ `scripts/compile.rule.js` → `model/agent-rule-catalog-*.md` 分片;`scripts/compile.hooks.js`(规则硬编码在脚本内)→ `hooks/pretooluse-rules.json`。两条链互不耦合,没有共享的 manifest 中转层。

## 规则注入顺序

每次 SessionStart,hook 跑 9 次 `inject-nocode.sh` 调用(各段独立判 **10000 字符**截断阈值):

1. `model-about`          —— 角色 / 输出语言 / 红蓝军触发 / git behavior / 全局占位符
2. `model-personal`       —— 项目本地 `.agents-personal/` 检索约定 + 删除护栏
3. `model-karpathy`       —— 12 条工程准则
4. `model-rule-catalog-1` —— catalog 分片 1(完整 rule 路由,**frontmatter 生成,禁手改**)
5. `model-rule-catalog-2` ~ `-5` —— catalog 续片(预留,空段静默)
6. `project`              —— `<project>/.agents-personal/AGENTS.md`(存在才注入)

`rules/rule-*.md` 触发式规则**不**进开局 context;agent 看 catalog 分片命中后按需 Read。

> 项目根由 `$CLAUDE_PROJECT_DIR` 决定(不存在则回退到 `$PWD`)。
> 给某个工程定制规则,只需在该工程根目录建 `.agents-personal/AGENTS.md` 即可,无需改插件。
> **模板见 `examples/agents-personal/`** —— 复制到项目根、改占位符即可使用。

## 当前结构

```
nocode/
├── .claude-plugin/
│   ├── plugin.json                           # 插件清单
│   └── marketplace.json                      # GitHub marketplace 描述
├── hooks/
│   ├── hooks.json                            # SessionStart 10 段 + PreToolUse (Bash 拦截)
│   ├── inject-nocode.sh                      # 注入脚本 (每 segment 独立判 10000 阈值)
│   ├── pretooluse-guard.mjs                  # PreToolUse 硬拦截 (危险 Bash 命令)
│   ├── pretooluse-rules.json                 # 生成物 (源=scripts/compile.hooks.js)
│   └── *.test.mjs                            # 单测
├── model/                                    # 会话开局常驻注入
│   ├── agent-about.md                        # 角色 + 行为基线 + git behavior
│   ├── agent-personal.md                     # .agents-personal 检索 + 删除护栏
│   ├── agent-karpathy.md                     # 12 工程准则
│   └── agent-rule-catalog-1.md               # catalog 分片 1 (生成物, 完整 rule 路由)
│                                             # (agent-rule-catalog-2~5.md 按需生成)
├── rules/                                    # 按需 Read (catalog 路由)
│   └── rule-*.md ×6                          # 每文件顶部自带 name/description/skip frontmatter:
│                                             # git-worktree / git-inspection / git-freshness /
│                                             # codex-review / superpowers-brainstorming /
│                                             # figma-design-read
├── skills/                                   # Claude Code skill
│   ├── devflow/                              # 流程领航 (model 可主动调起)
│   ├── bkt/                                  # Bitbucket CLI
│   ├── design-doc-writing/                   # 设计文档 (含 references/rendering 渲染环节)
│   ├── red-blue-deep/                        # 评估辩论框架
│   └── signoz-cli/                           # SigNoz 查询
├── commands/                                 # /slash 命令
│   ├── distill.md                            # 沉淀分流 (五出口)
│   ├── sow.md                                # 归档到 vault
│   ├── task.md                               # 任务管理
│   └── sow-reference/                        # sow 脚本
├── agents/
│   └── semble-search.md                      # 代码搜索 subagent
├── vendor/codex/                             # codex companion (跨模型 review)
├── scripts/                                  # compile.rule.js / compile.hooks.js / worktree-setup / statusline
├── eval/cases · eval/preambles               # rule-eval fixture
└── examples/agents-personal/                 # 项目本地 .agents-personal/ 模板
```

## 安装方式

### 方式 A:本地直接挂载(开发期)
```bash
claude --plugin-dir /Users/yes365/AI/nocode-evolve
```
仅当前会话生效,改完文件重启即可。

### 方式 B:本地 marketplace(持久化,本机所有项目)
```bash
# 在 Claude Code 内执行 (slash 命令)
/plugin marketplace add /Users/yes365/AI/nocode-evolve
/plugin install nocode@nocode-market
```

### 方式 C:GitHub marketplace(跨设备同步)
1. 把本目录推到 `https://github.com/3dot141/nocode-evolve`
2. 在 Claude Code 内:
   ```
   /plugin marketplace add 3dot141/nocode-evolve
   /plugin install nocode@nocode-market
   ```

## 日常操作

| 操作 | 命令 |
|---|---|
| 启用 / 禁用 | `/plugin enable nocode@nocode-market` / `/plugin disable ...` |
| 改完热加载 | `/reload-plugins` |
| 校验清单 | `/plugin validate` |
| 查看加载详情 | `claude --debug` 启动 |
| 卸载 | `claude plugin uninstall nocode@nocode-market --scope user` |

## 后续扩展(按需加目录即可)

### 加 Skills
```
skills/
└── my-skill/
    └── SKILL.md          # frontmatter 必填 description
```
安装后调用名为 `/nocode:my-skill`。手动入口型(用户主动调,不自动触发)加 `disable-model-invocation: true`。

### 加 Rules(每文件自带 frontmatter,无 manifest 中转)
1. 新建 `rules/rule-<slug>.md`,顶部加 frontmatter:`name: <slug>` / `description: >- <触发条件+不触发边界>` / `skip: false`
2. 跑 `node scripts/compile.rule.js` 重新生成 catalog 分片
3. 若需要 PreToolUse 硬拦截:改 `scripts/compile.hooks.js` 内规则数组,跑 `node scripts/compile.hooks.js`(独立于上面那条链)

### 加 Agents(子代理)
```
agents/
└── reviewer.md           # frontmatter 含 name/description/tools
```

### 加 MCP 服务器
在插件根新建 `.mcp.json`。

### 加更多 Hooks
往 `hooks/hooks.json` 里追加 `PostToolUse` / `FileChanged` 等事件即可。脚本里用 `${CLAUDE_PLUGIN_ROOT}` 引用插件根目录。

## 重要限制(设计依据)

- **不能直接挂载 `CLAUDE.md`**:plugin 根的 `CLAUDE.md` 不会被加载。本插件的 SessionStart hook 是官方推荐的等效方案,把 `model/*.md` 内容(以及可选项目级 `.agents-personal/AGENTS.md`)作为 `additionalContext` 注入。
- **hook 截断阈值 10000 字符 per-command**:catalog 分片机制(`SHARD_LIMIT=9000`)就是为绕这个;每 segment 独立判,各自安全。
- `version` 不写时用 git commit SHA 作版本号——每次提交都视为新版本。
- 安装范围:`--scope user`(默认,跨项目)/ `--scope project`(团队共享,进 git)/ `--scope local`(仅本项目,gitignore)。

## License

本插件代码以 [MIT](./LICENSE) 授权。`vendor/` 下的第三方内容保留各自原始协议:[superpowers](https://github.com/obra/superpowers)(MIT)、[everything-claude-code](https://github.com/affaan-m/everything-claude-code)(MIT)、codex(Apache-2.0),协议全文见各目录内 LICENSE 文件。

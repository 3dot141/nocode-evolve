---
name: java-compile
version: "0.1.0"
description: >-
  Java/Kotlin 项目编译验证的工具路由:本机已部署 idea-jps(jps-build.sh,warm 增量 ~4s)时
  优先用它,前置不满足或场景不适合回退 ./gradlew(~45s 档)。Use when 对 Java/Gradle 项目
  执行编译验证——compileJava/classes、改码后确认编译通过、CI 前快速验证、agent 迭代循环中的
  编译步骤。Not for 打包/发布/bootJar、跑测试、处理依赖安装(直接 gradlew)、非 JVM 项目、
  IDEA 内人工构建。
---

# Java 编译路由:jps-build 优先,gradlew 兜底

同一个改动后的全项目编译,`./gradlew classes` 实测 ~45s(其中 ~41s 是 no-op 也逃不掉的
配置阶段+输入指纹),`jps-build.sh` 实测 ~4s(增量缓存)。前提是目标项目已初始化 JPS 模型——
本 skill 负责「何时用哪个 + 用之前查什么 + 失败了去哪」。

## 1. 场景分流

| 场景 | 用什么 | 原因 |
|---|---|---|
| 改码后验证编译 / 增量迭代编译 | `jps-build.sh` | 秒级;输出 `build/jps-classes/<module>` |
| 只编部分模块 | `jps-build.sh --modules <m1>,<m2>` | 连同依赖编译 |
| 打包 / bootJar / 发布产物 | `./gradlew` | JPS 只编译,不执行 task 图 |
| 跑测试 | `./gradlew test` | 测试执行是 gradle 能力 |
| 新增/变更依赖、改 sourceSet、改 build.gradle.kts | 先走第 3 节 init,再 jps | JPS 消费的是摊平快照,模型过期会编错 |
| 非 JVM 项目 / 本机无 idea-jps | `./gradlew` 或项目构建工具 | 无替代 |

## 2. jps 前置检查(跑之前必查,缺一即走第 3 节)

1. `~/Run/Services/idea-jps/bin/jps-build.sh` 存在且可执行
2. `<project>/.idea/modules.xml` 存在(JPS 模型已 init 的标志)

## 3. 未 init 的 checkout/worktree:一次性初始化

```bash
~/Run/Services/idea-jps/bin/init-project.sh <project-dir> <template-dir>
# template = 同仓库已 init 的 checkout(如 ~/Work/Source/fx-data-server-release)
# 约数分钟;之后日常编译不再碰 init
```

## 4. 调用样例

```bash
~/Run/Services/idea-jps/bin/jps-build.sh <project-dir> --all              # 全模块增量
~/Run/Services/idea-jps/bin/jps-build.sh <project-dir> --modules fx-core  # 指定模块
```

- 参数**空格分隔**,`--k=v` 等号形式不被解析(实测坑)
- 退出码 0 = 成功;产物在 `<project>/build/jps-classes/<module>`,与 gradle 的
  `build/classes` 互不干扰,同一 checkout 两套并存
- 每个 checkout 的 `.jps-cache/` 独立,**禁止跨 worktree 共享**(增量状态互相污染 → 漏编)

## 5. 编译失败

按 `references/troubleshooting.md` 的「错误特征 → 探查 → 修复」表处理;该表的主源是
`~/Run/Services/idea-jps/README.md`,两处不一致时以主源为准并回写本表。

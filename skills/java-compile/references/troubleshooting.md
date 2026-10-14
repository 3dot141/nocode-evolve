# jps-build 编译失败排障

> **主从声明**:本文件是插件内快照,主源为 `~/Run/Services/idea-jps/README.md`(踩坑记录
> 全量在那里,本表只收高频项)。两处不一致时以主源为准,并把差异回写本表。

## 探查循环(codegen 类问题不预知、不绑定目录)

jps-build 不执行 gradle task 图;codegen(ANTLR/protobuf 等)与依赖变更靠错误驱动修复:

```
jps-build.sh 失败
  → 按下表读错误特征
  → 探查(命令在表内)
  → 执行修复
  → 重跑 jps-build.sh(增量续跑,已编部分不浪费)
```

## 错误特征 → 探查 → 修复

| 错误特征 | 探查 | 修复 |
|---|---|---|
| `package XxxParser does not exist` / `XxxBaseVisitor` 缺失(ANTLR 等生成源) | `find <project> -name "*.g4" -o -name "*.proto"` 定位模块 | 跑该模块生成 task(如 `./gradlew :<模块>:generateGrammarSource`)→ 重跑 `./gradlew idea` → `fix-iml-output.py` → 续编 |
| `cannot find symbol: Q*` / MapStruct `*Impl` 缺失(AP 未跑) | `<project>/.idea/compiler.xml` 模块映射是否过期(模块名应为 iml 名,非 `项目.路径.main` 形态) | `python3 ~/Run/Services/idea-jps/bin/fix-compiler-xml.py <project>`(从模板 `.bak` 重新生成时需先同步模板) |
| `Annotation processing is not supported for module cycles` | 模块依赖图新增环 | 重跑 `fix-compiler-xml.py`(内置 SCC 环检测,自动排除环上模块) |
| `Output directory not specified` | iml `inherit-compiler-output="true"` | `python3 ~/Run/Services/idea-jps/bin/fix-iml-output.py <project>` |
| Kotlin `Unresolved reference` 跨模块 | 多个模块 output 是否同路径(共享目录) | 同上 `fix-iml-output.py`(独立输出目录) |
| 莫名 `cannot find symbol`(刚改过 build.gradle.kts) | JPS 模型快照过期(依赖/sourceSet 变更未摊平) | 重走 init-project.sh 三步(idea → 拷 .idea → fix-iml) |
| 启动即 NPE `path is null` / 打印 Usage | 调用方式问题 | 用 `jps-build.sh` 入口(已内置 log dir / 参数格式 / add-opens);不要手拼 java 命令 |

## 判断模型是否过期

JPS 编译消费的是 init 时摊平的静态快照(`.idea` + `*.iml`)。**只改 Java/Kotlin 源码
不会过期;动了 build.gradle.kts(依赖/sourceSet/模块结构/codegen 接线)即过期**,表现
为 classpath 缺 jar 或 cannot find symbol——处置见上表最后一行。

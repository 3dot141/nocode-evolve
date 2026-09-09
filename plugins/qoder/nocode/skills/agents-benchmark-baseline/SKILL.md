---
name: agents-benchmark-baseline
description: >-
  Use when 要在本地起一套「指定版本」的隔离基准环境做对照测试——用户提到 baseline 环境、
  基准版本、对照组环境、起某个已发布版本、fx-data-agents 基准。
  Not for 起主开发栈（用 agents-launcher）、生产部署、导入 fixture、benchmark 的判分与报告。
---

# agents-benchmark-baseline — 本地基准对照组

把「某个版本」起成一套**隔离**的基准环境：独立容器组（PG/MinIO/Redis/Mongo/RabbitMQ/ES/polars + fx-data-server + fx-data-agents），与主开发栈（宿主机 8070/8081 + 共享底座）互不干扰。

**为什么不手工起**：10 个容器有顺序依赖（依赖就绪 → 预建队列 → 起服务），且容器形态会暴露 6 个宿主机形态下不存在的坑。手工趟一次几十分钟，每次换版本还要重来。

## 版本标识的两种形态

| 形态 | 例子 | 起法 | 能否跑 benchmark |
|---|---|---|---|
| **git ref** | `persist`、`origin/release`、`abc1234` | worktree 检出 → 构建镜像 | 能（前提：该 ref 已含观测面） |
| **image tag** | `prod-jsy-server:latest` | docker pull | 不能（缺观测面，仅人工浏览） |

用户没给标识时**必须问**，不要默认取 `persist` 或 `latest`。

## Step 0 · 定版本

解析用户给的是 git ref 还是 image tag。

```
用户给了标识？
     │
     ├─ 给了 ──→ 记录 { kind: git-ref | image-tag, value }
     │
     └─ 没给 ──→ 问用户：要哪个版本？（列出候选：persist / origin/release / 某个 harbor tag）
                  拿到答复前不要动手
```

**Exit Gate**：`kind` 与 `value` 都明确。

## Step 1 · 定位编排资产

编排资产全部在本 skill 的 `assets/` 下，不依赖任何外部仓：

```text
assets/
├── start-baseline.sh              # 一键起（端口避让 + 队列预建 + 就绪等待）
├── docker-compose.baseline.yml    # 容器组定义
├── Dockerfile.local               # baseline agents 镜像的构建文件
├── config/
│   ├── fx-data-server.application-dev.yml     # 覆盖 local-ws.enabled=false
│   └── fx-data-agents.config.baseline.yaml    # agents 容器配置
└── docker-init/                   # 底座初始化脚本（复制自 fx-data-server 仓）
```

```
定位 <skill-dir>/assets/start-baseline.sh
     │
     ├─ 存在 ──→ 继续
     │
     └─ 不存在 ──→ 报错停手（skill 安装不完整，让用户重装）
```

**Exit Gate**：`assets/start-baseline.sh` 与 `assets/docker-compose.baseline.yml` 均存在。

## Step 2 · 准备镜像

按 Step 0 的 `kind` 分派：

```
kind = image-tag
     └──→ docker pull <value>
          └─ 失败 ──→ 报错停手（检查 harbor 登录 / tag 是否存在）

kind = git-ref
     └──→ git worktree add <工作目录>/fx-data-agents-<slug> <ref>
          （<slug> = ref 的连字符化形式，如 persist / origin-release / abc1234）
          └──→ cp <skill-dir>/assets/Dockerfile.local <worktree>/
               └──→ cd <worktree> && docker build -f Dockerfile.local -t fx-data-agents-baseline:<slug> .
                    └─ 首次构建约 10 分钟（pnpm install + 全量 build）
```

- `Dockerfile.local` 与 fx-data-agents 仓内 CI Dockerfile 同源，唯一差异是剥离 `publish:all`（本地构建不应推私有 npm）。skill 自带该文件，不必从别处找。
- 镜像 tag 用 ref 的 slug，避免覆盖不同版本的镜像。
- worktree 已存在时复用，不要重复 `git worktree add`（会报错）。

**Exit Gate**：`docker images` 能查到目标镜像。

## Step 3 · 起环境

```bash
cd <skill-dir>/assets && ./start-baseline.sh --image fx-data-agents-baseline:<slug>
```

`--image` 指定 Step 2 备好的镜像（不传则用 `fx-data-agents-baseline:persist`）；镜像不存在时脚本会直接报错停手，不会用错版本起环境。

脚本自己完成：端口避让 → 校验镜像 → 起依赖容器 → 等就绪 → 从主环境导入 RabbitMQ 队列 → 起服务 → 等就绪 → 打印端口表。

**换版本 = 替换**：如果当前跑的是别的版本，先 `./start-baseline.sh --down`（保留数据卷）再起新的。不要试图两套并存——容器名与端口都是写死的单套。

**Exit Gate**：脚本 exit 0 且端口表已输出。

## Step 4 · 验证与报告

逐项探活，不要只看脚本退出码：

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<AGENTS_PORT>/ai/assistant/models     # 期望 200
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<SERVER_PORT>/decision/               # 期望 302
```

**Global Exit Gate**：两个探活都返回期望状态码。

向用户报告：

- 端口表（脚本已打印，原样转述）
- benchmark 接入：`QG_BASE_URL=http://127.0.0.1:<AGENTS_PORT>`
- **当前环境是空库**——只有 schema，没有 scene agent / 工作区数据。要跑 benchmark 需先自行导入 fixture。

## 起不来时

按 `references/troubleshooting.md` 诊断。多数失败集中在容器形态特有的依赖顺序与地址问题上，该文档记录了每个坑的现象、根因与解法。

## 不做

- **观测面补丁**：`sessionTraceExport` 由代码发布流程负责，本 Skill 不打补丁
- **fixture 导入**：场景 Agent / 知识卡 / 工作区数据由用户自理
- **benchmark 跑批**：本 Skill 只到「环境可用 + 接入信息」为止

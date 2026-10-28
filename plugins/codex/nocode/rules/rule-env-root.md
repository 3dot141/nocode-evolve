---
name: env-root
description: >-
  需要某个外部服务/工具的环境变量或凭据（token、接口地址、账号、API Key）时触发——先看当前工程自己的设定
  （.env*、config、项目文档、脚本里已有的变量引用），工程里没有再去 ${ENV_ROOT}（默认 ~/Run/Env）
  按 <vendor>/<service>.env 查找；找不到就明确说缺哪一项，禁止按记忆猜默认值、禁止把密钥复制进业务仓库或回复。
  不触发: 工程内已明确写出且可直接读取的配置、与外部凭据无关的普通变量、纯代码逻辑。
skip: false
---

# env-root — 环境变量与凭据的查找顺序

外部服务（App Store Connect、飞书、各类 API）的凭据不该散落在对话、脚本和记忆里。统一两级查找：**工程优先，环境根兜底**。

## 查找顺序

```text
需要某服务的凭据/地址
  │
  ├─ 1. 当前工程的设定
  │     .env / .env.* / env.local.yaml / config.* / 项目文档 / 脚本里已有的变量名
  │     ← 以工程内实际值为准（可能指向测试环境）
  │
  ├─ 2. ${ENV_ROOT}（默认 ~/Run/Env）
  │     按 <vendor>/<service>.env 找；文件是可直接 source 的 KEY=VALUE
  │
  └─ 3. 都没有 → 停下，说明缺哪一项、在哪配置；不猜默认值
```

工程内存在的值优先，即使 `${ENV_ROOT}` 里也有同名项——工程可能刻意指向测试/本地环境。

## ENV_ROOT 约定

- 根目录由 `ENV_ROOT` 指定，未设置时用 `~/Run/Env`。
- 一个服务一个文件：`<vendor>/<service>.env`，例如 `apple/appstore-connect.env`；**主机级凭据用服务器域名 / IP 作父目录**，例如 `service.yes365.fun/ssh.env`。
- 凭据值与私钥都可入库（`${ENV_ROOT}` 自身是独立 private 仓库）；私钥若被工具按固定路径读取，用软链接指回默认位置，保持唯一实体，不复制第二份。
- 根 `AGENTS.md` 只放全局规则与子目录索引；每台服务器 / 服务的具体用法在 `<目录>/AGENTS.md`，按需读取，减少默认加载量。
- 文件权限 600。

读取方式：

```bash
set -a; source "${ENV_ROOT:-$HOME/Run/Env}/<vendor>/<service>.env"; set +a
```

## 提交与推送

`${ENV_ROOT}` 是独立 git 仓库，改动必须落地：

- **每次新增或修改凭据文件后，立即 commit 并 push**，不把改动留在本地。
- **推送前确认目标仓库是 private**：

```bash
gh repo view <owner>/<repo> --json visibility   # 期望 "PRIVATE"
```

不是 private 就停下、不推送。私钥与凭据值可以上传，前提只有这一条。

## 安全

- 不回显凭据明文（命令输出、回复、日志、commit message 都不放）。
- 不把 `${ENV_ROOT}` 下的文件复制进**其它项目仓库**，也不写进那些仓库 git 跟踪的配置。
- 缺失时如实报告；不要用「大概是」的默认值把流程推进下去。

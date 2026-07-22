---
name: bkt
version: 0.26.5
description: "Use when managing Bitbucket Data Center or Cloud repositories, PRs, branches, issues, webhooks,…"
metadata:
  short-description: Bitbucket CLI for repos, PRs, branches
  compatibility: claude-code, codex-cli
---

# Bitbucket CLI (bkt)

`bkt` is a unified CLI for **Bitbucket Data Center** and **Bitbucket Cloud**. It mirrors `gh` ergonomics and provides structured JSON/YAML output for automation.

## Before You Start

**1. Verify installation** — always check before running any `bkt` command:

```bash
bkt --version
```

If not installed:

| Platform | Command |
|----------|---------|
| macOS/Linux | `brew install avivsinai/tap/bitbucket-cli` |
| Windows | `scoop bucket add avivsinai https://github.com/avivsinai/scoop-bucket && scoop install bitbucket-cli` |
| Go | `go install github.com/avivsinai/bitbucket-cli/cmd/bkt@latest` |
| Binary | Download from [GitHub Releases](https://github.com/avivsinai/bitbucket-cli/releases) |

**2. Check authentication** — most commands require an active session:

```bash
bkt auth status
```

**Bitbucket Cloud Token Requirements:**
- Create an "API token with scopes" (not a general API token)
- Select **Bitbucket** as the application
- Required scope: **Account: Read** (`read:user:bitbucket`)
- Additional scopes as needed: Repositories, Pull requests, Issues

For config-free use in containers and CI pipelines, see [headless authentication](references/headless.md).

If not authenticated, log in:

```bash
# Data Center (PAT-based)
bkt auth login https://bitbucket.example.com --username alice --token <PAT>

# Bitbucket Cloud — OAuth (official binaries open browser out of the box)
bkt auth login https://bitbucket.org --kind cloud --web

# Bitbucket Cloud — API token (--web-token opens Atlassian's token creation page)
bkt auth login https://bitbucket.org --kind cloud --web-token
```

For source and Nix builds, set `BKT_OAUTH_CLIENT_ID` and `BKT_OAUTH_CLIENT_SECRET` env vars before running `--web`.

**3. Set up a context** — contexts bind a host to a project/workspace and optional default repo, so you don't repeat flags on every command:

```bash
# Data Center
bkt context create dc-prod --host bitbucket.example.com --project ABC --set-active

# Cloud
bkt context create cloud-team --host bitbucket.org --workspace myteam --set-active
```

## Platform Awareness

Some commands are **Data Center only** or **Cloud only** — check the command reference for `*(DC)*` and `*(Cloud)*` badges. Key splits:

| Feature | Data Center | Cloud |
|---------|:-----------:|:-----:|
| Pull requests | yes | yes |
| Repositories | yes | yes |
| Branches (list) | yes | yes |
| Branches (create/delete/protect) | yes | — |
| Issues | — | yes |
| Pipelines | — | yes |
| Permissions | yes | — |
| Webhooks | yes | yes |
| Auto-merge, tasks, reactions | yes | — |
| Variables | — | yes |

When a user's context is DC, do not suggest Cloud-only commands (and vice versa). If the platform is unknown, ask or check with `bkt auth status`.

## Overlay (nocode plugin)

本插件在 PR 流程上有 overlay 规则,**finishing / PR 创建场景以 `nocode:dev-land` skill 为准**。主要差异(PreToolUse hook 也会注入/阻断提醒):

- **`bkt pr create` 不要带 `--reviewer` / `--with-default-reviewers`** —— 部分失败会让整个 create 失败、且 cross-fork 时 default-reviewers 解析常出错。nocode 流程: `bkt pr create` 不带 reviewer → 用 `bkt pr edit <id> --reviewer ...` 后加(允许部分失败 + 大小写 fallback)。详见 `dev-land` skill 全景计划 + `skills/dev-land/references/pr-flow-bkt.md` Workflow B。
- **禁 `bkt api --method PUT` 改 PR 元数据** —— PUT 全量替换会清 reviewer 数组。一律 `bkt pr edit`。
- **禁裸 `curl` 改 PR** —— 用 `bkt`,统一鉴权与错误处理。

## Common Workflows

### Create a PR from the current branch

```bash
bkt pr create --title "feat: add caching" --target main
```

Source branch, title, and target default to sensible values from git state. Add `--draft` for work-in-progress。

> ⚠️ **nocode overlay**: 不要在 create 时加 `--reviewer` / `--with-default-reviewers`(见上方 Overlay 段);先 `bkt pr create` 拿到 PR id,再 `bkt pr edit <id> --reviewer alice` 加。

### Review cycle

```bash
bkt pr checks 42 --wait          # Wait for CI to pass
bkt pr approve 42                # Approve
bkt pr merge 42                  # Merge (closes source branch by default)
```

### Checkout a colleague's PR locally

```bash
bkt pr checkout 42               # Creates pr/42 branch
```

### Structured output for scripting

All commands support `--json`, `--yaml`, `--jq`, and `--template`:

```bash
bkt pr list --mine --json | jq '.[].title'
```

### Raw API escape hatch

For endpoints without a dedicated command:

```bash
bkt api /rest/api/1.0/projects --param limit=100 --json
```

## Global Flags

Every command accepts these inherited flags:

| Flag | Short | Purpose |
|------|-------|---------|
| `--context` | `-c` | Use a specific named context |
| `--json` | | JSON output |
| `--yaml` | | YAML output |
| `--jq` | | Apply a jq expression (requires `--json`) |
| `--template` | | Render with Go template |

## References

- [headless / env vars](references/headless.md) — Config-free CI/container auth (BKT_TOKEN, BKT_HOST) and full env var reference

<!-- auto-generated by cmd/docgen — do not edit below this line -->

- [admin](references/admin.md) — Administrative operations for Bitbucket *(DC)*
- [auth](references/auth.md) — Manage Bitbucket authentication credentials
- [branch](references/branch.md) — Inspect and manage branches
- [commit](references/commit.md) — Work with commits
- [context](references/context.md) — Manage Bitbucket CLI contexts
- [extension](references/extension.md) — Manage bkt CLI extensions
- [issue](references/issue.md) — Work with Bitbucket Cloud issues *(Cloud)*
- [perms](references/perms.md) — Manage Bitbucket permissions *(DC)*
- [pipeline](references/pipeline.md) — Run and inspect Bitbucket Cloud pipelines *(Cloud)*
- [pr](references/pr.md) — Manage pull requests
- [project](references/project.md) — Work with Bitbucket projects *(DC)*
- [repo](references/repo.md) — Work with Bitbucket repositories
- [status](references/status.md) — Inspect commit and pull request statuses
- [variable](references/variable.md) — Manage pipeline variables *(Cloud)*
- [webhook](references/webhook.md) — Manage Bitbucket webhooks
- [other](references/other.md) — api

<!-- end auto-generated -->

---
name: coolify-deploy
description: >-
  在 service.yes365.fun 服务器上通过 Coolify 部署应用、经 1Panel OpenResty 高位端口以 HTTPS
  对外暴露时使用——宿主机端口透传、1Panel 反向代理站点、证书绑定与外部验证。
  不触发：本地开发环境、其他服务器、与 Coolify/1Panel 无关的普通编码。
---

# coolify-deploy — Coolify 应用高位端口 HTTPS 对外

本 skill 只服务 `service.yes365.fun` 这一台服务器。端口段、路径、证书均为该机实测值，换服务器需另建。

## 架构

```text
外网 https://service.yes365.fun:400xx
  → 1Panel OpenResty  listen 400xx ssl
  → proxy_pass http://127.0.0.1:20xxx
  → Coolify 应用容器 :<容器端口>
```

外网 80/443 不可达（服务器本机 ufw 已放行 8000-50000，限制在上游 NAT / 安全组）。
Coolify 自带的 Traefik 虽监听 80/443，只有本机可达，**不能作为外网入口**。

## 端口分配

| 段 | 用途 |
|---|---|
| `40050-40100` | 1Panel OpenResty 对外端口 |
| `20000-20099` | Coolify 应用的宿主机映射端口 |
| `40050` | sapling（占位示例，已用） |

### 已占用外部端口（2026-10-29 实测，以 `conf.d` 配置为准）

| 端口 | 反代目标 | 别名 |
|---|---|---|
| 40002 / 40003 | `192.168.110.76:19000` / `:19001` | minio / minio-api |
| 40007 | `192.168.110.76:11434` | ollama |
| 40008 | `127.0.0.1:30001` | Coolify-SubConverter |
| 40009 | `192.168.110.205:5666` | fnOS |
| 40010 | `192.168.110.76:9090` | mihomo |
| 40011 | `127.0.0.1:81` | Dokploy-FileCodeBox |
| 40020 | `192.168.110.76:13000` | Coolify-Admin |
| 40021 | `127.0.0.1:30002`（HTTP，无证书） | Coolify-Proxy |
| 40023 / 40024 | `127.0.0.1:81` | Dokploy-VideoConverter / JsonCrack |
| 40025 | `192.168.110.76:5678` | n8n |
| 40030 | `127.0.0.1:30002` | Dokploy-Test |
| 40031 | static 站点 | static |
| 40040 | `192.168.110.76:30003` | Benchmark |
| 40041 / 40042 | `127.0.0.1:20014` / `:20010` | langfuse-minio / langfuse |
| 40050 | `127.0.0.1:20060` | Coolify-Sapling |

### 已占用宿主机端口

`20010-20017`（langfuse）、`20060`（sapling）、`30001-30003`、`6001-6002` 与 `13000`（Coolify）、
`10015`（1Panel）、`80/443/8080`（Traefik）、`13306`、`3306`、`15432`、`15433`、`16379`、
`19000`、`19001`、`11434`、`9090`。

新应用从 `20050` 起挑空闲端口（`20050` 已在 1Panel 数据库中被历史记录占用，优先避开）。

## 关键路径

| 对象 | 宿主机路径 |
|---|---|
| 站点配置 | `/opt/1panel/apps/openresty/openresty/conf/conf.d/<port>.conf` |
| 站点目录 | `/opt/1panel/apps/openresty/openresty/www/sites/<port>/` |
| 站点证书 | `/opt/1panel/apps/openresty/openresty/www/sites/<port>/ssl/{fullchain,privkey}.pem` |
| 1Panel 数据库 | `/opt/1panel/db/1Panel.db` |

Coolify 面板：`https://service.yes365.fun:40020`。

## 证书

- 有效证书：`service.yes365.fun`（id=5，provider=`dnsAccount`，到期 2026-12-23），**所有 HTTPS 站点共用这一张**
- 80 端口外网不可达，HTTP-01 验证必然失败；新证书必须在 1Panel 用 **DNS 账号（阿里云）** 申请
- 阿里云凭据见 `~/Run/Env/aliyun/dns.env`，域名 NS 必须指向 `*.hichina.com`

## 步骤

### Step 1 部署应用

在 Coolify 面板完成应用创建与首次部署。确认容器实际监听端口（通常是 3000 / 8080），后续映射以它为准。

### Step 2 配置宿主机端口透传

Coolify 应用 → Configuration → Network → **Ports Mappings**，填：

```text
200xx:<容器端口>
```

例：`20055:3000`。保存后重新部署，宿主机 `0.0.0.0:20055` 应映射到容器端口。

不要依赖 Coolify 的 Domains 字段对外提供访问——外网 80/443 不通，Traefik router 只在服务器本地有效。

### Step 3 创建 1Panel 反向代理站点

1Panel → 网站 → 创建网站 → 反向代理：

| 字段 | 值 |
|---|---|
| 域名 | `service.yes365.fun` |
| 端口 | `400xx`（从 40050-40100 挑未占用） |
| 代理地址 | `http://127.0.0.1:200xx` |

保存后应生成 `/www/sites/400xx/` 目录与 `conf.d/400xx.conf`。
若界面不支持自定义端口，直接改 `conf.d/<port>.conf` 的 `listen` 并重载 OpenResty：

```bash
docker exec openresty openresty -t && docker exec openresty openresty -s reload
```

### Step 4 绑定证书

站点 → HTTPS → 选择已有证书 `service.yes365.fun`（id=5）。证书到期前需在 1Panel 重新申请并重新绑定。

### Step 5 验证

```bash
# 证书链与有效期
echo | openssl s_client -connect service.yes365.fun:400xx \
  -servername service.yes365.fun 2>/dev/null | openssl x509 -noout -subject -dates

# HTTP 状态
curl -sS -o /dev/null -w "%{http_code}\n" https://service.yes365.fun:400xx

# 容器端口是否真的通了（在服务器上执行）
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:200xx
```

## 排障

| 现象 | 先查 |
|---|---|
| 502 Bad Gateway | `proxy_pass` 端口是否等于容器映射端口；`curl 127.0.0.1:200xx` 是否通 |
| 连接被拒绝 / 超时 | `ss -tlnp \| grep 400xx`；1Panel 站点是否 Running |
| 证书警告 / 不一致 | 站点是否绑定 id=5；`openssl s_client` 看实际下发证书 |
| 改完不生效 | 1Panel 数据库可能滞后于 `conf.d`，**以配置文件为准**；重载 OpenResty |
| 外网打不开但本机 curl 通 | 上游安全组未放行该端口（仅 40050-40100 段可用） |

## 1Panel MCP

| 项 | 值 |
|---|---|
| 二进制 | `~/.local/share/mise/installs/go-github-com-1panel-dev-mcp-1panel/0.1.3/bin/mcp-1panel` |
| 版本约束 | 本机 1Panel 是 **v1.10.34-lts**，只能用 mcp-1panel **v0.1.3**；v0.2.0+ 写死 `/api/v2`，请求返回 HTML 导致 MCP 报解析错误 |
| 凭据 | `~/Run/Env/service.yes365.fun/1panel.env` |

不走 MCP 直接调 v1 API 时：

```bash
KEY=$(grep PANEL_TOKEN ~/Run/Env/service.yes365.fun/1panel.env | cut -d= -f2)
TS=$(date +%s)
TOKEN=$(printf "1panel%s%s" "$KEY" "$TS" | md5)
curl -s -X POST -H "1Panel-Token: $TOKEN" -H "1Panel-Timestamp: $TS" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"pageSize":10,"orderBy":"created_at","order":"desc"}' \
  http://service.yes365.fun:10015/api/v1/websites/search
```

两条硬约束：**必须用 POST**（GET 会被当 Web 请求返回 HTML）；**签名必须带 `1panel` 前缀**（`md5("1panel" + apiKey + timestamp)`），漏掉前缀返回 `401 API 接口密钥错误`。

## 已知偏差

1Panel 数据库 `websites.proxy` 字段与 `conf.d` 实际配置存在历史不一致
（例：40050 库内 `20050`、配置 `20060`；40020 库内 `13001`、配置 `13000`）。
排查一律以 `conf.d` 为准，不要只看数据库。

配置层手工复制的站点（如 40051）不会写入 1Panel 数据库，UI 中不可见。
功能正常，但面板内无法管理，且在该端口新建站点会冲突。需要面板可管理时，
应删除手工配置后再通过 1Panel 创建。

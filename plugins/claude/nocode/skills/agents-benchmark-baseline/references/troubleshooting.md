# 起不来时的诊断

**根因统一**：fx-data-server 从未被容器化过——它一直是宿主机 `bootRun`（`docker-compose.yml` 里没有这个服务）。宿主机形态下有一批「隐形前提」，进容器后全部失效。下面每条都是实测踩出来的。

## 1 · MinIO 初始化卡死 → bucket 从未创建

**现象**：`docker logs baseline-minio` 反复刷 `Waiting for MinIO to start...`；fx-data-server 随后报 `S3 connect error：can't verify bucket jiushuyun`。

**根因**：`docker-init/minio-init.sh` 里硬编码主机名 `minio`（`mc alias set` + 健康检查循环），而对照组容器名是 `baseline-minio`。

**解法**：给 MinIO 加 Docker 网络别名 `minio`（`docker-compose.baseline.yml` 已含）。同网络的其他容器也能解析。

## 2 · S3 走 virtual-host 寻址

**现象**：`Connect to jiushuyun.baseline-minio:9000 [...] failed: Connection refused`，或 `UnknownHostException: expired.localhost`。

**根因**：`application.yml` 里 `s3.pathStyleAccessEnabled: false`（`expired` 段同），SDK 按 `<bucket>.<endpoint-host>` 拼地址。主环境 endpoint 是 `localhost`，靠 macOS 把 `*.localhost` 解析到 127.0.0.1 侥幸可用；容器内 `jiushuyun.baseline-minio` 会被 OrbStack wildcard DNS 抢答到一个不可达地址。

**解法**：强制 path-style——

```
S3_PATHSTYLEACCESSENABLED=true
EXPIRED_PATHSTYLEACCESSENABLED=true
```

## 3 · expired 段的环境变量前缀

**现象**：加了 `EXPIRED_S3_PATHSTYLEACCESSENABLED=true` 却不生效，仍然 `Connect to expired.baseline-minio:9000`。

**根因**：`ExpiredS3Properties` 的 `@ConfigurationProperties(prefix = "expired")`，属性名是 `expired.pathStyleAccessEnabled`（不是 `expired.s3.*`）。环境变量名必须映射成 `expired.pathstyleaccessenabled`。

**解法**：用 `EXPIRED_PATHSTYLEACCESSENABLED`。

## 4 · local-ws 拉起不存在的子进程

**现象**：`can't find class pathhihidata-ws-server`，启动中断。

**根因**：`application.yml` 里 `local-ws.enabled: true` 会让主服务拉起 `hihidata-ws-server` 子进程，而运行时镜像只含 server 模块。

**解法**：挂载 `docker-init/fx-data-server/application-dev.yml` 到容器 `/config/`（entrypoint 带 `-Dspring.config.additional-location=optional:file:/config/`），覆盖为 `false`。

## 5 · polars 计算节点必须纳入

**现象**：`io.grpc.StatusRuntimeException: UNAVAILABLE`，指向 `localhost:8000`，`Application run failed`。

**根因**：`polars.master.config-str` 硬编码 `localhost:8000`，主服务启动即连。

**解法**：起 `baseline-polars` 容器，用 `POLARS_MASTER_CONFIGSTR=baseline-polars:8000` 覆盖。

**同源坑**：`docker-init/fdb.bash` 原用 `-Dhost=localhost` 注册节点，fx-data-server 在别的容器里回连 `localhost:1270x` 会 `Connection refused`。本 skill 的副本改成 `-Dhost=${POLARS_HOST:-localhost}`，compose 里给 baseline-polars 设 `POLARS_HOST=baseline-polars`——节点注册成 `grpc://baseline-polars:17080`，同网络可解析。

## 6 · RabbitMQ 队列必须在服务启动前存在

**现象**：`Fatal exception on listener startup` → `no queue 'hihidata-web-socket-honeypot-queue' in vhost 'local'`，服务卡死不自动恢复。

**根因**：对照组 RabbitMQ 是空 broker，队列本应由服务启动时声明，但 listener 抢在声明前启动。

**解法**：`start-baseline.sh` 已内置——从主环境 `rabbitmqctl list_queues -p local name` 导出队列名，用管理 API 批量 PUT 到对照组，再起服务。主环境不可达时会跳过，此时首次启动 fx-data-server 可能失败，重跑脚本即可。

**注意**：`SPRING_RABBITMQ_LISTENER_SIMPLE_MISSING_QUEUES_FATAL=false` 对这套自定义 listener 配置未完全生效，不能替代预建。

## 通用排查顺序

```
服务起不来
   │
   ├─ docker logs baseline-fx-data-server | grep "Caused by" | tail -3
   │     取最内层 Caused by —— 它才是根因，外层全是 bean 依赖链
   │
   ├─ 报错含 "Connect to"/"UnknownHost" ──→ 坑 2 / 3 / 5（地址与寻址）
   ├─ 报错含 "can't verify bucket"      ──→ 坑 1（bucket 没建）
   ├─ 报错含 "can't find class"         ──→ 坑 4（模块缺失）
   └─ 报错含 "Failed to declare queue"  ──→ 坑 6（队列没预建）
```

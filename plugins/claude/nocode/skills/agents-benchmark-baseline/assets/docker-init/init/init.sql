CREATE DATABASE sync;

-- sync 服务连接 sync 库并以集群模式跑 Quartz，必须有 qrtz_* 表，否则启动即报错。
-- postgres 入口默认只把 *.sql 跑在 POSTGRES_DB(jiushuyun)上，这里切到刚建好的 sync 库，
-- 复用 qrtz-init.sql 同一份 DDL 建表（qrtz-init.sql 自身随后仍会在 jiushuyun 上各跑一遍）。
\connect
sync
\i /docker-entrypoint-initdb.d/qrtz-init.sql

// server 本地开发的固定 env 表 + 网络相关纯函数。
// 对应 dev-start.sh force_local_infra（69-92）/ .env 加载（60-64）/ purge_proxy_env+proxy_jvm_flags（262-278）/
// host_ip（178-189）/ resolve_polars_rpc_host（280-302）。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 本地模式基础设施地址固定表，纯数据 + overrides 合并，还原 force_local_infra 全部导出变量。
export function localInfraEnv({ overrides = {} } = {}) {
  const base = {
    DB_URL: 'jdbc:postgresql://127.0.0.1:5432/jiushuyun?reWriteBatchedInserts=true',
    DB_USERNAME: 'jiushuyun',
    DB_PASSWORD: 'jiushuyun',
    REDIS_HOST: '127.0.0.1',
    CACHE_MONGO_URI: '127.0.0.1:27017/jiushuyun?authSource=admin',
    CACHE_MONGO_USERNAME: 'admin',
    CACHE_MONGO_PASSWORD: 'jiushuyun',
    DATASOURCE_MONGO_URI: '127.0.0.1:27017/jiushuyun?authSource=admin',
    DATASOURCE_MONGO_USERNAME: 'admin',
    DATASOURCE_MONGO_PASSWORD: 'jiushuyun',
    NEO4J_URL: 'bolt://127.0.0.1:7687',
    ES_HOST: '127.0.0.1',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_INTERNAL_ENDPOINT: 'http://127.0.0.1:9000',
    CDN_ENDPOINT: 'http://127.0.0.1:9000',
    CDN_INTERNAL_ENDPOINT: 'http://127.0.0.1:9000',
    POLARS_HOST: '127.0.0.1',
    INFRA_HOST: '127.0.0.1',
    POLARS_MASTER_CONFIG_STR: '127.0.0.1:8000',
  };
  return { ...base, ...overrides };
}

// 禁代理 JVM 参数，供 JAVA_TOOL_OPTIONS 拼接。对应 proxy_jvm_flags（276-278）。
export function proxyJvmFlags() {
  return `-Djava.net.useSystemProxies=false -Dhttp.nonProxyHosts='*' -Dhttps.nonProxyHosts='*'`;
}

// 返回去掉代理相关 key 的 env 副本（不 mutate 原 env）。对应 purge_proxy_env（271-273）。
export function purgeProxyEnv(env) {
  const out = { ...env };
  for (const k of ['all_proxy', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'no_proxy', 'NO_PROXY']) {
    delete out[k];
  }
  return out;
}

// 加载 <serverDir>/.env（跳过注释/空行；不覆盖已存在的环境变量）。对应 60-64 行 set -a source .env。
export function loadDotEnv({ serverDir, env = process.env } = {}) {
  const file = join(serverDir, '.env');
  if (!existsSync(file)) return {};
  const loaded = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    const v = vRaw.replace(/^["']|["']$/g, '');
    loaded[k] = v;
    if (env[k] === undefined) env[k] = v;
  }
  return loaded;
}

// 主机 IP（前端容器通过此 IP 访问后端和 MinIO）。对应 host_ip（178-189，macOS ifconfig 分支）。
export function hostIp({ exec = execFileSync } = {}) {
  try {
    const out = exec('sh', ['-c', `ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}'`], { encoding: 'utf8' }).trim();
    return out || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

// Polars 容器回连宿主机地址。对应 resolve_polars_rpc_host（280-302），简化为容器优先、宿主回退、fallback 常量三段。
export function resolvePolarsRpcHost({ exec = execFileSync } = {}) {
  const fallback = '192.168.65.254';
  try {
    const names = exec('sh', ['-c', `docker ps --format '{{.Names}}'`], { encoding: 'utf8' });
    if (names.split('\n').includes('polars-local')) {
      const ip = exec('sh', ['-c', `docker exec polars-local getent ahosts host.docker.internal 2>/dev/null | awk 'NR==1 {print $1}'`], { encoding: 'utf8' }).trim();
      if (ip) return ip;
    }
  } catch { /* 容器探测失败，走宿主回退 */ }
  try {
    const ip = exec('python3', ['-c', 'import socket; print(socket.gethostbyname("host.docker.internal"))'], { encoding: 'utf8' }).trim();
    if (ip && !ip.startsWith('0.')) return ip;
  } catch { /* 宿主解析也失败，走 fallback 常量 */ }
  return fallback;
}

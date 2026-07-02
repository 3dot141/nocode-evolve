// 基础设施容器编排。对应 dev-start.sh start_infra（383-452）+ ensure_rabbitmq_queues（333-347）
// + fix_db_permissions（349-359）+ wait_for_es（361-380）+ container_name_of（304-309）。
// 容器全在运行时 startInfra 跳过 compose 与收尾动作（等价原 bash 400-402 行早返回）；
// readiness/DB 权限/ES 等待的兜底在 startApp（fixDbPermissions+waitForEs 每次启动都跑），
// full 档 compose 全量重建后也由 startApp 兜底（红蓝裁决 G）。
import { execFileSync } from 'node:child_process';

export const INFRA_SERVICES = ['postgresql', 'redis', 'mongodb', 'rabbitmq', 'neo4j', 'minio', 'elasticsearch'];

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function containerNameOf(svc) {
  return svc === 'postgresql' ? 'postgres' : svc;
}

export async function waitForEs({ fetchFn = fetch, maxRetries = 30, intervalMs = 2000, sleep = realSleep } = {}) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const r = await fetchFn('http://localhost:9200/_cluster/health', {
        headers: { Authorization: `Basic ${Buffer.from('elastic:jiushuyun').toString('base64')}` },
      });
      const body = await r.json();
      if (body.status === 'green' || body.status === 'yellow') return true;
    } catch { /* ES 还没起来，继续重试 */ }
    await sleep(intervalMs);
  }
  return false;
}

function ensureRabbitmqQueues({ exec }) {
  const queues = [
    'hihidata-web-socket-honeypot-queue',
    'hihidata-web-socket-refresh-jsy-token-queue',
    'hihidata-web-socket-jsy-refresh-token-fanout-message-queue',
  ];
  for (const q of queues) {
    try {
      const listed = exec('sh', ['-c', `docker exec rabbitmq rabbitmqadmin -u test -p test -V local list queues name`], { encoding: 'utf8' });
      if (listed.includes(q)) continue;
      exec('sh', ['-c', `docker exec rabbitmq rabbitmqadmin -u test -p test -V local declare queue name="${q}" durable=true`]);
    } catch { /* 声明失败不阻塞启动，下次重试 */ }
  }
}

export function fixDbPermissions({ exec = execFileSync, dbUser = 'jiushuyun' } = {}) {
  try {
    exec('sh', ['-c', `docker exec postgres psql -U postgres -d jiushuyun -c "GRANT ALL ON TABLE flyway_history_post_startup TO ${dbUser};"`]);
    return true;
  } catch {
    return false;
  }
}

function disableEsDiskThreshold({ exec }) {
  try {
    exec('sh', ['-c', `curl --noproxy localhost -s -X PUT http://localhost:9200/_cluster/settings -u elastic:jiushuyun -H 'Content-Type: application/json' -d '{"transient":{"cluster.routing.allocation.disk.threshold_enabled":false}}'`]);
  } catch { /* 非阻塞：磁盘水位关闭失败不影响启动，只是单节点开发环境可能因磁盘满报警 */ }
}

// 编排：检查容器 → 起缺的 → 等 PG+ES 就绪 → 队列 + 权限 + ES 配置收尾。
export async function startInfra({ exec = execFileSync, fetchFn = fetch, env = process.env, sleep = realSleep, log = console.log } = {}) {
  const running = new Set(
    exec('sh', ['-c', `docker ps --format '{{.Names}}'`], { encoding: 'utf8' }).split('\n').filter(Boolean),
  );
  const needStart = INFRA_SERVICES.filter((svc) => !running.has(containerNameOf(svc)));

  if (needStart.length === 0) {
    log('[infra] 所有基础设施容器已就绪');
    return { started: [], pgReady: true, esReady: true };
  }

  log(`[infra] 启动容器: ${needStart.join(' ')}`);
  exec('sh', ['-c', `docker compose up -d ${needStart.join(' ')}`]);

  let pgReady = false;
  try {
    exec('sh', ['-c', 'docker exec postgres pg_isready -q']);
    pgReady = true;
  } catch { /* 未就绪，调用方按需重试 */ }

  const esReady = await waitForEs({ fetchFn, sleep });

  if (pgReady && esReady) {
    ensureRabbitmqQueues({ exec });
    fixDbPermissions({ exec, dbUser: env.DB_USERNAME });   // env.DB_USERNAME 未设时 fixDbPermissions 走自身默认值 'jiushuyun'
    disableEsDiskThreshold({ exec });
  }

  return { started: needStart, pgReady, esReady };
}

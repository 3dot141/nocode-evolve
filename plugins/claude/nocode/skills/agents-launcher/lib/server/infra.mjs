// Docker 启动规则来自目标 fx-data-server 仓的 dockerstart.sh；本模块只负责调用派生脚本、
// 验证 launcher 所需后置条件，以及应用启动前的 RabbitMQ/DB/ES 收尾。
import { execFileSync } from 'node:child_process';
import { tcpOpen } from '../probe.mjs';
import { runGeneratedDockerStart } from './docker-adapter.mjs';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

export async function waitForInfraPorts({
  tcpCheck = tcpOpen,
  maxRetries = 60,
  intervalMs = 1000,
  sleep = realSleep,
} = {}) {
  for (let i = 0; i < maxRetries; i++) {
    if ((await tcpCheck(5432)) && (await tcpCheck(9000))) return true;
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

export async function startInfra({
  exec = execFileSync,
  fetchFn = fetch,
  tcpCheck = tcpOpen,
  runDocker = runGeneratedDockerStart,
  env = process.env,
  sleep = realSleep,
  log = console.log,
  serverDir,
  portRetries = 60,
  esRetries = 30,
} = {}) {
  const docker = runDocker({ serverDir, exec, env, log });
  const portsReady = await waitForInfraPorts({
    tcpCheck,
    maxRetries: portRetries,
    sleep,
  });
  if (!portsReady) {
    throw new Error('server Docker 脚本执行完成，但 PostgreSQL :5432 / MinIO :9000 未就绪');
  }

  const esReady = await waitForEs({
    fetchFn,
    maxRetries: esRetries,
    sleep,
  });
  if (!esReady) {
    throw new Error('server Docker 脚本执行完成，但 Elasticsearch :9200 未就绪');
  }

  ensureRabbitmqQueues({ exec });
  fixDbPermissions({ exec, dbUser: env.DB_USERNAME });
  disableEsDiskThreshold({ exec });
  return { docker, portsReady, esReady };
}

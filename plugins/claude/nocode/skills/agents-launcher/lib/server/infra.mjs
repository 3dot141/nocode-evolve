import { execFileSync } from 'node:child_process';
import {
  existsSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tcpOpen } from '../probe.mjs';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DOCKER_SCRIPT_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const DOCKER_SCRIPTS = Object.freeze({
  persist: join(DOCKER_SCRIPT_DIR, 'docker', 'persist.sh'),
  release: join(DOCKER_SCRIPT_DIR, 'docker', 'release.sh'),
  dev: join(DOCKER_SCRIPT_DIR, 'docker', 'dev.sh'),
});

export function resolveDockerProfile({ branchName, env = process.env } = {}) {
  const explicit = env.FX_DOCKER_PROFILE;
  if (explicit && Object.hasOwn(DOCKER_SCRIPTS, explicit)) return explicit;
  const branch = String(branchName || '').toLowerCase();
  if (branch.includes('persist')) return 'persist';
  if (branch.includes('release')) return 'release';
  return 'dev';
}

export function resolveDockerScript({ serverDir, exec = execFileSync, env = process.env } = {}) {
  const branchName = String(exec('git', ['branch', '--show-current'], {
    cwd: serverDir,
    encoding: 'utf8',
  })).trim();
  const profile = resolveDockerProfile({ branchName, env });
  const scriptPath = DOCKER_SCRIPTS[profile];
  if (!existsSync(scriptPath) || !statSync(scriptPath).isFile()) {
    throw new Error(`固定 Docker 启动脚本不存在: ${scriptPath}`);
  }
  return { branchName, profile, scriptPath };
}

export function runFixedDockerStart({
  serverDir,
  scriptPath,
  env = process.env,
  exec = execFileSync,
  log = console.log,
} = {}) {
  if (!scriptPath || !existsSync(scriptPath) || !statSync(scriptPath).isFile()) {
    throw new Error(`固定 Docker 启动脚本不存在: ${scriptPath || '(未解析)'}`);
  }
  exec('bash', ['-n', scriptPath], { cwd: serverDir, env, stdio: 'inherit' });
  log(`[infra] 执行固定 Docker 脚本: ${scriptPath}`);
  exec('bash', [scriptPath], { cwd: serverDir, env, stdio: 'inherit' });
  return { scriptPath };
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
  runDocker = runFixedDockerStart,
  env = process.env,
  sleep = realSleep,
  log = console.log,
  serverDir,
  dockerScriptPath,
  portRetries = 60,
  esRetries = 30,
} = {}) {
  const resolved = dockerScriptPath
    ? { profile: 'custom', branchName: '', scriptPath: dockerScriptPath }
    : resolveDockerScript({ serverDir, exec, env });
  const docker = runDocker({
    serverDir,
    scriptPath: resolved.scriptPath,
    exec,
    env,
    log,
  });
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
  return { docker, profile: resolved.profile, branchName: resolved.branchName, portsReady, esReady };
}

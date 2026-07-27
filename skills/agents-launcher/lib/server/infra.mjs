import { execFileSync } from 'node:child_process';
import {
  existsSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, isAbsolute, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { tcpOpen } from '../probe.mjs';

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GENERATED_SCRIPT_PREFIX = 'agents-launcher-docker-';

export function validatePreparedDockerScript({
  scriptPath,
  exists = existsSync,
  realpath = realpathSync,
  stat = statSync,
  tempDir = tmpdir(),
} = {}) {
  if (!scriptPath) {
    throw new Error('FX_DOCKER_START_SCRIPT 未设置：请先按 references/server.md 读取 dockerstart.sh 并生成临时脚本');
  }
  if (!exists(scriptPath)) {
    throw new Error(`Agent 生成的 Docker 临时脚本不存在: ${scriptPath}`);
  }

  const resolvedScriptPath = realpath(scriptPath);
  if (!stat(resolvedScriptPath).isFile()) {
    throw new Error(`Docker 临时脚本不是普通文件: ${resolvedScriptPath}`);
  }
  const resolvedTempDir = realpath(tempDir);
  const relativePath = relative(resolvedTempDir, resolvedScriptPath);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relativePath)) {
    throw new Error(`Docker 启动脚本必须位于系统临时目录: ${resolvedScriptPath}`);
  }

  const filename = basename(resolvedScriptPath);
  if (!filename.startsWith(GENERATED_SCRIPT_PREFIX)) {
    throw new Error(`Docker 临时脚本名称必须以 ${GENERATED_SCRIPT_PREFIX} 开头: ${filename}`);
  }
  return resolvedScriptPath;
}

export function runPreparedDockerStart({
  serverDir,
  scriptPath,
  exec = execFileSync,
  env = process.env,
  log = console.log,
  remove = rmSync,
} = {}) {
  const resolvedScriptPath = validatePreparedDockerScript({ scriptPath });
  try {
    exec('bash', ['-n', resolvedScriptPath], {
      cwd: serverDir,
      env,
      stdio: 'inherit',
    });
    log(`[infra] 执行 Agent 生成的临时 Docker 脚本: ${resolvedScriptPath}`);
    exec('bash', [resolvedScriptPath], {
      cwd: serverDir,
      env,
      stdio: 'inherit',
    });
    return { scriptPath: resolvedScriptPath };
  } finally {
    remove(resolvedScriptPath, { force: true });
  }
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
  runDocker = runPreparedDockerStart,
  env = process.env,
  sleep = realSleep,
  log = console.log,
  serverDir,
  dockerScriptPath,
  portRetries = 60,
  esRetries = 30,
} = {}) {
  const docker = runDocker({
    serverDir,
    scriptPath: dockerScriptPath,
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
  return { docker, portsReady, esReady };
}

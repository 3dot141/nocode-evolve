// Spring Boot 应用启动。对应 dev-start.sh patch_gc_for_graaljs（234-241）+ start_app（498-673）。
// 与原脚本的关键差异：端口占用时不做交互式 y/N 问询（CLI 非交互，restate 约束.1），
// 默认 fail loud，调用方需显式传 killOld=true 才杀旧进程重启。
// start 不内嵌 ANTLR prepare——生成 task 挂在 compileJava.dependsOn（新旧两代 build.gradle.kts
// 均已核实），bootRun 自愈；prepare 是 IDE 场景专用入口（红蓝裁决 F，有证据驳回）。
import { existsSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import { pidOnPort } from '../probe.mjs';
import { purgeProxyEnv, proxyJvmFlags, hostIp, resolvePolarsRpcHost, localInfraEnv } from './env.mjs';
import { fixDbPermissions, waitForEs } from './infra.mjs';

// ZGC 与 GraalVM 21 的 JVMCI 不兼容，临时 patch 为 G1GC。幂等：已 patch 过则跳过。
// 对应 234-241 行 sed 逻辑。
export function patchGcForGraaljs({ serverDir }) {
  const file = join(serverDir, 'build.gradle.kts');
  if (!existsSync(file)) return { patched: false, reason: 'build.gradle.kts 不存在' };
  const content = readFileSync(file, 'utf8');
  if (!content.includes('+UseZGC')) return { patched: false, reason: '未使用 ZGC，无需 patch' };

  const patched = content
    .replace('"-XX:+UseZGC"', '"-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions", "-XX:+EnableJVMCI"')
    .split('\n')
    .filter((line) => !line.includes('ZGenerational'))
    .join('\n');
  writeFileSync(file, patched);
  return { patched: true };
}

// bootRun 用的 env（S3/CDN endpoint + JAVA_TOOL_OPTIONS）。对应 526-531 + 605-614 行。
export function buildBootRunEnv({ hostIp, rpcHost, baseEnv = {} } = {}) {
  return {
    ...baseEnv,
    S3_ENDPOINT: baseEnv.S3_ENDPOINT || `http://${hostIp}:9000`,
    CDN_ENDPOINT: baseEnv.CDN_ENDPOINT || `http://${hostIp}:9000`,
    JAVA_TOOL_OPTIONS: `${baseEnv.JAVA_TOOL_OPTIONS || ''} ${proxyJvmFlags()} -Drpc.host=${rpcHost}`.trim(),
  };
}

// 容器内自举脚本：装 gradle → bootJar → java -jar。对应 585-609 行。
export const CONTAINER_BOOT_SCRIPT = [
  'apt-get update -qq && apt-get install -y -qq git procps iproute2 unzip curl >/dev/null 2>&1',
  'GRADLE_HOME=/opt/gradle',
  'if [ ! -d "$GRADLE_HOME" ]; then curl -sL https://services.gradle.org/distributions/gradle-8.5-bin.zip -o /tmp/gradle.zip && unzip -q /tmp/gradle.zip -d /opt && mv /opt/gradle-8.5 $GRADLE_HOME; fi',
  'export PATH=$GRADLE_HOME/bin:$PATH',
  'gradle bootJar --no-daemon --no-parallel --max-workers=1 > /app/dev-start.log 2>&1',
  'java -jar build/libs/*.jar > /app/dev-start-run.log 2>&1',
].join('\n');

// 容器分支命令构造（本地无 GraalVM 时）。对应 541-609 行。不在自动化测试里真跑，仅测命令构造。
export function buildContainerRunArgs({ serverDir, image, envArgs }) {
  return [
    'run', '-d', '--name', 'dev-backend', '--privileged', '--network=host',
    '-v', `${serverDir}:/app`, '-w', '/app',
    ...envArgs.flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    '-e', 'GRADLE_OPTS=-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=1',
    image,
    'bash', '-c', CONTAINER_BOOT_SCRIPT,
  ];
}

// 容器分支的存活检查（原 626-629 行）。
function containerRunning({ exec = execFileSync } = {}) {
  try { return exec('sh', ['-c', `docker ps --format '{{.Names}}'`], { encoding: 'utf8' }).split('\n').includes('dev-backend'); }
  catch { return false; }
}

// 启动应用主流程。graalvm 为 T2 detectGraalvm 的结果。
export async function startApp({ serverDir, appPort = 8081, graalvm, env = process.env, exec = execFileSync, spawn = nodeSpawn, fetchFn = fetch, waitFn = waitAppHealthy, killOld = false, log = console.log } = {}) {
  const existingPid = pidOnPort(appPort, { exec });
  if (existingPid) {
    if (!killOld) {
      throw new Error(`端口 ${appPort} 已被占用 (PID: ${existingPid})。传 --kill-old 杀旧进程后重启，或先手动确认。`);
    }
    log(`[start] 端口 ${appPort} 被占用 (PID: ${existingPid})，killOld=true，终止旧进程`);
    try { exec('kill', [existingPid]); } catch { /* 进程可能已经退出 */ }
  }

  // 复用 infra.mjs 实现（原 521 行 fix_db_permissions），不重复内联 SQL
  try { fixDbPermissions({ exec }); } catch { /* 非阻塞 */ }
  // 原 524 行 wait_for_es：ES 刚重启时 Spring 上下文初始化会失败，等 green/yellow 再起（超时 warn 不阻断）
  await waitForEs({ fetchFn });

  if (graalvm.mode === 'missing') {
    throw new Error('未找到 GraalVM 且无 docker 可用，无法启动（bootRun 需要 EnableJVMCI）');
  }

  if (graalvm.mode === 'container') {
    try { exec('docker', ['rm', '-f', 'dev-backend']); } catch { /* 旧容器可能不存在 */ }
    const args = buildContainerRunArgs({
      serverDir,
      image: graalvm.image,
      // 原 548-573 行：完整基础设施 env 清单传给容器（容器内 bootJar + java -jar 需要）
      envArgs: [
        ...Object.entries(localInfraEnv({ overrides: {} })),
        ['APP_PORT', String(appPort)], ['GRPC_PORT', '9090'], ['MGMT_PORT', '8075'],
        ['SPRING_PROFILES_ACTIVE', 'dev'],
      ],
    });
    log(`[start] 本地无 GraalVM，用容器方案启动 (docker run …${args.length} args)`);
    exec('docker', args);
    writeFileSync(join(serverDir, '.dev-start.pid'), 'container');   // 原 604 行
    await waitFn({ appPort, alive: () => containerRunning({ exec }), fetchFn, log });
    return { mode: 'container' };
  }

  // 本地分支：patch GC → 拼 env → 后台 bootRun
  patchGcForGraaljs({ serverDir });
  const cleanEnv = purgeProxyEnv({ ...env, JAVA_HOME: graalvm.javaHome });
  // 原 526-531/612 行：S3/CDN 用宿主机 IP 兜底，rpc.host 从 polars 容器视角动态解析（写死会在 Docker Desktop 环境失联）
  const bootEnv = buildBootRunEnv({ hostIp: hostIp({ exec }), rpcHost: resolvePolarsRpcHost({ exec }), baseEnv: cleanEnv });

  // 原 615 行 `> dev-start.log 2>&1 &` 语义：输出必须重定向文件——pipe 无人消费会在 64KB
  // 缓冲后背压挂死 gradle（Review C1）；detached + unref 后台脱管，launcher 退出 bootRun 继续跑
  const logFd = openSync(join(serverDir, 'dev-start.log'), 'w');
  let child;
  try {
    child = spawn('./gradlew', ['bootRun', '--no-build-cache'], {
      cwd: serverDir,
      env: bootEnv,
      stdio: ['ignore', logFd, logFd],
      detached: true,
    });
  } finally {
    closeSync(logFd);   // 子进程已持有 fd 副本，父进程侧关闭
  }
  child.unref?.();
  writeFileSync(join(serverDir, '.dev-start.pid'), String(child.pid));
  // 原 620-661 行：等待 编译+Spring 初始化（最多 180×2s=6 分钟），进程死掉立即 fail loud
  await waitFn({ appPort, alive: () => { try { process.kill(child.pid, 0); return true; } catch { return false; } }, fetchFn, log });
  return { mode: 'local', pid: child.pid };
}

// 应用健康等待（原 620-661 行）：每轮先查存活再探 HTTP，进程/容器死亡立即抛错。
export async function waitAppHealthy({ appPort = 8081, alive = () => true, fetchFn = fetch, maxRetries = 180, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log } = {}) {
  for (let i = 0; i < maxRetries; i++) {
    if (!alive()) throw new Error('应用启动失败，查看日志: tail -50 dev-start.log');
    try {
      const r = await fetchFn(`http://localhost:${appPort}/`, { signal: AbortSignal.timeout(1500) });
      if (r.status >= 200 && r.status < 500) { log('[start] 应用启动成功'); return true; }
    } catch { /* 未就绪继续等 */ }
    await sleep(2000);
  }
  throw new Error(`等待超时（${maxRetries * 2}s），应用可能仍在启动中——tail -f dev-start.log 查看`);
}

// server 停止 + 状态查询。对应 dev-start.sh stop_app（859-907）+ show_status 后端段（997-1019）。
// 基础设施容器状态不在此——已由 dev-orchestrator.mjs --status 覆盖 pg/minio 探测，不重复。
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pidOnPort } from '../probe.mjs';

export function stopApp({ serverDir, appPort = 8081, exec = execFileSync, log = console.log } = {}) {
  let killed = false;

  try {
    exec('docker', ['rm', '-f', 'dev-backend']);
    killed = true;
    log('[stop] 已停止容器 dev-backend');
  } catch { /* 容器模式未使用，忽略 */ }

  const pidFile = join(serverDir, '.dev-start.pid');
  if (existsSync(pidFile)) {
    const pid = readFileSync(pidFile, 'utf8').trim();
    if (pid && pid !== 'container') {
      try { exec('kill', ['--', `-${pid}`]); } catch { try { exec('kill', [pid]); } catch { /* 进程已退出 */ } }
      killed = true;
      log(`[stop] 已终止进程组 (PID: ${pid})`);
    }
    unlinkSync(pidFile);
  }

  const residualPid = pidOnPort(appPort, { exec });
  if (residualPid) {
    try { exec('kill', [residualPid]); } catch { /* 已退出 */ }
    killed = true;
    log(`[stop] 已终止 :${appPort} 残留进程 (PID: ${residualPid})`);
  }

  if (!killed) {
    log('[stop] 未找到运行中的后端服务');
  }
  return { killed };
}

export function serverStatus({ appPort = 8081, grpcPort = 9090, mgmtPort = 8075, exec = execFileSync } = {}) {
  const row = (name, port) => {
    const pid = pidOnPort(port, { exec });
    return { name, port, up: Boolean(pid), pid: pid || '-' };
  };
  return {
    http: row('HTTP', appPort),
    grpc: row('gRPC', grpcPort),
    mgmt: row('管理', mgmtPort),
  };
}

// 端口/健康探测公共原语。原内联在 dev-orchestrator.mjs（tcpOpen/httpOk 60-70 行，
// pidOn 19-32 行），三个 CLI（server-cli/web-cli/agents-cli）都要用，抽成独立模块。
import { execFileSync } from 'node:child_process';
import net from 'node:net';

// TCP 端口是否有进程在监听。
export function tcpOpen(port, { host = '127.0.0.1', timeoutMs = 800 } = {}) {
  return new Promise((res) => {
    const s = net.connect({ host, port }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.setTimeout(timeoutMs, () => { s.destroy(); res(false); });
  });
}

// HTTP 探测：2xx-4xx 视为"进程活着"（4xx 也说明服务在响应，只有网络层失败才算 DOWN）。
export async function httpOk(url, { timeoutMs = 1500 } = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return r.status >= 200 && r.status < 500;
  } catch {
    return false;
  }
}

// 监听某端口的进程 PID，没有则返回 ''。可注入 exec 便于测试。
export function pidOnPort(port, { exec = execFileSync } = {}) {
  try {
    return exec('sh', ['-c', `lsof -ti tcp:${port} -sTCP:LISTEN | head -1`], { encoding: 'utf8' }).trim() || '';
  } catch {
    return '';
  }
}

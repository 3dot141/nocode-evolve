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
// redirect: 'manual'——探测只关心"有没有 HTTP 响应"，follow 会掉进登录页 302 循环
// （release 版 Spring `/` → /decision/home → /decision/user/login → /decision/login 互踢），
// fetch 追满 20 次重定向上限抛错被吞成"未就绪"，健康检查永远不过。
export async function httpOk(url, { timeoutMs = 1500 } = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
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

// 某进程的工作目录（归属判定的依据），取不到返回 ''。macOS 无 /proc，统一走 lsof -Fn 输出解析
// （`n` 行为路径；`-a -d cwd` 限定只查 cwd 描述符，避免拉全量 fd 又慢又难解析）。
export function processCwd(pid, { exec = execFileSync } = {}) {
  if (!pid) return '';
  try {
    const out = exec('sh', ['-c', `lsof -a -p ${pid} -d cwd -Fn 2>/dev/null | grep '^n' | head -1`], { encoding: 'utf8' });
    return out.replace(/^n/, '').trim() || '';
  } catch {
    return '';
  }
}

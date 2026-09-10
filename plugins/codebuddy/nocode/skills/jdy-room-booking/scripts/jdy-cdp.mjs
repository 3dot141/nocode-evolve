// 共享 CDP 助手：连接 headless Chrome(已登录简道云的 profile)，在页面内执行 fetch。
// 认证全程留在浏览器里——cookie 自动带、csrf 从页面 meta 读，脚本不提取任何凭证。
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../references/config.json', import.meta.url)));
const PORT = cfg.cdpPort;

function rpc(ws, pending) {
  let idc = 0;
  return (method, params = {}) => {
    const id = ++idc;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(() => { if (pending.delete(id)) reject(new Error(`CDP ${method} 超时`)); }, 30000);
    });
  };
}

async function version() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(4000) });
  return r.json();
}

// 在已登录页面内执行一段 async IIFE 表达式，返回其 JSON 结果。
// expression 里可用全局 __H（含 csrf 的请求头）和 __CFG（config.json）。
export async function evalInPage(expression) {
  let ver;
  try { ver = await version(); } catch {
    throw new Error(`调试端口 ${PORT} 无响应——先启动 headless Chrome（见 SKILL.md 前置检查）`);
  }
  const bws = new WebSocket(ver.webSocketDebuggerUrl);
  const bp = new Map();
  bws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && bp.has(m.id)) { bp.get(m.id)(m.result ?? m.error); bp.delete(m.id); } });
  await new Promise((res, rej) => { bws.addEventListener('open', res); bws.addEventListener('error', () => rej(new Error('CDP 连接失败'))); });
  const bsend = rpc(bws, bp);

  const { targetId } = await bsend('Target.createTarget', { url: cfg.dashboardUrl });
  let pageWsUrl;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const t = list.find((x) => x.id === targetId);
    if (t?.webSocketDebuggerUrl) { pageWsUrl = t.webSocketDebuggerUrl; break; }
  }
  if (!pageWsUrl) { await bsend('Target.closeTarget', { targetId }); throw new Error('页面 target 未就绪'); }

  const pws = new WebSocket(pageWsUrl);
  const pp = new Map();
  pws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pp.has(m.id)) { pp.get(m.id)(m.result ?? m.error); pp.delete(m.id); } });
  await new Promise((r) => pws.addEventListener('open', r));
  const psend = rpc(pws, pp);
  await psend('Runtime.enable');
  await new Promise((r) => setTimeout(r, 6000)); // SPA 加载 + 可能重定向到 signin

  const wrapped = `(async () => {
    if (/signin/i.test(location.href)) return { __error: 'not_logged_in', url: location.href };
    const token = (document.querySelector('meta[name=csrf-token]') || {}).content || window.jdy_csrf_token;
    if (!token) return { __error: 'no_csrf' };
    const __H = { 'content-type': 'application/json', 'x-jdy-ver': ${JSON.stringify(cfg.jdyVer)}, 'x-csrf-token': token };
    const __CFG = ${JSON.stringify(cfg)};
    return await (${expression})(__H, __CFG);
  })()`;
  const res = await psend('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true });
  await bsend('Target.closeTarget', { targetId });
  try { pws.close(); bws.close(); } catch { /* 关闭 socket，避免打开的句柄吊住 node 进程 */ }
  const value = res?.result?.value;
  if (value?.__error === 'not_logged_in') throw new Error(`简道云未登录（当前在 ${value.url}）——请在 headless profile 里先登录`);
  if (value?.__error === 'no_csrf') throw new Error('页面未就绪或取不到 csrf token');
  if (value === undefined) throw new Error('页面内执行无返回：' + JSON.stringify(res).slice(0, 200));
  return value;
}

export { cfg };

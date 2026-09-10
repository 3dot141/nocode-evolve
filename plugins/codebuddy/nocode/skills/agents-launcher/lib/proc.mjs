import { spawn } from 'node:child_process';

// 共享进程基础设施（waitHealthy/runToEnd/spawnPrefixed）。
// per-service 杀法已下沉各 CLI 的 killCommands（agents-cli/web-cli/server-cli），此处不再持有。

export async function waitHealthy(label, checkFn, opts = {}) {
  const { tries = 60, intervalMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  for (let i = 1; i <= tries; i++) {
    if (await checkFn()) return true;
    await sleep(intervalMs);
  }
  throw new Error(`[${label}] 健康检查超时（${tries} 次）`);
}

// 副作用：跑一条命令到结束（用于 kill / docker）。打印将执行的命令。
export function runToEnd(label, command, args, opts = {}) {
  return new Promise((resolve) => {
    process.stdout.write(`[${label}] $ ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, { stdio: 'inherit', ...opts });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

// 副作用：长驻进程 + 行前缀日志，返回 child。
export function spawnPrefixed(label, command, args, opts = {}) {
  process.stdout.write(`[${label}] $ ${command} ${args.join(' ')}\n`);
  const child = spawn(command, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
  const pipe = (stream, sink) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const parts = buf.split('\n');
      buf = parts.pop();
      for (const l of parts) sink.write(`[${label}] ${l}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 共享进程基础设施（waitHealthy/runToEnd/spawnPrefixed）。
// per-service 杀法已下沉各 CLI 的 killCommands（agents-cli/web-cli/server-cli），此处不再持有。
// 服务子进程日志目录，可用 FX_LAUNCHER_LOG_DIR 覆盖（测试也靠它隔离）。
export function launcherLogDir() {
  return process.env.FX_LAUNCHER_LOG_DIR ?? join(tmpdir(), 'fx-launcher');
}

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
// 子进程 stdout/stderr 直接落 <logDir>/<label>.log，不走管道：父进程（launcher）猝死时管道写端
// 断裂会让服务在下一次写日志时 SIGPIPE 陪葬（2026-09-18 实证：orchestrator 被杀后 agents 跟着死，
// Spring 因写文件而幸存）。回显改由 tail -F 跟随该文件实现——tail 是 launcher 的子进程，
// launcher 死了它一起走，不影响服务本体。
export function spawnPrefixed(label, command, args, opts = {}) {
  process.stdout.write(`[${label}] $ ${command} ${args.join(' ')}\n`);
  const logDir = launcherLogDir();
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${label}.log`);
  appendFileSync(logPath, `\n===== ${new Date().toISOString()} ${command} ${args.join(' ')} =====\n`);
  const logFd = openSync(logPath, 'a');
  const child = spawn(command, args, { ...opts, stdio: ['ignore', logFd, logFd] });
  closeSync(logFd);   // 子进程已持有副本，父进程这份可以关掉
  const tail = spawn('tail', ['-n', '0', '-F', logPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  const pipe = (stream, sink) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const parts = buf.split('\n');
      buf = parts.pop();
      for (const l of parts) sink.write(`[${label}] ${l}\n`);
    });
  };
  pipe(tail.stdout, process.stdout);
  pipe(tail.stderr, process.stderr);
  // 子进程退出后回收 tail；tail 不会随子进程重启，服务重启会新起一个 tail
  const stopTail = () => { try { tail.kill(); } catch { /* 已退出 */ } };
  child.once('exit', stopTail);
  child.logPath = logPath;
  child.logTail = tail;
  return child;
}

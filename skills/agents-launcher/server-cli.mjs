#!/usr/bin/env node
// server (fx-data-server Spring Boot) 独立 dev CLI。取代 scripts/dev-start.sh 的 app 相关子命令
// （ui/sync/fresh/remote/all/restart 不迁移，见设计文档 Out of Scope）。
// 用法: FX_SERVER_DIR=<repo> node server-cli.mjs <verb> [--yes] [--kill-old]
//   verb: prepare（infra/start/stop/status 由 T3/T4/T4b 渐进挂载）
import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateRepos } from './lib/paths.mjs';
import { detectGraalvm } from './lib/server/graalvm.mjs';
import { startInfra } from './lib/server/infra.mjs';

const ANTLR_MODULE = 'fx-agent-workspace';
// 新旧两代 fx-agent-workspace build.gradle.kts 接线不同，产物目录不同，两个都探测。
const ANTLR_OUTPUT_DIRS = ['src/main/antlr-generated', 'src/main/generated'];

export async function prepare({ serverDir, exec = execFileSync, log = console.log } = {}) {
  const moduleDir = join(serverDir, ANTLR_MODULE);
  if (!existsSync(moduleDir)) {
    throw new Error(`ANTLR 预热失败：模块目录不存在 ${moduleDir}（fx-agent-workspace 模块缺失或路径不对）`);
  }

  log(`[prepare] 检测 GraalVM...`);
  const graalvm = detectGraalvm({ serverDir, exec });
  if (graalvm.mode === 'local') log(`[prepare] GraalVM: ${graalvm.javaHome}`);
  else if (graalvm.mode === 'container') log(`[prepare] 本地无 GraalVM，start 阶段将用容器方案（${graalvm.image}）`);
  else log(`[prepare] ⚠️ 未找到 GraalVM 且无 docker，start 阶段会失败`);

  log(`[prepare] 跑 ANTLR 语法生成（gradlew :${ANTLR_MODULE}:generateGrammarSource）...`);
  exec('./gradlew', [`:${ANTLR_MODULE}:generateGrammarSource`], { cwd: serverDir, stdio: 'inherit' });

  const producedDir = ANTLR_OUTPUT_DIRS.find((rel) => dirHasFiles(join(moduleDir, rel)));
  if (!producedDir) {
    throw new Error(
      `ANTLR 预热跑完但未检出产物（检查过 ${ANTLR_OUTPUT_DIRS.join(' / ')}），` +
      `生成目录是 gitignored 的，新 worktree 首次必须跑这一步，IDE 才不会对 Lexer/Parser/Visitor 类报红`,
    );
  }
  log(`[prepare] ANTLR 产物就绪: ${moduleDir}/${producedDir}`);
  return { graalvm, antlrOutputDir: producedDir };
}

function dirHasFiles(dir) {
  if (!existsSync(dir)) return false;
  try {
    // fs 递归遍历（不依赖 shell find，可测且跨平台；node 18.17+ 支持 recursive）
    return readdirSync(dir, { recursive: true, withFileTypes: true }).some((e) => e.isFile());
  } catch {
    return false;
  }
}

// 渐进挂载清单：T3/T4/T4b 各自补一个 case 时同步 push 自己的动词名，default 报错文案据此动态生成，
// 避免声明未实现的假契约（红蓝裁决 A）。
const SUPPORTED_VERBS = ['prepare'];
SUPPORTED_VERBS.push('infra');   // T3 挂载

async function main() {
  const [verb] = process.argv.slice(2);
  const serverDir = process.env.FX_SERVER_DIR;
  if (!serverDir) throw new Error('FX_SERVER_DIR 未设置');
  validateRepos({ SERVER_DIR: serverDir }, { need: ['SERVER_DIR'] });

  switch (verb) {
    case 'prepare':
      await prepare({ serverDir });
      break;
    case 'infra':
      await startInfra();
      break;
    // start / stop / status 由 T4 / T4b 补挂到这个 switch，并各自 SUPPORTED_VERBS.push(...)
    default:
      console.error(`不支持的 verb: ${verb}（当前支持: ${SUPPORTED_VERBS.join('|')}）`);
      process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`[server-cli] 失败: ${e.message}`); process.exit(1); });
}

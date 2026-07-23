// fx-data-server 的 dockerstart.sh 是 Docker 启动规则单源。本模块不复制 Compose/Harbor/
// IMAGE_PREFIX 业务知识，只在每次调用时生成临时派生脚本，强制拉最新镜像并排除
// Docker 版 fx-data-agents，避免与本地 agents-cli :8070 冲突。
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ACTIVE_UP = /^(?!\s*#)\s*(?:IMAGE_PREFIX=(?:"?\$IMAGE_PREFIX"?|\$\{IMAGE_PREFIX\})\s+)?docker compose up -d\s*$/;
const ACTIVE_PULL = /^(?!\s*#)\s*(?:IMAGE_PREFIX=(?:"?\$IMAGE_PREFIX"?|\$\{IMAGE_PREFIX\})\s+)?docker compose pull\s*$/;
const ANY_ACTIVE_UP = /^(?!\s*#).*docker compose up -d(?:\s|$)/;
const ANY_ACTIVE_PULL = /^(?!\s*#).*docker compose pull(?:\s|$)/;

const DERIVED_COMPOSE_BLOCK = `# --- agents-launcher derived compose block (begin) ---
NOCODE_COMPOSE_SERVICES=$(IMAGE_PREFIX="$IMAGE_PREFIX" docker compose config --services)
NOCODE_SERVICES=()
while IFS= read -r NOCODE_SERVICE; do
  if [ -n "$NOCODE_SERVICE" ] && [ "$NOCODE_SERVICE" != "fx-data-agents" ]; then
    NOCODE_SERVICES+=("$NOCODE_SERVICE")
  fi
done <<< "$NOCODE_COMPOSE_SERVICES"
if [ "\${#NOCODE_SERVICES[@]}" -eq 0 ]; then
  echo "[agents-launcher] docker compose 没有可启动的非 fx-data-agents 服务" >&2
  exit 1
fi
echo "[agents-launcher] 拉取最新镜像（排除 fx-data-agents）..."
IMAGE_PREFIX="$IMAGE_PREFIX" docker compose pull "\${NOCODE_SERVICES[@]}"
echo "[agents-launcher] 启动 Docker Compose 服务（排除 fx-data-agents）..."
IMAGE_PREFIX="$IMAGE_PREFIX" docker compose up -d "\${NOCODE_SERVICES[@]}"
# --- agents-launcher derived compose block (end) ---`;

export function generateDockerStartScript(source) {
  const lines = source.split('\n');
  if (!lines[0]?.startsWith('#!')) {
    throw new Error('dockerstart.sh 缺少 shebang，拒绝生成派生脚本');
  }

  const unsupportedUp = lines.find((line) => ANY_ACTIVE_UP.test(line) && !ACTIVE_UP.test(line));
  if (unsupportedUp) {
    throw new Error(`不支持带额外参数或服务名的 compose up 语句，拒绝丢失上游语义: ${unsupportedUp.trim()}`);
  }
  const unsupportedPull = lines.find((line) => ANY_ACTIVE_PULL.test(line) && !ACTIVE_PULL.test(line));
  if (unsupportedPull) {
    throw new Error(`不支持带额外参数或服务名的 compose pull 语句，拒绝丢失上游语义: ${unsupportedPull.trim()}`);
  }

  const upIndexes = lines
    .map((line, index) => (ACTIVE_UP.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (upIndexes.length !== 1) {
    throw new Error(
      `必须找到唯一活动的 "docker compose up -d" 启动语句，实际找到 ${upIndexes.length} 个；`
      + '上游 dockerstart.sh 结构已变化，拒绝猜测转换',
    );
  }

  const activePullCount = lines.filter((line) => ACTIVE_PULL.test(line)).length;
  if (activePullCount > 1) {
    throw new Error(
      `活动的 "docker compose pull" 超过一个（${activePullCount} 个），拒绝猜测转换`,
    );
  }

  const transformed = lines
    .filter((line) => !ACTIVE_PULL.test(line))
    .map((line) => {
      // 前面会删除 pull，因此按内容替换而不是依赖原始行号。
      if (ACTIVE_UP.test(line)) return DERIVED_COMPOSE_BLOCK;
      return line;
    });

  // 保证任何登录、pull、compose 失败都会终止，不允许继续拿旧环境伪成功。
  if (!transformed.slice(1, 5).some((line) => line.trim() === 'set -euo pipefail')) {
    transformed.splice(1, 0, 'set -euo pipefail');
  }

  const generated = transformed.join('\n');
  if (generated.split('# --- agents-launcher derived compose block (begin) ---').length !== 2) {
    throw new Error('dockerstart.sh 派生脚本生成后校验失败');
  }
  return generated;
}

export function runGeneratedDockerStart({
  serverDir,
  exec = execFileSync,
  env = process.env,
  log = console.log,
} = {}) {
  const sourcePath = join(serverDir, 'dockerstart.sh');
  if (!existsSync(sourcePath)) {
    throw new Error(`server Docker 启动脚本 dockerstart.sh 不存在: ${sourcePath}`);
  }

  const source = readFileSync(sourcePath, 'utf8');
  const generated = generateDockerStartScript(source);
  const tempDir = mkdtempSync(join(tmpdir(), 'agents-launcher-docker-'));
  const generatedPath = join(tempDir, 'dockerstart.generated.sh');

  try {
    writeFileSync(generatedPath, generated, { mode: 0o700 });
    log(`[infra] 基于 ${sourcePath} 生成临时启动脚本`);
    exec('bash', [generatedPath], {
      cwd: serverDir,
      env,
      stdio: 'inherit',
    });
    return { sourcePath };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

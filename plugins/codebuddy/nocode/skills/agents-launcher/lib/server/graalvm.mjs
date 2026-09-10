// GraalVM JDK 发现。对应 dev-start.sh detect_graalvm()（111-170 行）+ _cache_java_home（172-175 行）。
// bootRun 需要 GraalVM（EnableJVMCI），本地没有则可选容器方案（server-cli start 时机再决定是否真的走容器）。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

export const GRAALVM_IMAGE = 'eclipse-temurin:21-jdk';
const JAVA_HOME_CACHE_FILE = '.java-home';

// 候选路径表，纯函数，还原 dev-start.sh 129-141 行。
export function graalvmCandidates({ home = homedir(), userprofile = process.env.USERPROFILE || '' } = {}) {
  return [
    join(home, '.jdks/graalvm-21/Contents/Home'),
    join(home, '.jdks/graalvm-21'),
    join(home, '.jdks/graalvm-ce-21'),
    '/usr/lib/jvm/graalvm-21',
    join(home, '.sdkman/candidates/java/current'),
    // mise (https://mise.jdx.dev) 安装路径
    join(home, '.local/share/mise/installs/java/oracle-graalvm-21/Contents/Home'),
    join(home, '.local/share/mise/installs/java/oracle-graalvm-21'),
    join(home, '.local/share/mise/installs/java/graalvm-community-21/Contents/Home'),
    join(home, '.local/share/mise/installs/java/graalvm-community-21'),
    '/c/Program Files/Java/graalvm-21',
    '/c/Program Files/Java/graalvm-ce-21',
    '/c/Java/graalvm-21',
    ...(userprofile ? [join(userprofile, '.jdks/graalvm-21'), join(userprofile, '.jdks/graalvm-ce-21')] : []),
  ];
}

// 某 JAVA_HOME 下的 java 是否是 GraalVM（对应 -version 输出里 grep graalvm）。
export function isGraalvm(javaHome, { exec } = {}) {
  const javaBin = join(javaHome, 'bin/java');
  if (!existsSync(javaBin)) return false;
  try {
    // java -version 输出在 stderr；spawnSync 能同时捕获 stdout + stderr
    const r = (exec || spawnSync)(javaBin, ['-version'], { encoding: 'utf8' });
    // spawnSync 返回 { stdout, stderr }，execFileSync 返回 string
    const out = (typeof r === 'string' ? r : `${r.stdout || ''}${r.stderr || ''}`).toLowerCase();
    return out.includes('graalvm');
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`.toLowerCase();
    return out.includes('graalvm');
  }
}

// 综合检测：已设置 JAVA_HOME → 缓存文件 → 候选路径表 → 容器降级。
// 返回 { mode: 'local', javaHome } | { mode: 'container', image } | { mode: 'missing' }
export function detectGraalvm({ serverDir, env = process.env, exec, hasDocker = true } = {}) {
  if (env.JAVA_HOME && isGraalvm(env.JAVA_HOME, { exec })) {
    writeJavaHomeCache(serverDir, env.JAVA_HOME);
    return { mode: 'local', javaHome: env.JAVA_HOME };
  }

  const cached = readJavaHomeCache(serverDir);
  if (cached && isGraalvm(cached, { exec })) {
    return { mode: 'local', javaHome: cached };
  }

  for (const candidate of graalvmCandidates()) {
    if (isGraalvm(candidate, { exec })) {
      writeJavaHomeCache(serverDir, candidate);
      return { mode: 'local', javaHome: candidate };
    }
  }

  if (hasDocker) {
    return { mode: 'container', image: GRAALVM_IMAGE };
  }
  return { mode: 'missing' };
}

// ANTLR 生成等纯构建动作不需要 GraalVM，但 gradle 8.5 跑不动过新的默认 JDK（本机实测 JDK 26 直接 build 失败）。
// 解析顺序：GraalVM local → macOS /usr/libexec/java_home -v 21 → ''（沿用环境，寄望 toolchain）。
// 对应 dev-start.sh start_sync 的 JAVA_HOME 兜底（782-792 行）。
export function resolveJdk21ForBuild({ graalvm, exec = execFileSync } = {}) {
  if (graalvm?.mode === 'local') return graalvm.javaHome;
  try {
    const out = exec('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' }).trim();
    if (out) return out;
  } catch { /* 非 macOS 或无 JDK 21 */ }
  return '';
}

export function readJavaHomeCache(serverDir) {
  const f = join(serverDir, JAVA_HOME_CACHE_FILE);
  if (!existsSync(f)) return '';
  return readFileSync(f, 'utf8').trim();
}

export function writeJavaHomeCache(serverDir, javaHome) {
  writeFileSync(join(serverDir, JAVA_HOME_CACHE_FILE), javaHome);
}

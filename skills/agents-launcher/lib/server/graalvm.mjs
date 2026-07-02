// GraalVM JDK 发现。对应 dev-start.sh detect_graalvm()（111-170 行）+ _cache_java_home（172-175 行）。
// bootRun 需要 GraalVM（EnableJVMCI），本地没有则可选容器方案（server-cli start 时机再决定是否真的走容器）。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
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
    '/c/Program Files/Java/graalvm-21',
    '/c/Program Files/Java/graalvm-ce-21',
    '/c/Java/graalvm-21',
    ...(userprofile ? [join(userprofile, '.jdks/graalvm-21'), join(userprofile, '.jdks/graalvm-ce-21')] : []),
  ];
}

// 某 JAVA_HOME 下的 java 是否是 GraalVM（对应 -version 输出里 grep graalvm）。
export function isGraalvm(javaHome, { exec = execFileSync } = {}) {
  const javaBin = join(javaHome, 'bin/java');
  if (!existsSync(javaBin)) return false;
  try {
    const out = exec(javaBin, ['-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).toLowerCase();
    return out.includes('graalvm') || out.includes('oracle graalvm');
  } catch (e) {
    // java -version 把版本信息打到 stderr，execFileSync 在非零退出码时把 stdout/stderr 一起挂在 e.stdout/e.stderr
    const out = `${e.stdout || ''}${e.stderr || ''}`.toLowerCase();
    return out.includes('graalvm') || out.includes('oracle graalvm');
  }
}

// 综合检测：已设置 JAVA_HOME → 缓存文件 → 候选路径表 → 容器降级。
// 返回 { mode: 'local', javaHome } | { mode: 'container', image } | { mode: 'missing' }
export function detectGraalvm({ serverDir, env = process.env, exec = execFileSync, hasDocker = true } = {}) {
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

export function readJavaHomeCache(serverDir) {
  const f = join(serverDir, JAVA_HOME_CACHE_FILE);
  if (!existsSync(f)) return '';
  return readFileSync(f, 'utf8').trim();
}

export function writeJavaHomeCache(serverDir, javaHome) {
  writeFileSync(join(serverDir, JAVA_HOME_CACHE_FILE), javaHome);
}

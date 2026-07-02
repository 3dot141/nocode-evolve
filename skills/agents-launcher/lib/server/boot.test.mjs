import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { patchGcForGraaljs, buildBootRunEnv, buildContainerRunArgs, startApp } from './boot.mjs';

function fakeRepo(gradleContent) {
  const dir = mkdtempSync(join(tmpdir(), 'srv-'));
  writeFileSync(join(dir, 'build.gradle.kts'), gradleContent);
  return dir;
}

test('patchGcForGraaljs: 含 +UseZGC 时替换为 G1GC + JVMCI 参数', () => {
  // 真实 build.gradle.kts 里 UseZGC 与 ZGenerational 分行（bash sed 语义：替换 UseZGC 行 + 删 ZGenerational 整行）
  const dir = fakeRepo('tasks.withType<JavaExec> {\n  jvmArgs = listOf(\n    "-XX:+UseZGC",\n    "-XX:+ZGenerational",\n  )\n}');
  const result = patchGcForGraaljs({ serverDir: dir });
  assert.equal(result.patched, true);
  const content = readFileSync(join(dir, 'build.gradle.kts'), 'utf8');
  assert.ok(content.includes('-XX:+UseG1GC'));
  assert.ok(content.includes('-XX:+EnableJVMCI'));
  assert.ok(!content.includes('ZGenerational'));
});

test('patchGcForGraaljs: 不含 +UseZGC 时跳过，返回未 patch', () => {
  const dir = fakeRepo('tasks.withType<JavaExec> {\n  jvmArgs = listOf("-XX:+UseG1GC")\n}');
  const result = patchGcForGraaljs({ serverDir: dir });
  assert.equal(result.patched, false);
});

test('patchGcForGraaljs: 幂等——跑两次结果一致', () => {
  const dir = fakeRepo('jvmArgs = listOf("-XX:+UseZGC")');
  patchGcForGraaljs({ serverDir: dir });
  const once = readFileSync(join(dir, 'build.gradle.kts'), 'utf8');
  const second = patchGcForGraaljs({ serverDir: dir });
  assert.equal(second.patched, false);   // 第二次已无 +UseZGC 可 patch
  assert.equal(readFileSync(join(dir, 'build.gradle.kts'), 'utf8'), once);
});

test('buildBootRunEnv: 拼出 S3/CDN endpoint + JAVA_TOOL_OPTIONS 含 rpc.host', () => {
  const env = buildBootRunEnv({ hostIp: '192.168.1.5', rpcHost: '10.0.0.1' });
  assert.equal(env.S3_ENDPOINT, 'http://192.168.1.5:9000');
  assert.ok(env.JAVA_TOOL_OPTIONS.includes('-Drpc.host=10.0.0.1'));
  assert.ok(env.JAVA_TOOL_OPTIONS.includes('useSystemProxies=false'));
});

test('buildBootRunEnv: baseEnv 已有 S3_ENDPOINT 时不覆盖', () => {
  const env = buildBootRunEnv({ hostIp: '1.2.3.4', rpcHost: 'x', baseEnv: { S3_ENDPOINT: 'http://custom:9000' } });
  assert.equal(env.S3_ENDPOINT, 'http://custom:9000');
});

test('buildContainerRunArgs: 含 --privileged --network=host 与 env 参数', () => {
  const args = buildContainerRunArgs({ serverDir: '/repo', image: 'eclipse-temurin:21-jdk', envArgs: [['APP_PORT', '8081']] });
  assert.ok(args.includes('--privileged'));
  assert.ok(args.includes('--network=host'));
  assert.ok(args.includes('-e') && args.includes('APP_PORT=8081'));
});

test('startApp: 端口空闲时直接走本地分支 spawn bootRun', async () => {
  let spawned = null;
  const mockExec = () => '';   // pidOnPort 查不到 → 端口空闲；grant 权限调用也走这条不抛错
  const mockSpawn = (cmd, args, opts) => { spawned = { cmd, args, opts }; return { pid: 12345 }; };
  const dir = fakeRepo('no zgc here');
  const result = await startApp({ serverDir: dir, graalvm: { mode: 'local', javaHome: '/opt/graal' }, exec: mockExec, spawn: mockSpawn, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), waitFn: async () => true, log: () => {} });
  assert.equal(result.mode, 'local');
  assert.equal(result.pid, 12345);
  assert.equal(spawned.cmd, './gradlew');
  assert.deepEqual(spawned.args, ['bootRun', '--no-build-cache']);
  // C1 回归锚：stdout/stderr 必须接文件 fd（pipe 无人消费会 64KB 背压挂死 gradle），日志落 dev-start.log
  assert.equal(spawned.opts.stdio[0], 'ignore');
  assert.equal(typeof spawned.opts.stdio[1], 'number');
  assert.equal(typeof spawned.opts.stdio[2], 'number');
  assert.ok(existsSync(join(dir, 'dev-start.log')));
});

test('startApp: 端口被占用且 killOld=false 时 fail loud，不静默等待', async () => {
  const mockExec = (cmd, args) => {
    if (args?.[1]?.includes('lsof')) return '99999\n';
    return '';
  };
  const dir = fakeRepo('no zgc');
  await assert.rejects(
    startApp({ serverDir: dir, graalvm: { mode: 'local', javaHome: '/opt/graal' }, exec: mockExec, killOld: false }),
    /端口 8081 已被占用.*--kill-old/,
  );
});

test('startApp: 端口被占用且 killOld=true 时先杀旧进程再继续', async () => {
  const killed = [];
  const mockExec = (cmd, args) => {
    if (cmd === 'kill') { killed.push(args[0]); return ''; }
    if (args?.[1]?.includes('lsof')) return '99999\n';
    return '';
  };
  const mockSpawn = () => ({ pid: 1 });
  const dir = fakeRepo('no zgc');
  await startApp({ serverDir: dir, graalvm: { mode: 'local', javaHome: '/opt/graal' }, exec: mockExec, spawn: mockSpawn, fetchFn: async () => ({ json: async () => ({ status: 'green' }) }), waitFn: async () => true, killOld: true, log: () => {} });
  assert.deepEqual(killed, ['99999']);
});

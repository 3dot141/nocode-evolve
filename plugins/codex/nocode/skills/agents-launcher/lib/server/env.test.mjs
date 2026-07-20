import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localInfraEnv, proxyJvmFlags, purgeProxyEnv, hostIp, resolvePolarsRpcHost } from './env.mjs';

test('localInfraEnv: 默认值与 dev-start.sh force_local_infra 一致（抽样关键字段）', () => {
  const env = localInfraEnv();
  assert.equal(env.DB_URL, 'jdbc:postgresql://127.0.0.1:5432/jiushuyun?reWriteBatchedInserts=true');
  assert.equal(env.REDIS_HOST, '127.0.0.1');
  assert.equal(env.POLARS_MASTER_CONFIG_STR, '127.0.0.1:8000');
});

test('localInfraEnv: overrides 覆盖默认值', () => {
  const env = localInfraEnv({ overrides: { S3_ENDPOINT: 'http://10.0.0.1:9000' } });
  assert.equal(env.S3_ENDPOINT, 'http://10.0.0.1:9000');
  assert.equal(env.CDN_ENDPOINT, 'http://127.0.0.1:9000');   // 未覆盖的保持默认
});

test('proxyJvmFlags: 含三个禁代理 JVM 参数', () => {
  const flags = proxyJvmFlags();
  assert.ok(flags.includes('-Djava.net.useSystemProxies=false'));
  assert.ok(flags.includes("-Dhttp.nonProxyHosts='*'"));
});

test('purgeProxyEnv: 删除全部代理 key，不 mutate 原对象', () => {
  const original = { http_proxy: 'x', PATH: '/bin' };
  const cleaned = purgeProxyEnv(original);
  assert.equal(cleaned.http_proxy, undefined);
  assert.equal(cleaned.PATH, '/bin');
  assert.equal(original.http_proxy, 'x');   // 原对象未被改
});

test('hostIp: 解析成功返回非回环 IP（注入 mock exec，模拟管道最终输出）', () => {
  // hostIp 的 exec 跑完整 shell 管道（ifconfig|grep|awk），mock 应返回管道产物而非原始 ifconfig 输出
  const mockExec = () => '192.168.1.5\n';
  assert.equal(hostIp({ exec: mockExec }), '192.168.1.5');
});

test('resolvePolarsRpcHost: 容器不存在、宿主解析失败 → 回退常量', () => {
  const mockExec = () => { throw new Error('not found'); };
  assert.equal(resolvePolarsRpcHost({ exec: mockExec }), '192.168.65.254');
});

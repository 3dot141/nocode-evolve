import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DomainRegistryError, loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';
import { validateSchemaValue } from '../scripts/lib/schema-validator.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function json(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function addDomain(root, id, options = {}) {
  const dir = path.join(root, 'core/domains', id);
  const capabilityId = options.capabilityId || `${id}.run`;
  const providerId = options.providerId || `${id}-native`;
  const input = options.inputSchema || 'contracts/input.schema.json';
  const output = options.outputSchema || 'contracts/output.schema.json';
  json(path.join(dir, 'contracts/input.schema.json'), { $id: `${id}.input`, type: 'object' });
  json(path.join(dir, 'contracts/output.schema.json'), { $id: `${id}.output`, type: 'object' });
  json(path.join(dir, 'capabilities/run.json'), {
    id: capabilityId,
    domain: id,
    inputSchema: input,
    outputSchema: output,
    fallbackOn: 'never',
    platforms: options.platforms || {
      claude: { primary: providerId },
      codex: { primary: providerId },
    },
  });
  json(path.join(dir, 'providers/native/provider.json'), {
    id: providerId,
    pluginData: false,
    domain: id,
    platforms: options.providerPlatforms || ['claude', 'codex'],
    capabilities: options.providerCapabilities || {
      [capabilityId]: { inputSchema: input, outputSchema: output },
    },
    dependencies: options.dependencies || [],
  });
  json(path.join(dir, 'domain.json'), {
    id,
    capabilities: ['capabilities/run.json'],
    contracts: ['contracts/input.schema.json', 'contracts/output.schema.json'],
    providers: ['providers/native/provider.json'],
  });
  return dir;
}

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'nocode-domain-registry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'core/contracts'), { recursive: true });
  json(path.join(root, 'core/contracts/provider-attempt.schema.json'), {
    $id: 'nocode.provider-attempt', type: 'object', additionalProperties: true,
  });
  return root;
}

function throwsCode(fn, code, message) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof DomainRegistryError);
    assert.equal(error.code, code);
    assert.match(error.message, new RegExp(`^${code}:`));
    if (message) assert.match(error.message, message);
    return true;
  });
}

test('loads sorted immutable registry and resolves platform routes', (t) => {
  const root = fixture(t);
  addDomain(root, 'zeta');
  addDomain(root, 'alpha');
  const registry = loadDomainRegistry(root);
  assert.deepEqual([...registry.domains.keys()], ['alpha', 'zeta']);
  assert.equal(typeof registry.domains.set, 'undefined');
  assert.ok(Object.isFrozen(registry));
  assert.deepEqual(registry.resolvePlatform('codex').platform, 'codex');
  assert.equal(registry.resolvePlatform('codex').domains.alpha['alpha.run'].primary, 'alpha-native');
  assert.equal(registry.contracts.get('alpha.input').file, 'core/domains/alpha/contracts/input.schema.json');
  assert.equal(registry.capabilities.get('alpha.run').file, 'core/domains/alpha/capabilities/run.json');
  throwsCode(() => registry.resolvePlatform('other'), 'REGISTRY_PLATFORM_UNKNOWN');
});

test('rejects duplicate capability and provider ownership', (t) => {
  const root = fixture(t);
  addDomain(root, 'alpha', { capabilityId: 'shared.run', providerId: 'shared-native' });
  addDomain(root, 'beta', { capabilityId: 'shared.run', providerId: 'beta-native' });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_DUPLICATE_CAPABILITY');

  rmSync(root, { recursive: true, force: true });
  mkdirSync(path.join(root, 'core/contracts'), { recursive: true });
  json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', { providerId: 'shared-native' });
  addDomain(root, 'beta', { providerId: 'shared-native' });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_DUPLICATE_PROVIDER');
});

test('rejects unresolved platform, invalid provider and platform disagreement', (t) => {
  const root = fixture(t);
  addDomain(root, 'alpha', { platforms: { claude: { primary: 'alpha-native' }, codex: {} } });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PLATFORM_UNRESOLVED');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', { platforms: { claude: { primary: 'missing' }, codex: { excluded: 'not available' } } });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PROVIDER_MISSING');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', { providerPlatforms: ['claude'] });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PLATFORM_MISMATCH');
});

test('rejects ambiguous platform targets with a stable registry error', (t) => {
  const root = fixture(t);
  addDomain(root, 'alpha', {
    platforms: { claude: { fallback: 'alpha-native' }, codex: { primary: 'alpha-native' } },
  });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PLATFORM_TARGET_INVALID');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', {
    platforms: { claude: { primary: 'alpha-native', excluded: 'disabled' }, codex: { primary: 'alpha-native' } },
  });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PLATFORM_TARGET_INVALID');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', {
    platforms: {
      claude: { primary: 'alpha-native', primaryFromInput: 'receipt.provider', allowedProviders: ['alpha-native'] },
      codex: { primary: 'alpha-native' },
    },
  });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PLATFORM_TARGET_INVALID');
});

test('rejects dangling dependency, missing schema and incompatible provider schema', (t) => {
  const root = fixture(t);
  addDomain(root, 'alpha', { dependencies: ['missing.run'] });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_DANGLING_DEPENDENCY');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', { inputSchema: 'contracts/missing.schema.json' });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_SCHEMA_MISSING');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', {
    providerCapabilities: { 'alpha.run': { inputSchema: 'contracts/output.schema.json', outputSchema: 'contracts/output.schema.json' } },
  });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_SCHEMA_INCOMPATIBLE');
});

test('rejects malformed provider dependencies without leaking TypeError', (t) => {
  const root = fixture(t);
  const domain = addDomain(root, 'alpha');
  const providerFile = path.join(domain, 'providers/native/provider.json');
  const provider = JSON.parse(readFileSync(providerFile, 'utf8'));
  json(providerFile, { ...provider, dependencies: { capability: 'alpha.run' } });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_DEPENDENCIES_INVALID');
});

test('rejects path escape, provider fallback cycle and domain dependency cycle', (t) => {
  const root = fixture(t);
  const dir = addDomain(root, 'alpha');
  const domain = {
    id: 'alpha', capabilities: ['../outside.json'], contracts: [], providers: [],
  };
  json(path.join(dir, 'domain.json'), domain);
  json(path.join(root, 'core/domains/outside.json'), {});
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PATH_ESCAPE');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  addDomain(root, 'alpha', { dependencies: ['beta.run'] });
  addDomain(root, 'beta', { dependencies: ['alpha.run'] });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_DOMAIN_CYCLE');

  rmSync(root, { recursive: true, force: true }); mkdirSync(path.join(root, 'core/contracts'), { recursive: true }); json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  const domainRoot = addDomain(root, 'alpha');
  json(path.join(domainRoot, 'providers/fallback/provider.json'), {
    id: 'alpha-fallback', domain: 'alpha', pluginData: false, platforms: ['claude', 'codex'],
    capabilities: { 'alpha.run': { inputSchema: 'contracts/input.schema.json', outputSchema: 'contracts/output.schema.json' } }, dependencies: [],
  });
  json(path.join(domainRoot, 'domain.json'), {
    id: 'alpha', capabilities: ['capabilities/run.json'],
    contracts: ['contracts/input.schema.json', 'contracts/output.schema.json'],
    providers: ['providers/native/provider.json', 'providers/fallback/provider.json'],
  });
  const capFile = path.join(domainRoot, 'capabilities/run.json');
  json(capFile, {
    id: 'alpha.run', domain: 'alpha', inputSchema: 'contracts/input.schema.json', outputSchema: 'contracts/output.schema.json', fallbackOn: 'never',
    platforms: { claude: { primary: 'alpha-native', fallback: 'alpha-fallback' }, codex: { primary: 'alpha-fallback', fallback: 'alpha-native' } },
  });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PROVIDER_CYCLE');
});

test('rejects empty registry and invalid capability metadata', (t) => {
  const root = fixture(t);
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_EMPTY', /no domains discovered/);

  addDomain(root, 'alpha');
  const capability = path.join(root, 'core/domains/alpha/capabilities/run.json');
  const value = JSON.parse(readFileSync(capability, 'utf8'));
  json(capability, { ...value, fallbackOn: 'sometimes' });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_FALLBACK_POLICY_INVALID');

  json(capability, { ...value, internal: 'yes' });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_INTERNAL_INVALID');

  json(capability, { ...value, contextBindings: { sessionId: '../session' } });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_CONTEXT_BINDINGS_INVALID');

});

test('rejects duplicate contract IDs', (t) => {
  const root = fixture(t);
  addDomain(root, 'alpha');
  addDomain(root, 'beta');
  json(path.join(root, 'core/domains/beta/contracts/input.schema.json'), { $id: 'alpha.input', type: 'object' });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_DUPLICATE_CONTRACT', /duplicate contract owner: alpha\.input/);
});

test('rejects provider dependency recursion and unowned or symlink-escaped schemas', (t) => {
  const root = fixture(t);
  addDomain(root, 'alpha', { dependencies: ['alpha.run'] });
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PROVIDER_CYCLE', /depends on capability it implements/);

  rmSync(root, { recursive: true, force: true });
  mkdirSync(path.join(root, 'core/contracts'), { recursive: true });
  json(path.join(root, 'core/contracts/provider-attempt.schema.json'), { $id: 'nocode.provider-attempt', type: 'object' });
  const domain = addDomain(root, 'alpha');
  json(path.join(domain, 'contracts/unowned.schema.json'), { $id: 'alpha.unowned', type: 'object' });
  const capability = path.join(domain, 'capabilities/run.json');
  json(capability, { ...JSON.parse(readFileSync(capability)), inputSchema: 'contracts/unowned.schema.json' });
  const provider = path.join(domain, 'providers/native/provider.json');
  const providerValue = JSON.parse(readFileSync(provider));
  providerValue.capabilities['alpha.run'].inputSchema = 'contracts/unowned.schema.json';
  json(provider, providerValue);
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_SCHEMA_UNOWNED', /is not owned by its registry/);

  rmSync(path.join(domain, 'contracts/unowned.schema.json'));
  const outside = path.join(root, 'outside.schema.json');
  json(outside, { $id: 'outside', type: 'object' });
  symlinkSync(outside, path.join(domain, 'contracts/unowned.schema.json'));
  throwsCode(() => loadDomainRegistry(root), 'REGISTRY_PATH_ESCAPE', /resolves outside allowed contract roots/);
});

test('workspace and runtime-state real definitions resolve on both platforms', () => {
  const registry = loadDomainRegistry(REPO_ROOT);
  for (const platform of ['claude', 'codex']) {
    const resolution = registry.resolvePlatform(platform);
    assert.ok(resolution.domains.workspace['workspace.worktree.create']);
    assert.equal(resolution.domains['runtime-state']['state.handoff.status'].primary, `${platform}-plugin-data`);
  }
});

test('real capability contracts enforce domain-specific inputs and receipts', () => {
  const registry = loadDomainRegistry(REPO_ROOT);
  const schema = (id) => {
    const { id: _id, file: _file, ...value } = registry.contracts.get(id);
    return value;
  };
  const resolveRef = (id) => schema(id);

  assert.ok(validateSchemaValue(registry.capabilities.get('workspace.write').inputSchema, {}).length > 0);
  assert.deepEqual(validateSchemaValue(registry.capabilities.get('workspace.write').inputSchema, { path: 'a', content: 'b' }), []);
  assert.equal(registry.capabilities.get('state.handoff.open').internal, true);
  assert.ok(validateSchemaValue(registry.capabilities.get('workflow.decision.request').outputSchema, {}).length > 0);
  assert.deepEqual(validateSchemaValue(registry.capabilities.get('design.workspace.create').inputSchema, {
    projectRoot: '/tmp/project', kind: 'prototype', name: 'checkout',
  }, { resolveRef }), []);
  assert.ok(validateSchemaValue(registry.capabilities.get('design.workspace.create').inputSchema, {}, { resolveRef }).length > 0);
  assert.deepEqual(validateSchemaValue(registry.capabilities.get('workflow.wait').inputSchema, {
    executionId: 'execution-1', timeoutMs: 1000,
  }, { resolveRef }), []);
  assert.ok(validateSchemaValue(registry.capabilities.get('workflow.wait').inputSchema, {
    executionIds: ['execution-1'],
  }, { resolveRef }).length > 0);
  assert.ok(validateSchemaValue(registry.capabilities.get('state.execution.create').inputSchema, {
    sessionId: 'session-1', execution: {},
  }, { resolveRef }).length > 0);
  const workspaceOnly = {
    provider: 'open-design', workspace: { type: 'project', ref: 'workspace-1' },
    artifact: null, degraded: false, degradedFrom: null, warnings: [],
  };
  for (const capabilityId of ['design.artifact.read', 'design.artifact.write', 'design.preview.open']) {
    const input = capabilityId === 'design.artifact.write'
      ? { artifactRef: workspaceOnly, content: '<main />' }
      : { artifactRef: workspaceOnly };
    assert.ok(validateSchemaValue(registry.capabilities.get(capabilityId).inputSchema, input, { resolveRef }).length > 0);
  }
  assert.ok(validateSchemaValue(schema('design.design-input'), { operation: 'workspace.create' }, { resolveRef }).length > 0);
  assert.deepEqual(validateSchemaValue(schema('design.design-result'), {
    provider: 'local-html', workspace: { type: 'directory', ref: 'out' },
    artifact: null, degraded: true, degradedFrom: 'open-design', reason: 'not installed', warnings: [],
  }, { resolveRef }), []);

  const write = registry.resolvePlatform('codex').domains.design['design.artifact.write'];
  assert.equal(write.primary, undefined);
  assert.equal(write.primaryFromInput, 'artifactRef.provider');
  assert.deepEqual(write.allowedProviders, ['open-design', 'local-html']);

  const execute = registry.resolvePlatform('codex').domains.workflow['workflow.execute'];
  assert.equal(execute.fallbackCondition, 'fallbackPolicy=inline');
});

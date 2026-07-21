import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { validateSchemaDefinition } from './schema-validator.mjs';

const PLATFORMS = ['claude', 'codex'];
const FALLBACK_POLICIES = new Set(['manual', 'never']);

export class DomainRegistryError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'DomainRegistryError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

class ReadonlyMapView {
  #map;
  constructor(entries) {
    this.#map = new Map(entries);
    Object.freeze(this);
  }
  get size() { return this.#map.size; }
  get(key) { return this.#map.get(key); }
  has(key) { return this.#map.has(key); }
  entries() { return this.#map.entries(); }
  keys() { return this.#map.keys(); }
  values() { return this.#map.values(); }
  forEach(callback, thisArg) { return this.#map.forEach((value, key) => callback.call(thisArg, value, key, this)); }
  [Symbol.iterator]() { return this.#map[Symbol.iterator](); }
}

function fail(code, message, details) {
  throw new DomainRegistryError(code, message, details);
}

function readJson(file, code = 'REGISTRY_INVALID_JSON') {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(code, `cannot read ${file}: ${error.message}`, { file });
  }
}

function readProviderGuidance(providerFile) {
  const file = path.join(path.dirname(providerFile), 'SKILL.md');
  if (!existsSync(file)) return '';
  return readFileSync(file, 'utf8')
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .trimStart()
    .replace(/^# .+\n+/, '')
    .trim();
}

function containedFile(domainRoot, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) {
    fail('REGISTRY_PATH_ESCAPE', `${label} must be a non-empty domain-relative path`, { relative });
  }
  const resolved = path.resolve(domainRoot, relative);
  const boundary = `${path.resolve(domainRoot)}${path.sep}`;
  if (!resolved.startsWith(boundary) || !existsSync(resolved)) {
    fail('REGISTRY_PATH_ESCAPE', `${label} escapes its domain or does not exist: ${relative}`, { relative });
  }
  const real = realpathSync(resolved);
  const realBoundary = `${realpathSync(domainRoot)}${path.sep}`;
  if (!real.startsWith(realBoundary)) {
    fail('REGISTRY_PATH_ESCAPE', `${label} resolves outside its domain: ${relative}`, { relative });
  }
  return real;
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function normalizedPaths(value, label) {
  if (!Array.isArray(value)) fail('REGISTRY_INVALID_DOMAIN', `${label} must be an array`);
  return [...value].sort((a, b) => String(a).localeCompare(String(b)));
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(value)) {
    fail('REGISTRY_INVALID_ID', `${label} has invalid id: ${value ?? '<missing>'}`);
  }
}

function schemaRef(root, domainRoot, relative, label) {
  if (relative && typeof relative === 'object' && !Array.isArray(relative)) {
    return deepFreeze(structuredClone(relative));
  }
  if (typeof relative !== 'string' || !relative) {
    fail('REGISTRY_SCHEMA_MISSING', `${label} is missing a schema reference`);
  }
  const resolved = path.resolve(domainRoot, relative);
  const domainBoundary = `${path.resolve(domainRoot)}${path.sep}`;
  const sharedBoundary = `${path.resolve(root, 'core', 'contracts')}${path.sep}`;
  if (!resolved.startsWith(domainBoundary) && !resolved.startsWith(sharedBoundary)) {
    fail('REGISTRY_PATH_ESCAPE', `${label} schema escapes allowed contract roots: ${relative}`);
  }
  if (!existsSync(resolved)) fail('REGISTRY_SCHEMA_MISSING', `${label} schema not found: ${relative}`);
  const real = realpathSync(resolved);
  const realDomain = `${realpathSync(domainRoot)}${path.sep}`;
  const sharedRoot = path.resolve(root, 'core', 'contracts');
  const realShared = existsSync(sharedRoot) ? `${realpathSync(sharedRoot)}${path.sep}` : '';
  if (!real.startsWith(realDomain) && (!realShared || !real.startsWith(realShared))) {
    fail('REGISTRY_PATH_ESCAPE', `${label} schema resolves outside allowed contract roots: ${relative}`);
  }
  return path.relative(root, real).replaceAll('\\', '/');
}

function findCycle(edges) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(node) {
    if (visiting.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const next of [...(edges.get(node) || [])].sort()) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }
  for (const node of [...edges.keys()].sort()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

function assertProviderContract(provider, capability, implementation) {
  if (JSON.stringify(implementation.inputSchema) !== JSON.stringify(capability.inputSchema) || JSON.stringify(implementation.outputSchema) !== JSON.stringify(capability.outputSchema)) {
    fail(
      'REGISTRY_SCHEMA_INCOMPATIBLE',
      `${provider.id} schemas are incompatible with ${capability.id}`,
      { provider: provider.id, capability: capability.id },
    );
  }
}

export function loadDomainRegistry(root) {
  root = realpathSync(root);
  const domainsRoot = path.join(root, 'core', 'domains');
  if (!existsSync(domainsRoot)) fail('REGISTRY_EMPTY', `no domains discovered in ${domainsRoot}`);
  const domainFiles = readdirSync(domainsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(domainsRoot, entry.name, 'domain.json')))
    .map((entry) => path.join(domainsRoot, entry.name, 'domain.json'))
    .sort();
  if (domainFiles.length === 0) fail('REGISTRY_EMPTY', `no domains discovered in ${domainsRoot}`);

  const domains = new Map();
  const capabilities = new Map();
  const providers = new Map();
  const contracts = new Map();

  for (const domainFile of domainFiles) {
    const domainRoot = path.dirname(domainFile);
    const definition = readJson(domainFile);
    assertIdentifier(definition.id, 'domain');
    if (domains.has(definition.id)) fail('REGISTRY_DUPLICATE_DOMAIN', `duplicate domain owner: ${definition.id}`);
    const domain = { ...definition, root: path.relative(root, domainRoot).replaceAll('\\', '/') };

    for (const relative of normalizedPaths(definition.contracts, `${definition.id}.contracts`)) {
      const file = containedFile(domainRoot, relative, 'contract');
      const contract = readJson(file);
      const id = contract.$id || `${definition.id}:${relative}`;
      if (contracts.has(id)) fail('REGISTRY_DUPLICATE_CONTRACT', `duplicate contract owner: ${id}`);
      contracts.set(id, deepFreeze({ ...contract, id, file: path.relative(root, file).replaceAll('\\', '/') }));
    }

    for (const relative of normalizedPaths(definition.capabilities, `${definition.id}.capabilities`)) {
      const file = containedFile(domainRoot, relative, 'capability');
      const capability = readJson(file);
      assertIdentifier(capability.id, 'capability');
      if (capability.domain !== definition.id) {
        fail('REGISTRY_OWNER_MISMATCH', `${capability.id} declares domain ${capability.domain}, expected ${definition.id}`);
      }
      if (capabilities.has(capability.id)) fail('REGISTRY_DUPLICATE_CAPABILITY', `duplicate capability owner: ${capability.id}`);
      if (capability.internal !== undefined && typeof capability.internal !== 'boolean') {
        fail('REGISTRY_INTERNAL_INVALID', `${capability.id}.internal must be boolean`);
      }
      if (capability.contextBindings !== undefined) {
        const bindings = capability.contextBindings;
        const valid = capability.internal === true && bindings && typeof bindings === 'object'
          && !Array.isArray(bindings) && Object.keys(bindings).length > 0
          && Object.entries(bindings).every(([contextKey, inputPath]) => (
            /^[a-zA-Z][a-zA-Z0-9]*$/.test(contextKey)
            && typeof inputPath === 'string'
            && /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(inputPath)
          ));
        if (!valid) {
          fail('REGISTRY_CONTEXT_BINDINGS_INVALID', `${capability.id}.contextBindings is invalid`);
        }
        if (capability.inputSchema && typeof capability.inputSchema === 'object') {
          for (const inputPath of Object.values(bindings)) {
            let schema = capability.inputSchema;
            for (const segment of inputPath.split('.')) schema = schema?.properties?.[segment];
            if (!schema) {
              fail('REGISTRY_CONTEXT_BINDINGS_INVALID', `${capability.id} binding path is not in its input schema`);
            }
          }
        }
      }
      capability.inputSchema = schemaRef(root, domainRoot, capability.inputSchema, `${capability.id}.inputSchema`);
      capability.outputSchema = schemaRef(root, domainRoot, capability.outputSchema, `${capability.id}.outputSchema`);
      if (!FALLBACK_POLICIES.has(capability.fallbackOn)) {
        fail('REGISTRY_FALLBACK_POLICY_INVALID', `${capability.id} has invalid fallbackOn ${capability.fallbackOn}`);
      }
      capabilities.set(capability.id, deepFreeze({
        ...capability,
        file: path.relative(root, file).replaceAll('\\', '/'),
      }));
    }

    for (const relative of normalizedPaths(definition.providers, `${definition.id}.providers`)) {
      const file = containedFile(domainRoot, relative, 'provider');
      const provider = readJson(file);
      assertIdentifier(provider.id, 'provider');
      if (provider.domain !== definition.id) {
        fail('REGISTRY_OWNER_MISMATCH', `${provider.id} declares domain ${provider.domain}, expected ${definition.id}`);
      }
      if (providers.has(provider.id)) fail('REGISTRY_DUPLICATE_PROVIDER', `duplicate provider owner: ${provider.id}`);
      if (!Array.isArray(provider.platforms) || provider.platforms.some((item) => !PLATFORMS.includes(item))) {
        fail('REGISTRY_PLATFORM_MISMATCH', `${provider.id} has invalid platform support`);
      }
      if (provider.dependencies !== undefined && (!Array.isArray(provider.dependencies)
        || provider.dependencies.some((dependency) => typeof dependency !== 'string'))) {
        fail('REGISTRY_DEPENDENCIES_INVALID', `${provider.id}.dependencies must be a string array`);
      }
      if (typeof provider.pluginData !== 'boolean') {
        fail('REGISTRY_PLUGIN_DATA_INVALID', `${provider.id}.pluginData must be boolean`);
      }
      if (provider.pluginData && definition.id !== 'runtime-state') {
        fail('REGISTRY_PLUGIN_DATA_INVALID', `${provider.id} cannot access plugin data outside runtime-state`);
      }
      provider.capabilities = Object.fromEntries(
        Object.entries(provider.capabilities || {}).map(([capabilityId, implementation]) => [
          capabilityId,
          {
            ...implementation,
            inputSchema: schemaRef(root, domainRoot, implementation.inputSchema, `${provider.id}.${capabilityId}.inputSchema`),
            outputSchema: schemaRef(root, domainRoot, implementation.outputSchema, `${provider.id}.${capabilityId}.outputSchema`),
          },
        ]),
      );
      providers.set(provider.id, deepFreeze({
        ...provider,
        guidance: readProviderGuidance(file),
        file: path.relative(root, file).replaceAll('\\', '/'),
      }));
    }
    domains.set(definition.id, deepFreeze(domain));
  }

  for (const provider of providers.values()) {
    for (const [capabilityId, implementation] of Object.entries(provider.capabilities || {})) {
      const capability = capabilities.get(capabilityId);
      if (!capability) fail('REGISTRY_DANGLING_CAPABILITY', `${provider.id} implements unknown capability ${capabilityId}`);
      if (capability.domain !== provider.domain) {
        fail('REGISTRY_OWNER_MISMATCH', `${provider.id} cannot implement capability owned by ${capability.domain}`);
      }
      assertProviderContract(provider, capability, implementation);
    }
    for (const dependency of provider.dependencies || []) {
      if (!capabilities.has(dependency)) {
        fail('REGISTRY_DANGLING_DEPENDENCY', `${provider.id} depends on unknown capability ${dependency}`);
      }
      if (provider.capabilities?.[dependency]) {
        fail('REGISTRY_PROVIDER_CYCLE', `${provider.id} depends on capability it implements: ${dependency}`);
      }
    }
  }

  const contractsByFile = new Map([...contracts.values()].map((contract) => [contract.file, contract]));
  const resolveRef = (reference) => contracts.get(reference) || contractsByFile.get(reference);
  for (const capability of capabilities.values()) {
    for (const [kind, reference] of [['input', capability.inputSchema], ['output', capability.outputSchema]]) {
      if (typeof reference === 'string' && !contractsByFile.has(reference)) {
        fail('REGISTRY_SCHEMA_UNOWNED', `${capability.id} ${kind} schema is not owned by its registry: ${reference}`);
      }
      if (reference && typeof reference === 'object') {
        try {
          validateSchemaDefinition(reference, { resolveRef: (ref) => {
            const resolved = resolveRef(ref);
            if (!resolved) return undefined;
            const { id: _id, file: _file, ...schema } = resolved;
            return schema;
          } });
        } catch (error) {
          fail(error.code || 'REGISTRY_SCHEMA_INVALID', `${capability.id} ${kind}: ${error.message}`);
        }
      }
    }
  }
  for (const contract of contracts.values()) {
    try {
      const { id: _id, file: _file, ...schema } = contract;
      validateSchemaDefinition(schema, { resolveRef: (reference) => {
        const resolved = resolveRef(reference);
        if (!resolved) return undefined;
        const { id: _resolvedId, file: _resolvedFile, ...resolvedSchema } = resolved;
        return resolvedSchema;
      } });
    } catch (error) {
      fail(error.code || 'REGISTRY_SCHEMA_INVALID', `${contract.id}: ${error.message}`, { contract: contract.id });
    }
  }

  const domainEdges = new Map([...domains.keys()].map((id) => [id, new Set()]));
  for (const provider of providers.values()) {
    for (const dependency of provider.dependencies || []) {
      const owner = capabilities.get(dependency).domain;
      if (owner !== provider.domain) domainEdges.get(provider.domain).add(owner);
    }
  }
  const domainCycle = findCycle(domainEdges);
  if (domainCycle) fail('REGISTRY_DOMAIN_CYCLE', `domain dependency cycle: ${domainCycle.join(' -> ')}`);

  const providerEdges = new Map([...providers.keys()].map((id) => [id, new Set()]));
  for (const provider of providers.values()) {
    for (const dependency of provider.dependencies || []) {
      for (const candidate of providers.values()) {
        if (candidate.capabilities?.[dependency]) providerEdges.get(provider.id).add(candidate.id);
      }
    }
  }
  for (const capability of capabilities.values()) {
    for (const platform of PLATFORMS) {
      const target = capability.platforms?.[platform];
      if (!target || (!target.primary && !target.primaryFromInput && !target.fallback && !target.excluded)) {
        fail('REGISTRY_PLATFORM_UNRESOLVED', `${capability.id} has no provider, fallback or exclusion for ${platform}`);
      }
      if (typeof target !== 'object' || Array.isArray(target)) {
        fail('REGISTRY_PLATFORM_TARGET_INVALID', `${capability.id}.${platform} target must be an object`);
      }
      const supportedTargetKeys = new Set([
        'primary', 'primaryFromInput', 'allowedProviders', 'fallback', 'fallbackCondition', 'excluded',
      ]);
      const unknownTargetKey = Object.keys(target).find((key) => !supportedTargetKeys.has(key));
      const routeCount = Number(Boolean(target.primary)) + Number(Boolean(target.primaryFromInput));
      const excluded = typeof target.excluded === 'string' && Boolean(target.excluded.trim());
      const excludedHasRouting = excluded && Object.keys(target).some((key) => key !== 'excluded');
      const selectorOptionsWithoutSelector = !target.primaryFromInput && target.allowedProviders !== undefined;
      if (unknownTargetKey || (target.excluded !== undefined && !excluded) || excludedHasRouting
        || (!excluded && routeCount !== 1) || selectorOptionsWithoutSelector
        || (target.fallbackCondition !== undefined && !target.fallback)) {
        fail('REGISTRY_PLATFORM_TARGET_INVALID', `${capability.id}.${platform} has an ambiguous or invalid target shape`);
      }
      if (target.primaryFromInput) {
        if (typeof target.primaryFromInput !== 'string' || !Array.isArray(target.allowedProviders) || target.allowedProviders.length === 0) {
          fail('REGISTRY_PROVIDER_MISSING', `${capability.id}.${platform} has an invalid input-selected provider`);
        }
        for (const providerId of target.allowedProviders) {
          const provider = providers.get(providerId);
          if (!provider?.capabilities?.[capability.id] || !provider.platforms.includes(platform)) {
            fail('REGISTRY_PROVIDER_MISSING', `${capability.id}.${platform} selector references invalid provider ${providerId}`);
          }
        }
      }
      for (const role of ['primary', 'fallback']) {
        const providerId = target?.[role];
        if (!providerId) continue;
        const provider = providers.get(providerId);
        if (!provider || !provider.capabilities?.[capability.id]) {
          fail('REGISTRY_PROVIDER_MISSING', `${capability.id}.${platform}.${role} references invalid provider ${providerId}`);
        }
        if (!provider.platforms.includes(platform)) {
          fail('REGISTRY_PLATFORM_MISMATCH', `${providerId} does not support ${platform}`);
        }
      }
      if (target?.primary && target?.fallback) providerEdges.get(target.primary).add(target.fallback);
    }
  }
  const providerCycle = findCycle(providerEdges);
  if (providerCycle) fail('REGISTRY_PROVIDER_CYCLE', `provider fallback cycle: ${providerCycle.join(' -> ')}`);

  const readonly = {
    domains: new ReadonlyMapView([...domains.entries()].map(([key, value]) => [key, deepFreeze(value)])),
    capabilities: new ReadonlyMapView([...capabilities.entries()].sort(([a], [b]) => a.localeCompare(b))),
    providers: new ReadonlyMapView([...providers.entries()].sort(([a], [b]) => a.localeCompare(b))),
    contracts: new ReadonlyMapView([...contracts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    resolvePlatform(platform) {
      if (!PLATFORMS.includes(platform)) fail('REGISTRY_PLATFORM_UNKNOWN', `unknown platform: ${platform}`);
      const resolvedDomains = {};
      const excluded = {};
      for (const capability of capabilities.values()) {
        const target = capability.platforms[platform];
        if (target.excluded) {
          excluded[capability.id] = { reason: target.excluded };
          continue;
        }
        resolvedDomains[capability.domain] ||= {};
        resolvedDomains[capability.domain][capability.id] = {
          ...(target.primary ? { primary: target.primary } : {}),
          ...(target.primaryFromInput ? { primaryFromInput: target.primaryFromInput, allowedProviders: [...target.allowedProviders] } : {}),
          ...(target.fallback ? { fallback: target.fallback } : {}),
          ...(target.fallbackCondition ? { fallbackCondition: target.fallbackCondition } : {}),
          fallbackOn: capability.fallbackOn,
          inputSchema: capability.inputSchema,
          outputSchema: capability.outputSchema,
        };
      }
      return deepFreeze({ platform, domains: resolvedDomains, excluded });
    },
  };
  return Object.freeze(readonly);
}

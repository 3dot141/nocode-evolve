import { readFileSync } from 'node:fs';
import {
  isAlias,
  parseAllDocuments,
  visit,
} from '../vendor/yaml/browser/index.js';
import { validateTopology } from './topology.mjs';

const ID = /^[a-z][a-z0-9-]*$/;
const CORE_TAGS = new Set([
  'tag:yaml.org,2002:map',
  'tag:yaml.org,2002:seq',
  'tag:yaml.org,2002:str',
  'tag:yaml.org,2002:null',
  'tag:yaml.org,2002:bool',
  'tag:yaml.org,2002:int',
  'tag:yaml.org,2002:float',
]);

function topologyError(sourcePath, message) {
  return new Error(`[topology] ${sourcePath}: ${message}`);
}

function conciseError(message) {
  return String(message).split('\n', 1)[0];
}

function assertObject(value, at, sourcePath) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw topologyError(sourcePath, `${at} 必须是 object`);
  }
}

function assertExactKeys(value, { at, allowed, required = [] }, sourcePath) {
  assertObject(value, at, sourcePath);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw topologyError(sourcePath, `未知字段 ${at}.${key}`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw topologyError(sourcePath, `缺少字段 ${at}.${key}`);
    }
  }
}

function assertId(value, at, sourcePath) {
  if (typeof value !== 'string' || !ID.test(value)) {
    throw topologyError(sourcePath, `${at} 必须匹配 ${ID}`);
  }
}

function assertInteger(value, at, minimum, sourcePath) {
  if (!Number.isInteger(value) || value < minimum) {
    throw topologyError(sourcePath, `${at} 必须是 >= ${minimum} 的 integer`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeConfig(raw, { sourcePath, adapterNames }) {
  assertExactKeys(raw, {
    at: 'root',
    allowed: ['schema_version', 'supervision', 'workspaces', 'services'],
    required: ['schema_version', 'supervision', 'workspaces', 'services'],
  }, sourcePath);
  if (raw.schema_version !== 1) {
    throw topologyError(sourcePath, 'schema_version 必须精确为 1');
  }

  assertExactKeys(raw.supervision, {
    at: 'supervision',
    allowed: ['interval_ms', 'stable_successes', 'failure_threshold'],
    required: ['interval_ms', 'stable_successes', 'failure_threshold'],
  }, sourcePath);
  assertInteger(raw.supervision.interval_ms, 'supervision.interval_ms', 100, sourcePath);
  assertInteger(raw.supervision.stable_successes, 'supervision.stable_successes', 1, sourcePath);
  assertInteger(raw.supervision.failure_threshold, 'supervision.failure_threshold', 1, sourcePath);

  assertObject(raw.workspaces, 'workspaces', sourcePath);
  if (Object.keys(raw.workspaces).length === 0) {
    throw topologyError(sourcePath, 'workspaces 至少需要一个 workspace');
  }
  const workspaces = {};
  for (const [workspaceId, serviceIds] of Object.entries(raw.workspaces)) {
    assertId(workspaceId, `workspaces key "${workspaceId}"`, sourcePath);
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      throw topologyError(sourcePath, `workspaces.${workspaceId} 必须是非空 array`);
    }
    for (const serviceId of serviceIds) {
      assertId(serviceId, `workspaces.${workspaceId}[]`, sourcePath);
    }
    if (new Set(serviceIds).size !== serviceIds.length) {
      throw topologyError(sourcePath, `workspaces.${workspaceId} 不允许重复 service`);
    }
    workspaces[workspaceId] = [...serviceIds];
  }

  assertObject(raw.services, 'services', sourcePath);
  if (Object.keys(raw.services).length === 0) {
    throw topologyError(sourcePath, 'services 至少需要一个 service');
  }
  const services = {};
  const allowedAdapters = new Set(adapterNames);
  for (const [serviceId, service] of Object.entries(raw.services)) {
    assertId(serviceId, `services key "${serviceId}"`, sourcePath);
    assertExactKeys(service, {
      at: `services.${serviceId}`,
      allowed: ['adapter', 'lifecycle', 'depends_on'],
      required: ['adapter', 'lifecycle'],
    }, sourcePath);
    if (!allowedAdapters.has(service.adapter)) {
      throw topologyError(sourcePath, `services.${serviceId} 使用未知 adapter "${service.adapter}"`);
    }
    if (!['service', 'oneshot'].includes(service.lifecycle)) {
      throw topologyError(sourcePath, `services.${serviceId}.lifecycle 必须是 service 或 oneshot`);
    }
    const dependsOn = {};
    const rawDependsOn = service.depends_on ?? {};
    assertObject(rawDependsOn, `services.${serviceId}.depends_on`, sourcePath);
    for (const [dependencyId, dependency] of Object.entries(rawDependsOn)) {
      assertId(dependencyId, `services.${serviceId}.depends_on key`, sourcePath);
      assertExactKeys(dependency, {
        at: `services.${serviceId}.depends_on.${dependencyId}`,
        allowed: ['condition', 'required', 'propagate_restart'],
        required: ['condition', 'required'],
      }, sourcePath);
      if (!['service_healthy', 'service_completed_successfully'].includes(dependency.condition)) {
        throw topologyError(sourcePath, `services.${serviceId}.depends_on.${dependencyId}.condition 非法`);
      }
      if (typeof dependency.required !== 'boolean') {
        throw topologyError(sourcePath, `services.${serviceId}.depends_on.${dependencyId}.required 必须是 boolean`);
      }
      if (dependency.propagate_restart !== undefined
          && typeof dependency.propagate_restart !== 'boolean') {
        throw topologyError(sourcePath, `services.${serviceId}.depends_on.${dependencyId}.propagate_restart 必须是 boolean`);
      }
      dependsOn[dependencyId] = {
        condition: dependency.condition,
        required: dependency.required,
        propagate_restart: dependency.propagate_restart ?? false,
      };
    }
    services[serviceId] = {
      adapter: service.adapter,
      lifecycle: service.lifecycle,
      depends_on: dependsOn,
    };
  }

  return {
    schema_version: 1,
    supervision: { ...raw.supervision },
    workspaces,
    services,
  };
}

export function loadLauncherConfig({
  path,
  readFile = readFileSync,
  parseAll = parseAllDocuments,
  adapterNames = [],
  identityAdapterNames = [],
} = {}) {
  if (!path) throw topologyError('<unknown>', '配置 path 必填');
  let source;
  try {
    source = readFile(path, 'utf8');
  } catch (error) {
    throw topologyError(path, `读取失败：${conciseError(error.message)}`);
  }

  let documents;
  try {
    documents = parseAll(source, {
      version: '1.2',
      schema: 'core',
      strict: true,
      uniqueKeys: true,
      prettyErrors: true,
    });
  } catch (error) {
    throw topologyError(path, conciseError(error.message));
  }
  if (documents.length !== 1) {
    throw topologyError(path, '必须恰好包含一个 YAML document');
  }
  const [document] = documents;
  if (document.errors.length > 0) {
    throw topologyError(path, conciseError(document.errors[0].message));
  }

  let unsafe = null;
  visit(document, (_key, node) => {
    if (isAlias(node)) {
      unsafe = '不允许 YAML alias';
      return visit.BREAK;
    }
    if (node?.tag && !CORE_TAGS.has(node.tag)) {
      unsafe = '不允许自定义 YAML tag';
      return visit.BREAK;
    }
    return undefined;
  });
  if (unsafe) throw topologyError(path, unsafe);

  let raw;
  try {
    raw = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw topologyError(path, conciseError(error.message));
  }
  const config = normalizeConfig(raw, { sourcePath: path, adapterNames });
  try {
    validateTopology(config, { identityAdapterNames });
  } catch (error) {
    throw topologyError(
      path,
      conciseError(error.message).replace(/^\[topology\]\s*/, ''),
    );
  }
  return deepFreeze({ config, sourcePath: path });
}

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { renderDomainReferences } from './domain-renderer.mjs';
import { loadContextBudget, splitStaticContext } from './context-budget.mjs';

const PLATFORMS = new Set(['claude', 'codex']);
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadPluginExclusions(root) {
  const file = path.join(root, 'plugin', 'exclusions.json');
  if (!existsSync(file)) return { schemaVersion: 1, sources: [], hookCommands: [] };
  const parsed = loadJson(file);
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.sources) || !Array.isArray(parsed.hookCommands)) {
    throw new Error('plugin/exclusions.json must contain schemaVersion=1, sources and hookCommands');
  }
  const sources = parsed.sources.map((entry) => {
    const relative = safeRelative(entry?.path, 'exclusions.sources.path');
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      throw new Error(`exclusion reason is required for ${relative}`);
    }
    return { path: relative, reason: entry.reason.trim() };
  });
  const hookCommands = parsed.hookCommands.map((entry) => {
    if (typeof entry?.contains !== 'string' || !entry.contains.trim()
      || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      throw new Error('hook command exclusions require contains and reason');
    }
    return { contains: entry.contains.trim(), reason: entry.reason.trim() };
  });
  return { schemaVersion: 1, sources, hookCommands };
}

function sourceIsExcluded(relative, exclusions) {
  return exclusions.sources.some((entry) => relative === entry.path || relative.startsWith(`${entry.path}/`));
}

const DEVELOPMENT_ONLY_FILES = new Set([
  'scripts/check-skills.mjs',
  'scripts/compile.platform.mjs',
  'scripts/vendor-sync.mjs',
  'scripts/lib/domain-registry.mjs',
  'scripts/lib/domain-renderer.mjs',
  'scripts/lib/platform-compiler.mjs',
  'scripts/lib/schema-validator.mjs',
  'scripts/lib/workflow-control.mjs',
]);

function isPublishable(relative) {
  const name = path.posix.basename(relative);
  return !DEVELOPMENT_ONLY_FILES.has(relative)
    && name !== 'AGENTS.md'
    && name !== 'README.md'
    && name !== '.DS_Store'
    && !relative.includes('/fixtures/')
    && !/\.(?:test|spec)\.[^.]+$/.test(name)
    && !relative.includes('/__pycache__/')
    && !name.endsWith('.pyc');
}

function filterExcludedHooks(content, exclusions) {
  const config = JSON.parse(content.toString('utf8'));
  for (const [event, groups] of Object.entries(config.hooks || {})) {
    config.hooks[event] = (groups || []).map((group) => ({
      ...group,
      hooks: (group.hooks || []).filter((hook) => !exclusions.hookCommands.some(
        (entry) => String(hook.command || '').includes(entry.contains),
      )),
    })).filter((group) => group.hooks.length > 0);
  }
  return Buffer.from(`${JSON.stringify(config, null, 2)}\n`);
}

export function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') throw new Error('metadata must be an object');
  for (const field of ['name', 'version', 'description', 'license']) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) {
      throw new Error(`metadata.${field} must be a non-empty string`);
    }
  }
  if (!SEMVER.test(metadata.version)) throw new Error('metadata.version must be strict SemVer');
  if (typeof metadata.author?.name !== 'string' || !metadata.author.name.trim()) {
    throw new Error('metadata.author.name must be a non-empty string');
  }
  return metadata;
}

export function validateAdapterResolution(adapter, resolution) {
  if (!resolution || resolution.platform !== adapter?.platform) {
    throw new Error('adapter resolution platform mismatch');
  }
  const capabilityCount = Object.values(resolution.domains || {})
    .reduce((count, capabilities) => count + Object.keys(capabilities || {}).length, 0);
  if (capabilityCount === 0) throw new Error('adapter resolution must contain at least one capability');
  const declared = new Set(adapter.providerSupport || []);
  for (const capabilities of Object.values(resolution.domains || {})) {
    for (const mapping of Object.values(capabilities)) {
      for (const provider of [mapping.primary, mapping.fallback, ...(mapping.allowedProviders || [])].filter(Boolean)) {
        if (!declared.has(provider)) {
          throw new Error(`${adapter.platform} adapter missing provider support: ${provider}`);
        }
      }
    }
  }
  return resolution;
}

function safeRelative(value, label) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`${label} escapes the repository root`);
  }
  return normalized;
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const output = [];
  function visit(current, prefix = '') {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) output.push(relative);
      // Runtime references use their canonical vendored path. Compatibility
      // symlinks in the source tree are intentionally not duplicated.
      else if (!entry.isSymbolicLink()) throw new Error(`unsupported source entry: ${absolute}`);
    }
  }
  visit(root);
  return output;
}

function sortedMap(entries) {
  return new Map([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

const STATIC_CONTEXT_SEGMENTS = {
  'model-nocode': 'model/agent-nocode.md',
  'model-about': 'model/agent-about.md',
  'model-personal': 'model/agent-personal.md',
  'model-karpathy': 'model/agent-karpathy.md',
  'model-rule-catalog-1': 'model/agent-rule-catalog-1.md',
  'model-rule-catalog-2': 'model/agent-rule-catalog-2.md',
  'model-rule-catalog-3': 'model/agent-rule-catalog-3.md',
  'model-rule-catalog-4': 'model/agent-rule-catalog-4.md',
  'model-rule-catalog-5': 'model/agent-rule-catalog-5.md',
};

export function contextSegmentPlan(root, platform) {
  const budgetFile = path.join(root, 'core/domains/lifecycle/providers', `${platform}-hooks`, 'context-budget.json');
  if (!existsSync(budgetFile)) return new Map();
  const budget = loadContextBudget(budgetFile);
  const reserve = platform === 'codex' ? 256 : 128;
  const contentBudget = { ...budget, safeBytes: Math.max(1, budget.safeBytes - reserve) };
  const plan = new Map();
  for (const [segment, relative] of Object.entries(STATIC_CONTEXT_SEGMENTS)) {
    const file = path.join(root, relative);
    if (!existsSync(file)) continue;
    plan.set(segment, {
      source: relative,
      chunks: splitStaticContext(
        readFileSync(file, 'utf8'), contentBudget, `${segment} (${relative})`,
      ).length,
    });
  }
  return plan;
}

export function buildExpectedTree({ root, metadata, adapter, resolution, registry }) {
  validateMetadata(metadata);
  if (!adapter || !PLATFORMS.has(adapter.platform)) throw new Error('adapter.platform is invalid');
  if (typeof adapter.renderManifest !== 'function') throw new Error('adapter.renderManifest is required');
  if (typeof adapter.transformFile !== 'function') throw new Error('adapter.transformFile is required');
  const exclusions = loadPluginExclusions(root);
  const exclusionReceipt = Object.fromEntries(exclusions.sources.map(
    (entry) => [`source:${entry.path}`, { reason: entry.reason }],
  ));
  const effectiveResolution = {
    ...resolution,
    excluded: { ...(resolution.excluded || {}), ...exclusionReceipt },
  };
  validateAdapterResolution(adapter, effectiveResolution);
  const contextPlan = contextSegmentPlan(root, adapter.platform);

  const entries = [];
  const manifestPath = safeRelative(adapter.manifestPath, 'adapter.manifestPath');
  const manifest = `${JSON.stringify(adapter.renderManifest(metadata), null, 2)}\n`;
  entries.push([manifestPath, Buffer.from(manifest)]);

  for (const mapping of adapter.sourceRoots || []) {
    const source = safeRelative(mapping.source, 'sourceRoots.source');
    const target = safeRelative(mapping.target, 'sourceRoots.target');
    const sourceRoot = path.join(root, source);
    for (const relative of listFiles(sourceRoot)) {
      const sourcePath = `${source}/${relative}`;
      const targetPath = `${target}/${relative}`;
      if (sourceIsExcluded(sourcePath, exclusions) || !isPublishable(sourcePath)) continue;
      let content = readFileSync(path.join(root, sourcePath));
      if (sourcePath === 'hooks/hooks.json' && exclusions.hookCommands.length) {
        content = filterExcludedHooks(content, exclusions);
      }
      const transformed = adapter.transformFile({
        sourcePath,
        targetPath,
        content,
        metadata,
        resolution: effectiveResolution,
        contextPlan,
      });
      if (transformed == null) continue;
      const output = Buffer.isBuffer(transformed) ? transformed : Buffer.from(transformed);
      entries.push([targetPath, output]);
    }
  }
  if (typeof adapter.generateFiles === 'function') {
    const generated = adapter.generateFiles({
      root, metadata, resolution: effectiveResolution,
      isExcluded: (relative) => sourceIsExcluded(relative, exclusions),
    });
    for (const [relative, content] of generated) {
      const targetPath = safeRelative(relative, 'generated file path');
      if (entries.some(([existing]) => existing === targetPath)) {
        throw new Error(`generated file collides with copied source: ${targetPath}`);
      }
      entries.push([targetPath, Buffer.isBuffer(content) ? content : Buffer.from(content)]);
    }
  }
  if (registry) {
    const providerIds = new Set();
    for (const capabilities of Object.values(effectiveResolution.domains || {})) {
      for (const route of Object.values(capabilities || {})) {
        for (const provider of [route.primary, route.fallback, ...(route.allowedProviders || [])].filter(Boolean)) {
          providerIds.add(provider);
        }
      }
    }
    for (const providerId of [...providerIds].sort()) {
      const provider = registry.providers.get(providerId);
      if (!provider) throw new Error(`resolved provider is missing from registry: ${providerId}`);
      const sourceRoot = path.dirname(path.join(root, provider.file));
      for (const relative of listFiles(sourceRoot)) {
        if (relative === 'provider.json' || relative === 'SKILL.md' || !isPublishable(relative)) continue;
        const targetPath = `skills/using-nocode/scripts/providers/${provider.id}/${relative}`;
        entries.push([targetPath, readFileSync(path.join(sourceRoot, relative))]);
      }
    }
    if (providerIds.has('open-design')) {
      const rootVariable = adapter.platform === 'claude' ? '${CLAUDE_PLUGIN_ROOT}' : '${PLUGIN_ROOT}';
      const args = [
        `${rootVariable}/skills/using-nocode/scripts/providers/open-design/scripts/launch.mjs`,
      ];
      entries.push(['.mcp.json', Buffer.from(`${JSON.stringify({
        mcpServers: { 'open-design': { command: 'node', args } },
      }, null, 2)}\n`)]);
    }
    for (const [relative, content] of renderDomainReferences({
      registry, resolution: effectiveResolution, platform: adapter.platform,
    })) {
      const targetPath = safeRelative(relative, 'domain entry path');
      if (entries.some(([existing]) => existing === targetPath)) {
        throw new Error(`domain entry collides with generated file: ${targetPath}`);
      }
      entries.push([targetPath, content]);
    }
  }

  return sortedMap(entries);
}

function actualTree(root) {
  const entries = [];
  for (const relative of listFiles(root)) {
    entries.push([relative, readFileSync(path.join(root, relative))]);
  }
  return sortedMap(entries);
}

export function diffTree(expected, outputRoot) {
  const actual = actualTree(outputRoot);
  const changed = [];
  const missing = [];
  const extra = [];
  for (const [relative, content] of expected) {
    if (!actual.has(relative)) missing.push(relative);
    else if (!content.equals(actual.get(relative))) changed.push(relative);
  }
  for (const relative of actual.keys()) {
    if (!expected.has(relative)) extra.push(relative);
  }
  return { changed, missing, extra };
}

function assertSafeOutputRoot(outputRoot, repoRoot) {
  const resolvedRepo = path.resolve(repoRoot);
  const resolvedOutput = path.resolve(outputRoot);
  const relative = path.relative(resolvedRepo, resolvedOutput).replaceAll('\\', '/');
  if (!/^plugins\/(claude|codex)\/nocode$/.test(relative)) {
    throw new Error('refusing to clean outside <repo>/plugins/claude/nocode or <repo>/plugins/codex/nocode');
  }
  return resolvedOutput;
}

export function writeExpectedTree(expected, outputRoot, repoRoot) {
  const safeRoot = assertSafeOutputRoot(outputRoot, repoRoot);
  rmSync(safeRoot, { recursive: true, force: true });
  mkdirSync(safeRoot, { recursive: true });
  for (const [relative, content] of expected) {
    const target = path.join(safeRoot, safeRelative(relative, 'generated path'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    // writeFileSync 生成物默认 644，会丢失 shell 辅助脚本的执行位。
    if (/\.sh$/.test(relative)) chmodSync(target, 0o755);
  }
}

export function formatDiff(platform, diff) {
  const lines = [];
  for (const kind of ['changed', 'missing', 'extra']) {
    for (const file of diff[kind]) lines.push(`${platform}: ${kind}: ${file}`);
  }
  return lines;
}

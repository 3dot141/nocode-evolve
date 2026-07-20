import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const STATUSES = new Set(['supported', 'degraded', 'unsupported']);
const PLATFORMS = new Set(['claude', 'codex']);
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function loadJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
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

export function validateContract(contract, adapters) {
  if (!contract || typeof contract !== 'object') throw new Error('contract must be an object');
  if (!Array.isArray(contract.capabilities)) throw new Error('contract.capabilities must be an array');

  const seen = new Set();
  for (const capability of contract.capabilities) {
    if (!capability?.name || seen.has(capability.name)) {
      throw new Error(`invalid or duplicate capability: ${capability?.name || '<missing>'}`);
    }
    seen.add(capability.name);
    for (const platform of PLATFORMS) {
      const mapping = capability.platforms?.[platform];
      if (!mapping) throw new Error(`${capability.name} missing ${platform} mapping`);
      if (!STATUSES.has(mapping.status)) {
        throw new Error(`${capability.name}.${platform} has invalid status`);
      }
      if (typeof mapping.implementation !== 'string' || !mapping.implementation.trim()) {
        throw new Error(`${capability.name}.${platform} missing implementation`);
      }
      if (mapping.status !== 'supported' &&
          (typeof mapping.fallback !== 'string' || !mapping.fallback.trim())) {
        throw new Error(`${capability.name}.${platform} missing fallback`);
      }
      if (!adapters?.[platform]?.capabilities?.includes(capability.name)) {
        throw new Error(`${capability.name} missing ${platform} adapter capability`);
      }
    }
  }
  return contract;
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

export function buildExpectedTree({ root, metadata, adapter }) {
  validateMetadata(metadata);
  if (!adapter || !PLATFORMS.has(adapter.platform)) throw new Error('adapter.platform is invalid');
  if (typeof adapter.renderManifest !== 'function') throw new Error('adapter.renderManifest is required');
  if (typeof adapter.transformFile !== 'function') throw new Error('adapter.transformFile is required');

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
      const content = readFileSync(path.join(root, sourcePath));
      const transformed = adapter.transformFile({
        sourcePath,
        targetPath,
        content,
        metadata,
      });
      if (transformed == null) continue;
      entries.push([targetPath, Buffer.isBuffer(transformed) ? transformed : Buffer.from(transformed)]);
    }
  }
  if (typeof adapter.generateFiles === 'function') {
    const generated = adapter.generateFiles({ root, metadata });
    for (const [relative, content] of generated) {
      const targetPath = safeRelative(relative, 'generated file path');
      if (entries.some(([existing]) => existing === targetPath)) {
        throw new Error(`generated file collides with copied source: ${targetPath}`);
      }
      entries.push([targetPath, Buffer.isBuffer(content) ? content : Buffer.from(content)]);
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
  }
}

export function formatDiff(platform, diff) {
  const lines = [];
  for (const kind of ['changed', 'missing', 'extra']) {
    for (const file of diff[kind]) lines.push(`${platform}: ${kind}: ${file}`);
  }
  return lines;
}

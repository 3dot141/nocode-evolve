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
import { loadContextBudget, splitStaticContext } from './context-budget.mjs';
import { renderPlatformBlocks } from './platform-blocks.mjs';

const PLATFORMS = new Set(['claude', 'codex', 'qoder']);
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
    let platforms = null;
    if (entry.platforms != null) {
      if (!Array.isArray(entry.platforms) || entry.platforms.length === 0
        || entry.platforms.some((platform) => !PLATFORMS.has(platform))) {
        throw new Error(`exclusion platforms must contain claude, codex and/or qoder for ${relative}`);
      }
      platforms = [...new Set(entry.platforms)];
    }
    return { path: relative, reason: entry.reason.trim(), platforms };
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

export function sourceIsExcluded(relative, exclusions, platform) {
  return exclusions.sources.some((entry) => {
    const appliesToPlatform = entry.platforms == null || entry.platforms.includes(platform);
    return appliesToPlatform
      && (relative === entry.path || relative.startsWith(`${entry.path}/`));
  });
}

const DEVELOPMENT_ONLY_FILES = new Set([
  'scripts/check-skills.mjs',
  'scripts/package.platform.mjs',
  'scripts/vendor-sync.mjs',
  'scripts/lib/platform-blocks.mjs',
  'scripts/lib/platform-packager.mjs',
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

function selectPlatformContent({ sourcePath, content, platform }) {
  const marker = '<!-- nocode:platform ';
  if (!sourcePath.endsWith('.md')) {
    if (content.includes(marker)) {
      throw new Error(`${sourcePath}: platform blocks are Markdown-only`);
    }
    return content;
  }
  return Buffer.from(renderPlatformBlocks(content.toString('utf8'), {
    platform,
    file: sourcePath,
  }));
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

function sortedMap(entries, modes = new Map()) {
  const result = new Map([...entries].sort(([left], [right]) => left.localeCompare(right)));
  Object.defineProperty(result, 'modes', { value: modes });
  return result;
}

const STATIC_CONTEXT_SEGMENTS = {
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
  const budgetFile = path.join(root, 'platform', platform, 'runtime', 'context-budget.json');
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

export function buildExpectedTree({ root, metadata, adapter }) {
  validateMetadata(metadata);
  if (!adapter || !PLATFORMS.has(adapter.platform)) throw new Error('adapter.platform is invalid');
  if (typeof adapter.renderManifest !== 'function') throw new Error('adapter.renderManifest is required');
  if (typeof adapter.transformFile !== 'function') throw new Error('adapter.transformFile is required');
  const exclusions = loadPluginExclusions(root);
  const contextPlan = contextSegmentPlan(root, adapter.platform);

  const entries = [];
  const modes = new Map();
  const manifestPath = safeRelative(adapter.manifestPath, 'adapter.manifestPath');
  const manifest = `${JSON.stringify(adapter.renderManifest(metadata), null, 2)}\n`;
  entries.push([manifestPath, Buffer.from(manifest)]);
  modes.set(manifestPath, false);

  for (const mapping of adapter.sourceRoots || []) {
    const source = safeRelative(mapping.source, 'sourceRoots.source');
    const target = safeRelative(mapping.target, 'sourceRoots.target');
    const sourceRoot = path.join(root, source);
    for (const relative of listFiles(sourceRoot)) {
      const sourcePath = `${source}/${relative}`;
      const targetPath = `${target}/${relative}`;
      if (sourceIsExcluded(sourcePath, exclusions, adapter.platform) || !isPublishable(sourcePath)) continue;
      let content = readFileSync(path.join(root, sourcePath));
      if (sourcePath === 'hooks/hooks.json' && exclusions.hookCommands.length) {
        content = filterExcludedHooks(content, exclusions);
      }
      content = selectPlatformContent({
        sourcePath,
        content,
        platform: adapter.platform,
      });
      const transformed = adapter.transformFile({
        sourcePath,
        targetPath,
        content,
        metadata,
        contextPlan,
      });
      if (transformed == null) continue;
      const output = Buffer.isBuffer(transformed) ? transformed : Buffer.from(transformed);
      entries.push([targetPath, output]);
      modes.set(targetPath, Boolean(statSync(path.join(root, sourcePath)).mode & 0o111));
    }
  }
  if (typeof adapter.generateFiles === 'function') {
    const generated = adapter.generateFiles({
      root, metadata,
      isExcluded: (relative) => sourceIsExcluded(relative, exclusions, adapter.platform),
    });
    for (const [relative, content] of generated) {
      const targetPath = safeRelative(relative, 'generated file path');
      if (entries.some(([existing]) => existing === targetPath)) {
        throw new Error(`generated file collides with copied source: ${targetPath}`);
      }
      const generatedContent = Buffer.isBuffer(content) ? content : Buffer.from(content);
      entries.push([targetPath, selectPlatformContent({
        sourcePath: targetPath,
        content: generatedContent,
        platform: adapter.platform,
      })]);
      modes.set(targetPath, false);
    }
  }
  return sortedMap(entries, modes);
}

function actualTree(root) {
  const entries = [];
  const modes = new Map();
  for (const relative of listFiles(root)) {
    entries.push([relative, readFileSync(path.join(root, relative))]);
    modes.set(relative, Boolean(statSync(path.join(root, relative)).mode & 0o111));
  }
  return sortedMap(entries, modes);
}

export function diffTree(expected, outputRoot) {
  const actual = actualTree(outputRoot);
  const changed = [];
  const missing = [];
  const extra = [];
  for (const [relative, content] of expected) {
    if (!actual.has(relative)) missing.push(relative);
    else if (!content.equals(actual.get(relative))) changed.push(relative);
    else if (expected.modes?.has(relative)
      && expected.modes.get(relative) !== actual.modes.get(relative)) changed.push(relative);
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
  if (!/^plugins\/(claude|codex|qoder)\/nocode$/.test(relative)) {
    throw new Error('refusing to clean outside <repo>/plugins/{claude,codex,qoder}/nocode');
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
    const executable = expected.modes?.get(relative) ?? /\.(sh|py)$/.test(relative);
    chmodSync(target, executable ? 0o755 : 0o600);
  }
}

export function formatDiff(platform, diff) {
  const lines = [];
  for (const kind of ['changed', 'missing', 'extra']) {
    for (const file of diff[kind]) lines.push(`${platform}: ${kind}: ${file}`);
  }
  return lines;
}

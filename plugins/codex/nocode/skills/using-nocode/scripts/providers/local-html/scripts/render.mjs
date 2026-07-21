#!/usr/bin/env node
import {
  accessSync, constants, existsSync, mkdirSync, realpathSync, statSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

export class LocalHtmlError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.code = code; }
}

function result(workspace, artifact, reason = 'Open Design provider unavailable') {
  return {
    provider: 'local-html', workspace, artifact,
    degraded: true, degradedFrom: 'open-design', reason, warnings: [],
  };
}

function safeOutput(outputDir) {
  if (typeof outputDir !== 'string' || !path.isAbsolute(outputDir)) {
    throw new LocalHtmlError('LOCAL_HTML_OUTPUT_INVALID', 'outputDir must be explicit and absolute');
  }
  return path.normalize(outputDir);
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function safeWorkspace(projectRoot, name) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)
    || typeof name !== 'string' || name.length === 0) {
    throw new LocalHtmlError('LOCAL_HTML_OUTPUT_INVALID', 'projectRoot must be absolute and name must be non-empty');
  }
  const root = path.normalize(projectRoot);
  const directory = path.resolve(root, name);
  if (!isContained(root, directory)) {
    throw new LocalHtmlError('LOCAL_HTML_OUTPUT_INVALID', 'workspace must remain inside projectRoot');
  }
  try {
    const realRoot = realpathSync(root);
    if (!statSync(realRoot).isDirectory()) throw new Error('not-directory');
    let nearest = directory;
    while (!existsSync(nearest)) {
      const parent = path.dirname(nearest);
      if (parent === nearest) throw new Error('no-existing-parent');
      nearest = parent;
    }
    const projected = path.resolve(realpathSync(nearest), path.relative(nearest, directory));
    if (!isContained(realRoot, projected)) throw new Error('symlink-escape');
  } catch {
    throw new LocalHtmlError('LOCAL_HTML_OUTPUT_INVALID', 'workspace resolves outside projectRoot');
  }
  return directory;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHtml(kind, brief) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(kind)}</title></head><body><main>${escapeHtml(brief)}</main></body></html>`;
}

function materializedPath(artifactRef) {
  const localPath = artifactRef?.artifact?.localPath;
  if (typeof localPath !== 'string' || !path.isAbsolute(localPath) || !existsSync(localPath)) {
    throw new LocalHtmlError('LOCAL_HTML_ARTIFACT_UNAVAILABLE', 'artifact localPath is not materialized');
  }
  try {
    accessSync(localPath, constants.R_OK);
  } catch {
    throw new LocalHtmlError('LOCAL_HTML_ARTIFACT_UNAVAILABLE', 'artifact localPath is not readable');
  }
  return localPath;
}

function ownedWritePath(artifactRef) {
  if (artifactRef?.provider !== 'local-html' || artifactRef?.workspace?.type !== 'directory') {
    throw new LocalHtmlError('LOCAL_HTML_PROVIDER_MISMATCH', 'write cannot cross providers');
  }
  const workspace = artifactRef.workspace.ref;
  const localPath = artifactRef?.artifact?.localPath;
  if (typeof workspace !== 'string' || !path.isAbsolute(workspace)
    || typeof localPath !== 'string' || !path.isAbsolute(localPath)) {
    throw new LocalHtmlError('LOCAL_HTML_ARTIFACT_OUTSIDE_WORKSPACE', 'write requires absolute provider-owned paths');
  }
  try {
    const realWorkspace = realpathSync(workspace);
    const realArtifact = realpathSync(localPath);
    if (!statSync(realWorkspace).isDirectory() || !isContained(realWorkspace, realArtifact)) throw new Error('outside');
  } catch {
    throw new LocalHtmlError('LOCAL_HTML_ARTIFACT_OUTSIDE_WORKSPACE', 'artifact is outside its provider workspace');
  }
  return localPath;
}

export function localHtmlOperation(capability, input) {
  if (capability === 'design.workspace.create') {
    const directory = safeWorkspace(input.projectRoot, input.name);
    mkdirSync(directory, { recursive: true });
    return result({ type: 'directory', ref: directory }, null);
  }
  if (capability === 'design.artifact.generate') {
    const directory = safeOutput(input.outputDir);
    mkdirSync(directory, { recursive: true });
    const localPath = path.join(directory, `${input.kind}.html`);
    const html = renderHtml(input.kind, input.brief);
    writeFileSync(localPath, html, { flag: 'wx' });
    return result({ type: 'directory', ref: directory }, {
      kind: input.kind, localPath, previewUrl: null,
    });
  }
  if (['design.artifact.read', 'design.preview.open'].includes(capability)) {
    materializedPath(input.artifactRef);
    return input.artifactRef;
  }
  if (capability === 'design.artifact.write') {
    const localPath = ownedWritePath(input.artifactRef);
    if (typeof input.content === 'string') {
      writeFileSync(localPath, input.content);
    } else if (typeof input.patch?.brief === 'string') {
      writeFileSync(localPath, renderHtml(input.artifactRef.artifact.kind, input.patch.brief));
    } else {
      throw new LocalHtmlError('LOCAL_HTML_PATCH_UNSUPPORTED', 'patch.brief must be a string');
    }
    return input.artifactRef;
  }
  throw new LocalHtmlError('LOCAL_HTML_CAPABILITY_UNSUPPORTED', capability);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [capability, raw] = process.argv.slice(2);
    const result = localHtmlOperation(capability, JSON.parse(raw || '{}'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'LOCAL_HTML_ARGUMENT_INVALID' })}\n`);
    process.exitCode = 2;
  }
}

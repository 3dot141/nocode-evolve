import assert from 'node:assert/strict';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { localHtmlOperation } from '../core/domains/design/providers/local-html/scripts/render.mjs';
import { loadDomainRegistry } from '../scripts/lib/domain-registry.mjs';

test('local HTML provider returns normalized degraded workspace and artifact receipts', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'local-html-provider-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const workspace = localHtmlOperation('design.workspace.create', {
    projectRoot: root, name: 'demo', kind: 'prototype',
  });
  assert.equal(workspace.artifact, null);
  assert.equal(workspace.provider, 'local-html');
  const artifact = localHtmlOperation('design.artifact.generate', {
    workspaceRef: workspace.workspace, kind: 'prototype', brief: 'Checkout', outputDir: path.join(root, 'out'),
  });
  assert.equal(artifact.degraded, true);
  assert.equal(artifact.degradedFrom, 'open-design');
  assert.match(readFileSync(artifact.artifact.localPath, 'utf8'), /Checkout/);
  assert.equal(artifact.artifact.previewUrl, null);
  assert.equal(localHtmlOperation('design.artifact.read', { artifactRef: artifact }).provider, 'local-html');
});

test('local HTML workspace and artifact paths cannot escape their declared boundaries', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'local-html-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.throws(() => localHtmlOperation('design.workspace.create', {
    projectRoot: root, name: '../escape', kind: 'prototype',
  }), (error) => error.code === 'LOCAL_HTML_OUTPUT_INVALID');
  assert.throws(() => localHtmlOperation('design.workspace.create', {
    projectRoot: 'relative/root', name: 'demo', kind: 'prototype',
  }), (error) => error.code === 'LOCAL_HTML_OUTPUT_INVALID');
  assert.throws(() => localHtmlOperation('design.artifact.generate', {
    workspaceRef: { type: 'directory', ref: root }, kind: 'prototype', brief: 'x', outputDir: 'relative/out',
  }), (error) => error.code === 'LOCAL_HTML_OUTPUT_INVALID');

  const outside = mkdtempSync(path.join(os.tmpdir(), 'local-html-symlink-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, path.join(root, 'linked'));
  assert.throws(() => localHtmlOperation('design.workspace.create', {
    projectRoot: root, name: 'linked/escape', kind: 'prototype',
  }), (error) => error.code === 'LOCAL_HTML_OUTPUT_INVALID');
});

test('local HTML escapes briefs and supports the patch.brief update used by business skills', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'local-html-patch-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const artifact = localHtmlOperation('design.artifact.generate', {
    workspaceRef: { type: 'directory', ref: root }, kind: 'prototype',
    brief: '<script>bad()</script>', outputDir: root,
  });
  assert.doesNotMatch(readFileSync(artifact.artifact.localPath, 'utf8'), /<script>/);
  localHtmlOperation('design.artifact.write', {
    artifactRef: artifact, patch: { brief: '<b>approved</b>' },
  });
  const updated = readFileSync(artifact.artifact.localPath, 'utf8');
  assert.match(updated, /&lt;b&gt;approved&lt;\/b&gt;/);
  assert.doesNotMatch(updated, /<b>approved<\/b>/);
});

test('local HTML read requires a materialized path and write requires receipt-owned containment', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'local-html-owned-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outside = path.join(path.dirname(root), `${path.basename(root)}-outside.html`);
  t.after(() => rmSync(outside, { force: true }));
  writeFileSync(outside, 'outside');
  const forged = {
    provider: 'local-html', workspace: { type: 'directory', ref: root },
    artifact: { kind: 'prototype', localPath: outside, previewUrl: null },
    degraded: true, degradedFrom: 'open-design', reason: 'test', warnings: [],
  };
  assert.throws(() => localHtmlOperation('design.artifact.write', {
    artifactRef: forged, content: 'overwrite',
  }), (error) => error.code === 'LOCAL_HTML_ARTIFACT_OUTSIDE_WORKSPACE');
  assert.equal(readFileSync(outside, 'utf8'), 'outside');
  const missing = { ...forged, artifact: { ...forged.artifact, localPath: path.join(root, 'missing.html') } };
  assert.equal(existsSync(missing.artifact.localPath), false);
  assert.throws(() => localHtmlOperation('design.artifact.read', { artifactRef: missing }),
    (error) => error.code === 'LOCAL_HTML_ARTIFACT_UNAVAILABLE');
});

test('artifact write never crosses receipt providers', () => {
  assert.throws(() => localHtmlOperation('design.artifact.write', {
    artifactRef: { provider: 'open-design', artifact: { localPath: '/tmp/x' } }, content: 'x',
  }), (error) => error.code === 'LOCAL_HTML_PROVIDER_MISMATCH');
});

test('real Design routes preserve fallback and receipt ownership semantics on both platforms', () => {
  const registry = loadDomainRegistry(new URL('..', import.meta.url));
  for (const platform of ['claude', 'codex']) {
    const routes = registry.resolvePlatform(platform).domains.design;
    assert.equal(routes['design.workspace.create'].primary, 'open-design');
    assert.equal(routes['design.workspace.create'].fallback, 'local-html');
    assert.equal(routes['design.workspace.create'].fallbackOn, 'manual');
    assert.equal(routes['design.artifact.generate'].primary, 'open-design');
    assert.equal(routes['design.artifact.generate'].fallback, 'local-html');
    assert.equal(routes['design.artifact.generate'].fallbackOn, 'manual');
    assert.equal(routes['design.artifact.read'].primaryFromInput, 'artifactRef.provider');
    assert.equal(routes['design.artifact.read'].fallbackCondition, 'artifactRef.artifact.localPath');
    assert.equal(routes['design.preview.open'].fallbackCondition, 'artifactRef.artifact.localPath');
    assert.equal(routes['design.artifact.write'].fallbackOn, 'never');
    assert.equal(routes['design.artifact.write'].fallback, undefined);
  }
});

test('Open Design provider documents stable handshake and auth errors', () => {
  const source = readFileSync(new URL('../core/domains/design/providers/open-design/SKILL.md', import.meta.url), 'utf8');
  assert.match(source, /OD_HANDSHAKE_FAILED/);
  assert.match(source, /OD_AUTH_REQUIRED/);
});

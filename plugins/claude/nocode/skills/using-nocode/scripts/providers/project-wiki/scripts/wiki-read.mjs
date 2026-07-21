#!/usr/bin/env node
import path from 'node:path';
import {
  readWikiPage, recordWikiUsage, resolveWikiPage,
} from '../../../../../../scripts/wiki-read.mjs';
import {
  ensureNestedRepo, resolvePersonalDir, snapshot,
} from '../../../../../../scripts/personal-snapshot.mjs';
import { git } from '../../../../../../scripts/git-exec.mjs';

function defaultRecordUsage(input, { projectRoot }) {
  return recordWikiUsage(resolveWikiPage(projectRoot, input.path));
}

function defaultCreateSnapshot(input, { projectRoot }) {
  const personalDir = resolvePersonalDir(projectRoot);
  if (!personalDir) {
    const error = new Error('personal knowledge root is unavailable');
    error.code = 'PROJECT_WIKI_NOT_CONFIGURED';
    throw error;
  }
  ensureNestedRepo(personalDir);
  const outcome = snapshot(personalDir, false, input.snapshotMessage);
  if (outcome.status === 'committed') {
    const commit = git({ gitDir: path.join(personalDir, '.git'), workTree: personalDir }, ['rev-parse', 'HEAD']);
    return { created: true, commit };
  }
  if (['no_changes', 'dry_run'].includes(outcome.status)) return { created: false, commit: null };
  const error = new Error(`snapshot did not complete: ${outcome.status}`);
  error.code = 'PROJECT_WIKI_SNAPSHOT_FAILED';
  throw error;
}

export function executeProjectWiki(capability, input, {
  projectRoot = process.cwd(), execute = readWikiPage,
  recordUsage = defaultRecordUsage, createSnapshot = defaultCreateSnapshot,
} = {}) {
  if (capability === 'personal-knowledge.page.read') return execute({ ...input, projectRoot });
  if (capability === 'personal-knowledge.usage.record') return recordUsage(input, { projectRoot });
  if (capability === 'personal-knowledge.snapshot') return createSnapshot(input, { projectRoot });
  const error = new Error('unsupported project-wiki capability');
  error.code = 'PROJECT_WIKI_CAPABILITY_UNSUPPORTED';
  throw error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [capability, raw] = process.argv.slice(2);
    const result = executeProjectWiki(capability, JSON.parse(raw || '{}'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code || 'PROJECT_WIKI_ARGUMENT_INVALID' })}\n`);
    process.exitCode = 2;
  }
}

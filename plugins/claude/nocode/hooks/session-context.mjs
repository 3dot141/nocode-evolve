#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { detectPlatform, encodeSessionContext } from './lib/hook-codecs.mjs';

const content = readFileSync(0, 'utf8');
process.stdout.write(JSON.stringify(encodeSessionContext(content, detectPlatform())));

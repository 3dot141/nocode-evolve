import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export function upsertEnv(filePath, kv) {
  const raw = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const lines = raw === '' ? [] : raw.replace(/\n$/, '').split('\n');
  const remaining = new Map(Object.entries(kv));
  const out = lines.map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && remaining.has(m[1])) {
      const key = m[1];
      const val = remaining.get(key);
      remaining.delete(key);
      return `${key}=${val}`;
    }
    return line;
  });
  for (const [key, val] of remaining) out.push(`${key}=${val}`);
  const text = out.join('\n') + '\n';
  writeFileSync(filePath, text);
  return text;
}

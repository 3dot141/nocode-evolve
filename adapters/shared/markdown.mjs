const DESCRIPTION_LIMIT = 96;

export function compactDescription(value, limit = DESCRIPTION_LIMIT) {
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  const firstSentence = normalized.split(/(?<=[。！？.!?])\s+/u)[0] || normalized;
  if (firstSentence.length <= limit) return firstSentence;
  return `${firstSentence.slice(0, limit - 1).trimEnd()}…`;
}

export function extractDescription(text) {
  const frontmatter = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(String(text));
  if (!frontmatter) return '';
  const lines = frontmatter[1].split('\n');
  const index = lines.findIndex((line) => /^description:/.test(line));
  if (index < 0) return '';
  const rawValue = lines[index].replace(/^description:\s*/, '');
  if (!/^[>|][+-]?$/.test(rawValue)) return rawValue.trim();
  const parts = [];
  for (let line = index + 1; line < lines.length; line++) {
    if (!/^\s+/.test(lines[line]) && lines[line] !== '') break;
    parts.push(lines[line].trim());
  }
  return parts.join(' ').trim();
}

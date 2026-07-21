export function renderClaudeManifest(metadata) {
  return {
    $schema: 'https://json.schemastore.org/claude-code-plugin-manifest.json',
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author,
    license: metadata.license,
    keywords: metadata.keywords,
  };
}

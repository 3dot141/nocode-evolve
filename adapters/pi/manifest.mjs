export function renderPiManifest(metadata) {
  return {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author?.name,
    homepage: metadata.homepage,
    repository: metadata.repository,
    license: metadata.license,
    keywords: [...new Set([...(metadata.keywords || []), 'pi-package'])],
    type: 'module',
    pi: {
      extensions: ['./extensions/index.ts'],
      skills: ['./skills'],
      prompts: ['./prompts'],
    },
  };
}

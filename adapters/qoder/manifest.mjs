export function renderQoderManifest(metadata) {
  return {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author,
    homepage: metadata.homepage,
    repository: metadata.repository,
    license: metadata.license,
    keywords: metadata.keywords,
  };
}

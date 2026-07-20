export function renderCodexManifest(metadata) {
  return {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author,
    homepage: metadata.homepage,
    repository: metadata.repository,
    license: metadata.license,
    keywords: metadata.keywords,
    skills: './skills/',
    interface: {
      displayName: 'nocode',
      shortDescription: 'Personal engineering workflows and rules',
      longDescription: metadata.description,
      developerName: metadata.author.name,
      category: metadata.category,
      capabilities: ['Read', 'Write', 'Shell'],
      defaultPrompt: [
        'Use nocode to plan and execute this engineering task.',
        'Use nocode to review these changes.',
        'Use nocode to capture or recall project knowledge.',
      ],
    },
  };
}

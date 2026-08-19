export function renderDeepSeekManifest(metadata) {
  return {
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    author: metadata.author?.name,
    homepage: metadata.homepage,
    repository: metadata.repository,
    license: metadata.license,
    keywords: [...new Set([...(metadata.keywords || []), 'dsh-plugin', 'deepseek-harness'])],
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/index.d.ts',
    exports: {
      '.': './lib/index.js',
      './cordis.patch.yml': './cordis.patch.yml',
      './package.json': './package.json',
    },
    files: [
      'lib/',
      'skills/',
      'model/',
      'references/',
      'rules/',
      'scripts/',
      'hooks/pretooluse-rules.json',
      'cordis.patch.yml',
    ],
    dsh: {
      bundle: {
        patch: './cordis.patch.yml',
      },
    },
    peerDependencies: {
      '@deepseek-ai/cordis': '^4.0.1',
      '@deepseek-ai/dsh-skill': '^0.1.0-rc.7',
      '@deepseek-ai/dsh-shell-env': '^0.1.0-rc.7',
      '@deepseek-ai/dsh-system-prompt': '^0.1.0-rc.7',
      '@deepseek-ai/dsh-tools': '^0.1.0-rc.7',
    },
  };
}

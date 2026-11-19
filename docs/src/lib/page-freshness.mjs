import { execFileSync } from 'node:child_process';

const dates = new Map();

function newestCommit(paths) {
  const key = paths.join('\n');
  if (!dates.has(key)) {
    let timestamp;
    try {
      timestamp = execFileSync(
        'git',
        [
          'log',
          '-1',
          '--format=%cI',
          'HEAD',
          '--',
          ...paths.map((path) => ':(top,literal)' + path),
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
    } catch {
      // The source archive may have no Git history.
    }
    dates.set(key, timestamp || undefined);
  }
  return dates.get(key);
}

export function lastModified(slug) {
  const paths =
    slug === 'rest-api' || slug.startsWith('rest-api/')
      ? [
          slug === 'rest-api'
            ? 'docs/src/pages/rest-api/index.astro'
            : 'docs/src/pages/rest-api/[...operation].astro',
          'docs/src/lib/rest-catalog.ts',
          'docs/src/lib/rest-bindings.json',
          ...(slug === 'rest-api'
            ? []
            : [
                'docs/src/components/RestExplorer.astro',
                'docs/src/lib/rest-examples.ts',
                'docs/src/lib/rest-navigation.ts',
              ]),
        ]
      : ['mdx', 'md'].flatMap((extension) => [
          `docs/src/content/docs/${slug}.${extension}`,
          `docs/src/content/docs/${slug}/index.${extension}`,
        ]);
  if (slug === 'index') paths.push('package.json');
  if (slug === 'reference/troubleshooting')
    paths.push('docs/src/lib/troubleshooting-faq.ts');
  return newestCommit(paths) ?? newestCommit([]);
}

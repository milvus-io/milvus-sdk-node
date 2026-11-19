import { readdir, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'parse5';
import sdk from '../../package.json' with { type: 'json' };
import { pageMarkdown } from '../src/lib/agent-markdown.ts';
import {
  attribute,
  descendants,
  findNode,
  hasClass,
  htmlText,
} from '../src/lib/markdown-tree.ts';

const groups = new Map([
  ['getting-started', 'Getting Started'],
  ['core-concepts', 'Core Concepts'],
  ['operations', 'Data Operations'],
  ['management', 'Management'],
  ['advanced', 'Advanced Guides'],
  ['api-reference', 'SDK Reference'],
  ['reference', 'Resources'],
  ['rest-api', 'Milvus REST API'],
]);

function orderedPaths(sidebar, restIndexDoc, sitePathname) {
  const seen = new Map();
  for (const entry of sidebar ?? []) {
    const items = entry.items ?? [entry];
    for (const { slug } of items) {
      if (slug) seen.set(slug === 'index' ? '' : `${slug}/`, seen.size);
    }
  }
  seen.set('rest-api/', seen.size);
  const directory = findNode(restIndexDoc, (node) =>
    hasClass(node, 'rest-groups')
  );
  if (directory) {
    for (const node of descendants(directory)) {
      const href = node.tagName === 'a' && attribute(node, 'href');
      if (href && href.startsWith(sitePathname + 'rest-api/')) {
        const path = href.slice(sitePathname.length);
        if (!seen.has(path)) seen.set(path, seen.size);
      }
    }
  }
  return seen;
}

export async function generateAgentDocs(out, site, recipesFile, sidebar = []) {
  const restIndexDoc = parse(
    await readFile(new URL('rest-api/index.html', out), 'utf8')
  );
  const order = orderedPaths(sidebar, restIndexDoc, site.pathname);
  const files = (await readdir(out, { recursive: true }))
    .filter(
      (file) =>
        /(^|\/)index\.html$/.test(file) && file !== 'http-client/index.html'
    )
    .map((file) => file.replace(/index\.html$/, ''))
    .sort((a, b) => {
      const rankA = order.get(a) ?? Number.MAX_SAFE_INTEGER;
      const rankB = order.get(b) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || a.localeCompare(b);
    });
  const version = sdk.milvusVersion.replace(/^v/, '');
  const compatibility = `SDK: \`${sdk.name}@${sdk.version}\` · Tested with Milvus ${version}`;
  const pages = new Map(Array.from(groups.values(), (label) => [label, []]));

  for (const path of files) {
    const url = new URL(path, site);
    const doc = parse(
      await readFile(new URL(path + 'index.html', out), 'utf8')
    );
    const title = findNode(doc, (node) => attribute(node, 'id') === '_top');
    const description = findNode(
      doc,
      (node) =>
        node.tagName === 'meta' && attribute(node, 'name') === 'description'
    );
    const content = findNode(doc, (node) =>
      hasClass(node, 'sl-markdown-content')
    );
    const summary = description && attribute(description, 'content')?.trim();
    if (!title || !summary || !content)
      throw new Error(
        `Missing title, description, or documentation content for ${url}`
      );

    const name = htmlText(title).trim();
    const markdown = pageMarkdown(content, url, name, summary, compatibility);
    const href = new URL('index.md', url).href;
    const group = groups.get(path ? path.split('/')[0] : 'getting-started');
    if (!group) throw new Error(`Assign a documentation group for ${url}`);

    pages.get(group).push({ name, summary, href, markdown });
    await writeFile(new URL(path + 'index.md', out), markdown);
  }

  const fullHref = new URL('llms-full.txt', site).href;
  const summary = `> The official Node.js and TypeScript SDK for compatible Milvus 2.x and 3.0+ deployments and Zilliz Cloud. SDK ${sdk.version} (v3.x) is tested with Milvus ${version}, requires Node.js 18+, and is Apache-2.0 licensed. Choose MilvusClient for gRPC with snake_case request fields or HttpClient for REST v2 with camelCase request fields, including on edge and serverless runtimes.`;
  const index =
    [
      `# ${sdk.name}`,
      summary,
      `[Full documentation and quick-reference recipes](${fullHref})`,
      ...Array.from(pages, ([label, entries]) =>
        [
          `## ${label}`,
          entries
            .map(
              ({ name, summary, href }) => `- [${name}](${href}): ${summary}`
            )
            .join('\n'),
        ].join('\n\n')
      ),
    ].join('\n\n') + '\n';

  const recipes = (await readFile(recipesFile, 'utf8')).trimEnd();
  const full =
    [
      recipes,
      ...Array.from(pages.values()).flatMap((entries) =>
        entries.map(({ markdown }) => markdown.trimEnd())
      ),
    ].join('\n\n---\n\n') + '\n';

  await Promise.all([
    writeFile(new URL('llms.txt', out), index),
    writeFile(new URL('llms-full.txt', out), full),
  ]);
  return files.length;
}

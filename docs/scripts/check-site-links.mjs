import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

export async function checkSiteLinks(out, site) {
  const base = site.pathname;
  const outPath = fileURLToPath(out);
  const notFound = new URL('404.html', site);
  const legacy = new URL('http-client/', site);
  const guide = new URL('advanced/http-client/', site);
  const outputFiles = await readdir(out, {
    recursive: true,
    withFileTypes: true,
  });
  const files = outputFiles
    .filter((entry) => entry.isFile())
    .map(({ parentPath, name }) =>
      relative(outPath, join(parentPath, name)).split(sep).join('/')
    );
  const assets = new Set(files.map((file) => new URL(file, site).pathname));
  const pages = new Map();
  const errors = new Set();

  for (const file of files.filter((file) => file.endsWith('.html'))) {
    const url = new URL(file.replace(/(^|\/)index\.html$/, '$1'), site);
    const document = parse(await readFile(new URL(file, out), 'utf8'), {
      scriptingEnabled: false,
    });
    const page = {
      ids: new Set(),
      links: [],
      canonicals: [],
      noindex: new Set(),
      title: '',
      description: '',
      refresh: '',
    };

    function visit(node, inHead = false) {
      const attributes = Object.fromEntries(
        (node.attrs ?? []).map(({ name, value }) => [name, value])
      );
      if (attributes.id) page.ids.add(attributes.id);
      if (node.tagName === 'a') {
        if (attributes.name) page.ids.add(attributes.name);
        if (attributes.href !== undefined) page.links.push(attributes.href);
      }
      if (inHead && node.tagName === 'link' && attributes.rel === 'canonical') {
        page.canonicals.push(attributes.href);
      }
      if (inHead && node.tagName === 'title')
        page.title = node.childNodes[0]?.value;
      if (inHead && node.tagName === 'meta') {
        const name = attributes.name?.toLowerCase();
        if (
          (name === 'robots' || name === 'googlebot') &&
          attributes.content
            ?.toLowerCase()
            .split(/[\s,]+/)
            .some((rule) => rule === 'noindex' || rule === 'none')
        )
          page.noindex.add(name);
        if (name === 'description') page.description = attributes.content;
        if (attributes['http-equiv'] === 'refresh')
          page.refresh = attributes.content;
      }
      for (const child of node.childNodes ?? [])
        visit(child, node.tagName === 'head');
    }

    visit(document);
    pages.set(url.pathname, { ...page, url });
  }

  if (!pages.has(notFound.pathname)) errors.add('Missing 404.html');
  if (!pages.has(legacy.pathname))
    errors.add(`Missing legacy redirect: ${legacy.pathname}`);

  const descriptions = new Map();
  const titles = new Map();
  const indexable = new Set();
  for (const page of pages.values()) {
    const { url, canonicals } = page;
    if (url.href !== notFound.href && page.noindex.size)
      errors.add(`${url.pathname} must allow indexing`);
    if (url.href === notFound.href) {
      if (!page.noindex.has('robots') || canonicals.length)
        errors.add(
          `${url.pathname} must have robots noindex and omit its canonical URL`
        );
    } else if (url.href === legacy.href) {
      if (
        canonicals.length !== 1 ||
        canonicals[0] !== guide.href ||
        page.refresh !== `0; url=${guide.pathname}`
      ) {
        errors.add(
          `${url.pathname} must immediately redirect and canonicalize to ${guide}`
        );
      }
    } else if (url.pathname.endsWith('/')) {
      indexable.add(url.href);
      if (canonicals.length !== 1 || canonicals[0] !== url.href) {
        errors.add(
          `${url.pathname} must have one canonical URL matching its public URL`
        );
      }
      for (const [label, value, seen] of [
        ['title', page.title, titles],
        ['description', page.description, descriptions],
      ]) {
        if (!value?.trim())
          errors.add(`${url.pathname} is missing its ${label}`);
        else if (seen.has(value)) {
          errors.add(
            `${url.pathname} shares its ${label} with ${seen.get(value)}`
          );
        } else seen.set(value, url.pathname);
      }
    }

    for (const href of page.links) {
      const destination = new URL(href, url);
      if (destination.origin !== site.origin) continue;
      if (!destination.pathname.startsWith(base)) {
        // Absolute URLs may point to another project hosted on the same Pages domain.
        if (!/^(?:https?:)?\/\//i.test(href.trim())) {
          errors.add(`${url.pathname} links outside the site base: ${href}`);
        }
        continue;
      }
      const target = pages.get(destination.pathname);
      const fragment = decodeURIComponent(
        destination.hash.slice(1).split(':~:')[0]
      );
      if (destination.pathname.endsWith('/index.html')) {
        errors.add(`${url.pathname} links to an index.html alias: ${href}`);
      } else if (!target && !assets.has(destination.pathname)) {
        errors.add(`${url.pathname} links to missing page or file: ${href}`);
      } else if (target && fragment && !target.ids.has(fragment)) {
        errors.add(`${url.pathname} links to missing fragment: ${href}`);
      } else if (destination.pathname === legacy.pathname) {
        errors.add(`${url.pathname} links to the legacy redirect: ${href}`);
      }
    }
  }

  const sitemapUrls = new Set();
  for (const file of files.filter((file) => /^sitemap-\d+\.xml$/.test(file))) {
    const xml = await readFile(new URL(file, out), 'utf8');
    for (const [, href] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      sitemapUrls.add(href);
    }
  }
  for (const href of indexable) {
    if (!sitemapUrls.has(href)) errors.add(`Missing from sitemap: ${href}`);
  }
  for (const href of sitemapUrls) {
    if (!indexable.has(href))
      errors.add(`Noncanonical or excluded URL in sitemap: ${href}`);
  }

  if (errors.size) {
    throw new Error([...errors].join('\n'));
  }

  return pages.size;
}

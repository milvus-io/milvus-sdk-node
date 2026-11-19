import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { generateAgentDocs } from './scripts/generate-agent-docs.mjs';
import { lastModified } from './src/lib/page-freshness.mjs';
import { checkSiteLinks } from './scripts/check-site-links.mjs';

const site = 'https://milvus-io.github.io';
const docs = '/milvus-sdk-node';
const siteRoot = new URL(docs + '/', site);
const recipesFile = new URL('../llms.txt', import.meta.url);

const sidebar = [
  { slug: 'index', label: 'Overview' },
  {
    label: 'Getting Started',
    collapsed: false,
    items: [
      {
        slug: 'getting-started/getting-started',
        label: 'Getting Started',
      },
      { slug: 'getting-started/deployment', label: 'Deployment' },
      {
        slug: 'getting-started/examples-tutorials',
        label: 'Examples & Tutorials',
      },
    ],
  },
  {
    label: 'Core Concepts',
    collapsed: true,
    items: [
      {
        slug: 'core-concepts/client-configuration',
        label: 'Client Configuration',
      },
      {
        slug: 'core-concepts/data-types-schemas',
        label: 'Data Types & Schemas',
      },
    ],
  },
  {
    label: 'Data Operations',
    collapsed: true,
    items: [
      {
        slug: 'operations/database-operations',
        label: 'Database Operations',
      },
      {
        slug: 'operations/data-operations-insert',
        label: 'Insert & Update',
      },
      { slug: 'operations/bulk-writer', label: 'Bulk Writer & Import' },
      {
        slug: 'operations/data-operations-query',
        label: 'Query & Search',
      },
      { slug: 'operations/data-operations-delete', label: 'Delete' },
      { slug: 'operations/data-management', label: 'Data Management' },
      { slug: 'operations/hybrid-search', label: 'Hybrid Search' },
      { slug: 'operations/iterators', label: 'Iterators' },
    ],
  },
  {
    label: 'Management',
    collapsed: true,
    items: [
      {
        slug: 'management/collection-management',
        label: 'Collection Management',
      },
      {
        slug: 'management/partition-management',
        label: 'Partition Management',
      },
      {
        slug: 'management/index-management',
        label: 'Index Management',
      },
      {
        slug: 'management/user-role-management',
        label: 'User & Role Management',
      },
      {
        slug: 'management/resource-management',
        label: 'Resource Management',
      },
    ],
  },
  {
    label: 'Advanced Guides',
    collapsed: true,
    items: [
      {
        slug: 'advanced/advanced-features',
        label: 'Advanced Features',
      },
      { slug: 'advanced/http-client', label: 'HTTP Client' },
      { slug: 'advanced/function-chains', label: 'Function Chains' },
      {
        slug: 'advanced/full-text-search',
        label: 'Full-Text Search',
      },
      {
        slug: 'advanced/membership-filters',
        label: 'Membership Filters',
      },
      { slug: 'advanced/client-telemetry', label: 'Client Telemetry' },
      { slug: 'advanced/global-cluster', label: 'Global Cluster' },
      { slug: 'advanced/cloudflare', label: 'Cloudflare Workers' },
      { slug: 'advanced/vercel', label: 'Vercel' },
      { slug: 'advanced/aws-lambda', label: 'AWS Lambda' },
      { slug: 'advanced/best-practices', label: 'Best Practices' },
    ],
  },
  {
    label: 'SDK Reference',
    collapsed: true,
    items: [
      { slug: 'api-reference', label: 'Overview' },
      { slug: 'api-reference/client', label: 'MilvusClient' },
      { slug: 'api-reference/http-client', label: 'HttpClient' },
      {
        slug: 'api-reference/collections',
        label: 'Collection Operations',
      },
      { slug: 'api-reference/data', label: 'Data Operations' },
      { slug: 'api-reference/indexes', label: 'Index Operations' },
      {
        slug: 'api-reference/partitions',
        label: 'Partition Operations',
      },
      {
        slug: 'api-reference/databases',
        label: 'Database Operations',
      },
      {
        slug: 'api-reference/users-roles',
        label: 'User & Role Operations',
      },
      {
        slug: 'api-reference/resource-groups',
        label: 'Resource Group Operations',
      },
      { slug: 'api-reference/system', label: 'System Operations' },
      { slug: 'api-reference/bulk-writer', label: 'BulkWriter' },
      {
        slug: 'api-reference/types-and-enums',
        label: 'Types & Enums',
      },
    ],
  },
  {
    label: 'Resources',
    collapsed: true,
    items: [
      { slug: 'reference/troubleshooting', label: 'Troubleshooting' },
      {
        slug: 'reference/migration-compatibility',
        label: 'Migration & Compatibility',
      },
      { slug: 'reference/release-notes', label: 'Release Notes' },
      { slug: 'reference/contributing', label: 'Contributing' },
      {
        slug: 'reference/additional-resources',
        label: 'Additional Resources',
      },
    ],
  },
];

export default defineConfig({
  site,
  base: docs,
  trailingSlash: 'always',
  outDir: './out',
  integrations: [
    sitemap({
      filter: (url) => new URL(url).pathname !== `${docs}/http-client/`,
      serialize: (item) => {
        const slug =
          new URL(item.url).pathname
            .slice(siteRoot.pathname.length)
            .replace(/\/$/, '') || 'index';
        const lastmod = lastModified(slug);
        return { ...item, lastmod };
      },
    }),
    starlight({
      title: 'Milvus Node.js SDK',
      social: [],
      favicon: '/icon.svg',
      logo: {
        src: './public/milvus-logo.svg',
        alt: 'Milvus',
        replacesTitle: false,
      },
      titleDelimiter: '–',
      customCss: ['./src/styles/custom.css'],
      editLink: {
        baseUrl: 'https://github.com/milvus-io/milvus-sdk-node/edit/main/docs/',
      },
      disable404Route: true,
      lastUpdated: true,
      routeMiddleware: './src/route-middleware.ts',
      components: {
        Head: './src/components/Head.astro',
        Header: './src/components/Header.astro',
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
        Footer: './src/components/Footer.astro',
        PageTitle: './src/components/PageTitle.astro',
      },
      sidebar,
    }),
    {
      name: 'generate-agent-docs',
      hooks: {
        'astro:build:done': async ({ dir, logger }) => {
          const pages = await generateAgentDocs(
            dir,
            siteRoot,
            recipesFile,
            sidebar
          );
          logger.info(
            `Generated ${pages} Markdown mirrors and the LLM documentation bundles.`
          );
        },
      },
    },
    {
      name: 'check-site-links',
      hooks: {
        'astro:build:done': async ({ dir, logger }) => {
          const pages = await checkSiteLinks(dir, siteRoot);
          logger.info(
            `Verified ${pages} HTML pages, internal links, Markdown, metadata, and sitemap URLs.`
          );
        },
      },
    },
  ],
});

import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const docs = '/milvus-sdk-node';

export default defineConfig({
  site: 'https://milvus-io.github.io',
  base: docs,
  trailingSlash: 'never',
  outDir: './out',
  integrations: [
    starlight({
      title: 'Node SDK',
      description: 'The official Milvus client for Node.js',
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
      routeMiddleware: './src/route-middleware.ts',
      components: {
        Head: './src/components/Head.astro',
        Header: './src/components/Header.astro',
        MobileMenuFooter: './src/components/MobileMenuFooter.astro',
        Footer: './src/components/Footer.astro',
        PageTitle: './src/components/PageTitle.astro',
      },
      sidebar: [
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
          collapsed: false,
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
          collapsed: false,
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
          collapsed: false,
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
          collapsed: false,
          items: [
            {
              slug: 'advanced/advanced-features',
              label: 'Advanced Features',
            },
            { slug: 'advanced/http-client', label: 'HTTP Client' },
            {
              slug: 'advanced/full-text-search',
              label: 'Full-Text Search',
            },
            { slug: 'advanced/global-cluster', label: 'Global Cluster' },
            { slug: 'advanced/cloudflare', label: 'Cloudflare Workers' },
            { slug: 'advanced/vercel', label: 'Vercel' },
            { slug: 'advanced/aws-lambda', label: 'AWS Lambda' },
            { slug: 'advanced/best-practices', label: 'Best Practices' },
          ],
        },
        {
          label: 'API Reference',
          collapsed: true,
          items: [
            { slug: 'api-reference', label: 'Overview' },
            { slug: 'api-reference/client', label: 'MilvusClient' },
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
            {
              slug: 'api-reference/types-and-enums',
              label: 'Types & Enums',
            },
          ],
        },
        {
          label: 'Resources',
          collapsed: false,
          items: [
            { slug: 'reference/troubleshooting', label: 'Troubleshooting' },
            {
              slug: 'reference/migration-compatibility',
              label: 'Migration & Compatibility',
            },
            { slug: 'reference/contributing', label: 'Contributing' },
            {
              slug: 'reference/additional-resources',
              label: 'Additional Resources',
            },
          ],
        },
      ],
    }),
  ],
});

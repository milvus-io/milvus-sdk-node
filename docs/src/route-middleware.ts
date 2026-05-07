import {
  defineRouteMiddleware,
  type StarlightRouteData,
} from '@astrojs/starlight/route-data';

type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;

type SidebarLinkConfig = {
  slug: string;
  label: string;
};

const API_REFERENCE_LINKS: SidebarLinkConfig[] = [
  { slug: 'api-reference', label: 'Overview' },
  { slug: 'api-reference/client', label: 'MilvusClient' },
  { slug: 'api-reference/collections', label: 'Collection Operations' },
  { slug: 'api-reference/data', label: 'Data Operations' },
  { slug: 'api-reference/indexes', label: 'Index Operations' },
  { slug: 'api-reference/partitions', label: 'Partition Operations' },
  { slug: 'api-reference/databases', label: 'Database Operations' },
  { slug: 'api-reference/users-roles', label: 'User & Role Operations' },
  {
    slug: 'api-reference/resource-groups',
    label: 'Resource Group Operations',
  },
  { slug: 'api-reference/system', label: 'System Operations' },
  { slug: 'api-reference/types-and-enums', label: 'Types & Enums' },
];

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const guidesHref = basePath || '/';

function normalizeSlug(slug: string) {
  return slug === 'api-reference/index' ? 'api-reference' : slug;
}

function isApiReferenceRoute(slug: string) {
  return slug === 'api-reference' || slug.startsWith('api-reference/');
}

function makeApiReferenceLink(
  currentSlug: string,
  { slug, label }: SidebarLinkConfig
): SidebarLink {
  return {
    type: 'link',
    label,
    href: `${basePath}/${slug}`,
    isCurrent: currentSlug === slug,
    badge: undefined,
    attrs: {},
  };
}

function getApiReferencePagination(links: SidebarLink[]) {
  const currentIndex = links.findIndex((link) => link.isCurrent);

  return {
    prev: currentIndex > 0 ? links[currentIndex - 1] : undefined,
    next:
      currentIndex >= 0 && currentIndex < links.length - 1
        ? links[currentIndex + 1]
        : undefined,
  };
}

function getGuidesLink(): SidebarLink {
  return {
    type: 'link',
    label: '← Guides',
    href: guidesHref,
    isCurrent: false,
    badge: undefined,
    attrs: {},
  };
}

export const onRequest = defineRouteMiddleware(async (context, next) => {
  await next();

  const route = context.locals.starlightRoute;
  if (!route || typeof route.id !== 'string') {
    return;
  }

  const currentSlug = normalizeSlug(route.id);

  if (!isApiReferenceRoute(currentSlug)) {
    return;
  }

  const links = API_REFERENCE_LINKS.map((link) =>
    makeApiReferenceLink(currentSlug, link)
  );

  route.sidebar = [
    getGuidesLink(),
    {
      type: 'group',
      label: 'API Reference',
      entries: links,
      collapsed: false,
      badge: undefined,
    },
  ];
  route.pagination = getApiReferencePagination(links);
});

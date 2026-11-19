import type { StarlightRouteData } from '@astrojs/starlight/route-data';

export function pageBreadcrumbs(
  { id, entry, sidebar, siteTitleHref }: StarlightRouteData,
  base: string,
  pathname: string
) {
  const title = entry.data.title;
  const isHome = pathname.replace(/\/$/, '') === base;
  const [section, group] = id.split('/');
  const sectionGroup = sidebar.find(
    (item) =>
      item.type === 'group' &&
      item.entries.some((link) => link.type === 'link' && link.isCurrent)
  );
  const items: { label: string; href?: string }[] = [
    { label: 'Node SDK', href: siteTitleHref },
  ];
  if (
    section === 'api-reference' &&
    id !== 'api-reference' &&
    id !== 'api-reference/index'
  ) {
    items.push({ label: 'SDK Reference', href: base + '/api-reference/' });
  } else if (section === 'rest-api' && group) {
    items.push({ label: 'REST API', href: base + '/rest-api/' });
    if (sectionGroup)
      items.push({
        label: sectionGroup.label,
        href: `${base}/rest-api/#${group}`,
      });
  } else if (!isHome && section !== 'rest-api' && section !== 'api-reference') {
    const guidesHref = base + '/getting-started/getting-started/';
    if (pathname !== guidesHref)
      items.push({ label: 'Guides', href: guidesHref });
    if (sectionGroup && sectionGroup.label !== title)
      items.push({ label: sectionGroup.label });
  }

  return {
    items,
    current: { label: isHome ? 'Quickstart' : title, href: pathname },
    isHome,
  };
}

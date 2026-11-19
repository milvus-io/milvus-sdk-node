import { restOperations, type RestOperation } from './rest-catalog';

export const restGroups = new Map<string, RestOperation[]>();
for (const operation of restOperations) {
  const operations = restGroups.get(operation.group) ?? [];
  operations.push(operation);
  restGroups.set(operation.group, operations);
}

export const legacyRestSlugs = {
  'list-collections': 'collections/list',
  'describe-collection': 'collections/describe',
  query: 'entities/query',
  search: 'entities/search',
} as const;

export const sdkMethods: Record<string, string> = {
  'collections/list': 'listCollections',
  'collections/describe': 'describeCollection',
  'entities/query': 'query',
  'entities/search': 'search',
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function restHref(slug?: string) {
  return slug ? `${base}/rest-api/${slug}` : `${base}/rest-api`;
}

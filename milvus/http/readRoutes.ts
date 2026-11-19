export const HTTP_COLLECTION_PREFIX = '/vectordb/collections';
export const HTTP_ENTITY_PREFIX = '/vectordb/entities';

export const HTTP_READ_OPERATIONS = {
  listCollections: { prefix: HTTP_COLLECTION_PREFIX, action: 'list' },
  describeCollection: { prefix: HTTP_COLLECTION_PREFIX, action: 'describe' },
  query: { prefix: HTTP_ENTITY_PREFIX, action: 'query' },
  search: { prefix: HTTP_ENTITY_PREFIX, action: 'search' },
} as const;

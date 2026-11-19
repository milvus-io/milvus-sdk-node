type Body = Record<string, unknown>;

const notes: Record<string, string> = {
  dbName: 'Database name. Operations on collections use default when omitted.',
  collectionName: 'Name of the collection.',
  partitionNames: 'Names of the partitions to target.',
  dimension:
    'Number of vector components for quick collection setup. Supply this or an explicit schema.',
  idType: 'Primary key type for quick setup, such as Int64 or VarChar.',
  autoID: 'Let the server generate primary keys.',
  metricType: 'Vector distance metric, such as COSINE, L2, or IP.',
  vectorFieldType:
    'Vector data type for quick setup. Choose a type compatible with the metric.',
  consistencyLevel:
    'Read consistency level, such as Strong, Session, or Bounded.',
  primaryFieldName: 'Primary key field name for quick setup.',
  vectorFieldName: 'Vector field name for quick setup.',
  schema: 'Schema definition with field names, data types and type parameters.',
  indexParams:
    'Index definitions, including the target field, metric and index parameters.',
  params: 'Additional operation parameters.',
  properties: 'Map of property names to their new values.',
  description: 'Human-readable description.',
  externalSource: 'URI identifying the external data source.',
  externalSpec:
    'Serialized JSON specifying the external storage format and options.',
  newCollectionName: 'New name of the collection.',
  newDbName: 'Destination database for a rename across databases.',
  function:
    'Function definition with name, type, inputFieldNames and outputFieldNames.',
  functionName: 'Name of the collection function.',
  FunctionName: 'Name of the collection function to remove.',
  outputField: 'Schema of the field created for the function output.',
  propertyKeys: 'Names of the properties to remove.',
  isClustering: 'Request clustering compaction.',
  jobID: 'Numeric compaction job ID returned at submission.',
  fieldName: 'Name of the target field.',
  fieldParams: 'Updated field parameters as a key-value object.',
  fieldId: 'Numeric field ID, as an alternative to fieldName.',
  outputFields: 'Field names to include in the returned entities.',
  filter: 'Milvus scalar filter expression.',
  limit: 'Maximum number of rows or hits per query input.',
  offset: 'Number of matching results to skip.',
  orderByFields: 'Field ordering expressions for sorted results.',
  groupByFields: 'Fields used to group query results.',
  exprParams: 'Values for placeholders in a filter expression.',
  partitionName: 'Name of the partition.',
  id: 'Primary key or array of primary keys, matching the collection schema.',
  data: 'Array of entity objects keyed by field name.',
  partialUpdate: 'Update only the provided fields of existing entities.',
  fieldOps:
    'Per-field operations for a partial upsert, such as appending array elements.',
  ids: 'Stored primary keys to search by, as an alternative to data.',
  annsField:
    'Vector field to search. Specify it when the collection has multiple vector fields.',
  groupingField: 'Scalar field used to group search hits.',
  groupSize: 'Number of hits requested per group.',
  strictGroupSize: 'Require the specified number of hits in each result group.',
  searchParams:
    'Index-specific search parameters, including metric and search tuning options.',
  functionScore: 'Scoring functions and parameters to apply to candidates.',
  functionChains: 'Ordered function chains to apply during search.',
  searchAggregation:
    'Bucket aggregation and metric configuration for search hits.',
  search: 'Sub-searches with query data, vector field and limit.',
  rerank:
    'Reranking strategy and parameters, such as reciprocal rank fusion (rrf).',
  userName: 'Milvus user name.',
  password: 'User password. Use the current password for a password change.',
  newPassword: 'New password for the account.',
  roleName: 'Milvus role name.',
  objectType: 'Object type to which the grant applies, such as Collection.',
  objectName: 'Object name within the grant scope.',
  privilege: 'Name of the privilege to grant or revoke.',
  privilegeGroupName: 'Name of the custom privilege group.',
  privileges: 'Privilege names to add or remove.',
  indexName: 'Name of the index on the collection.',
  timestamp: 'Timestamp for the index description, when needed.',
  aliasName: 'Alias used to address a collection.',
  files: 'Groups of import file paths accessible to Milvus in object storage.',
  options: 'Import options as string key-value pairs.',
  jobId: 'Job ID returned when the job was submitted.',
  targetCollectionName: 'Collection name to use for the restored data.',
  snapshotMetadataURI: 'URI of the exported snapshot metadata.',
  snapshotName: 'Name of the collection snapshot.',
  targetS3Path: 'Object storage destination for the exported snapshot.',
  compactionProtectionSeconds: 'Compaction protection period in seconds.',
  sourceDbName: 'Database holding the source snapshot.',
  sourceCollectionName: 'Collection holding the source snapshot.',
  targetDbName: 'Database for the restored collection.',
  ttlSeconds: 'Pin lifetime in seconds.',
  pinId: 'Pin identifier returned when snapshot data was pinned.',
  name: 'Resource name.',
  config: 'Resource group node allocation, with requests and limits.',
  resource_groups:
    'Map from resource group name to node allocation configuration.',
  sourceRgName: 'Resource group that currently owns the replicas.',
  targetRgName: 'Resource group that should receive the replicas.',
  replicaNum: 'Number of collection replicas to transfer.',
  path: 'Server-accessible location of the file resource.',
  collectionID: 'Internal collection ID from the collection description.',
  segmentIDs: 'List of internal segment IDs.',
  analyzerParams: 'Analyzer configuration encoded as a JSON string.',
  text: 'Input strings to tokenize.',
  withDetail: 'Include detailed token information.',
  withHash: 'Include token hash values.',
  analyzerNames: 'Names of the analyzers to apply.',
};

export function fieldNotes(route: string, name: string): string | undefined {
  // A few Go request structs are shared between handlers. Hide unused fields.
  if (
    name === 'partitionNames' &&
    !route.startsWith('/entities/') &&
    ![
      '/collections/get_load_state',
      '/partitions/load',
      '/partitions/release',
    ].includes(route)
  )
    return;
  if (
    route === '/collections/create' &&
    ['externalSource', 'externalSpec'].includes(name)
  )
    return;
  if (
    route === '/entities/insert' &&
    ['partialUpdate', 'fieldOps'].includes(name)
  )
    return;
  if (route === '/entities/search' && name === 'data')
    return 'Query inputs, such as an array of vectors. Supply data or ids.';
  if (route === '/collections/add_function_field' && name === 'indexParams')
    return 'Index definition for the new output field.';
  if (name === 'fieldName' && route === '/collections/fields/drop')
    return 'Field to remove; supply its name or its fieldId.';
  if (name === 'schema' && route === '/collections/create')
    return 'Explicit collection schema. Put externalSource and externalSpec inside schema for an external collection.';
  if (name === 'jobId' && route === '/jobs/external_collection/describe')
    return 'Unquoted int64 job ID. Paste the exact digits returned by the refresh request.';
  if (!notes[name]) throw new Error('Missing REST field description: ' + name);
  return notes[name];
}

const vector = [0.1, 0.2, 0.3, 0.4];
const fn = {
  name: 'title_bm25',
  type: 'BM25',
  inputFieldNames: ['title'],
  outputFieldNames: ['title_sparse'],
};
const limits = { requests: { node_num: 1 }, limits: { node_num: 1 } };
const field = {
  fieldName: 'category',
  dataType: 'VarChar',
  nullable: true,
  elementTypeParams: { max_length: 128 },
};
const index = {
  fieldName: 'vector',
  indexName: 'vector_idx',
  metricType: 'COSINE',
  params: { index_type: 'AUTOINDEX' },
};
const requiredValues: Body = {
  collectionName: 'books',
  dbName: 'library',
  newCollectionName: 'books_archive',
  partitionName: 'fiction',
  partitionNames: ['fiction'],
  aliasName: 'current_books',
  roleName: 'catalog_reader',
  userName: 'catalog_user',
  password: '<YOUR_PASSWORD>',
  privilege: 'Search',
  objectType: 'Collection',
  objectName: 'books',
  privilegeGroupName: 'catalog_reads',
  indexName: 'vector_idx',
  indexParams: [index],
  filter: 'id in [101]',
  id: [1, 2],
  fieldName: 'title',
  functionName: fn.name,
  FunctionName: fn.name,
  function: fn,
  schema: field,
  outputField: { fieldName: 'title_sparse', dataType: 'SparseFloatVector' },
  files: [['imports/books.parquet']],
  jobId: '123456789',
  snapshotName: 'books_backup',
  sourceCollectionName: 'books',
  targetCollectionName: 'books_restored',
  pinId: '123456789',
  snapshotMetadataURI: 's3://example-bucket/snapshots/books/manifest.json',
  targetS3Path: 's3://example-bucket/snapshots/books/',
  name: 'catalog_queries',
  path: 's3://example-bucket/analyzers/dictionary.txt',
  resource_groups: { catalog_queries: limits },
  sourceRgName: '__default_resource_group',
  targetRgName: 'catalog_queries',
  replicaNum: 1,
  text: ['Vector search with Milvus'],
};

const subsearch = { annsField: 'vector', data: [vector], limit: 5 };
const hybrid = {
  search: [subsearch, { ...subsearch, data: [[1, 0, 0, 0]] }],
  rerank: { strategy: 'rrf', params: { k: 60 } },
  limit: 3,
  outputFields: ['title'],
};
const row = { id: 101, title: 'Invisible Cities', vector };
const extras: Record<string, Body> = {
  '/collections/create': {
    collectionName: 'books_demo',
    dimension: 4,
    metricType: 'COSINE',
    primaryFieldName: 'id',
    vectorFieldName: 'vector',
  },
  '/collections/alter_properties': {
    properties: { 'collection.ttl.seconds': '86400' },
  },
  '/collections/drop_properties': { propertyKeys: ['collection.ttl.seconds'] },
  '/collections/fields/alter_properties': {
    fieldParams: { max_length: '256' },
  },
  '/collections/fields/drop': { fieldName: 'category' },
  '/collections/struct_fields/add': {
    schema: {
      fieldName: 'editions',
      dataType: 'Array',
      elementDataType: 'Struct',
      typeParams: { max_capacity: '16' },
      nullable: true,
      fields: [
        {
          fieldName: 'year',
          dataType: 'Array',
          elementDataType: 'Int32',
          elementTypeParams: { max_capacity: '16' },
        },
      ],
    },
  },
  '/collections/get_compaction_state': { jobID: 123456789 },
  '/databases/alter': { properties: { 'database.replica.number': '1' } },
  '/databases/alter_properties': {
    properties: { 'database.replica.number': '1' },
  },
  '/databases/drop_properties': { propertyKeys: ['database.replica.number'] },
  '/entities/insert': { data: [row] },
  '/entities/upsert': { data: [row] },
  '/entities/query': { outputFields: ['title'], limit: 5 },
  '/entities/get': { outputFields: ['title'] },
  '/entities/search': {
    data: [vector],
    annsField: 'vector',
    limit: 5,
    outputFields: ['title'],
  },
  '/entities/advanced_search': hybrid,
  '/entities/hybrid_search': hybrid,
  '/indexes/alter_properties': { properties: { 'mmap.enabled': 'true' } },
  '/indexes/drop_properties': { propertyKeys: ['mmap.enabled'] },
  '/users/update_password': {
    password: '<CURRENT_PASSWORD>',
    newPassword: '<NEW_PASSWORD>',
  },
  '/roles/alter': { description: 'Read access for the catalog application' },
  '/roles/grant_privilege_v2': { collectionName: 'books' },
  '/roles/revoke_privilege_v2': { collectionName: 'books' },
  '/privilege_groups/add_privileges_to_group': {
    privileges: ['Search', 'Query'],
  },
  '/privilege_groups/remove_privileges_from_group': { privileges: ['Query'] },
  '/jobs/external_collection/describe': { jobId: 123456789 },
  '/snapshots/pin': { ttlSeconds: 3600 },
  '/snapshots/restore': { sourceDbName: 'default', targetDbName: 'default' },
  '/file_resources/add': { name: 'dictionary' },
  '/file_resources/remove': { name: 'dictionary' },
  '/segments/describe': { collectionID: 123456789 },
  '/common/run_analyzer': { analyzerParams: '{"tokenizer":"standard"}' },
};

export function exampleRequest(
  route: string,
  required: readonly string[],
  properties: Record<string, string>
): Body {
  const example: Body = {};
  if ('dbName' in properties) example.dbName = 'default';
  for (const key of required) {
    if (!(key in requiredValues))
      throw new Error('Missing REST example field: ' + key);
    example[key] = requiredValues[key];
  }
  return { ...example, ...extras[route] };
}

const responses: Record<string, Body> = {
  '/collections/list': { code: 0, data: ['books'] },
  '/collections/describe': {
    code: 0,
    data: {
      collectionName: 'books',
      fields: [
        { name: 'id', type: 'Int64', primaryKey: true },
        { name: 'title', type: 'VarChar' },
        {
          name: 'vector',
          type: 'FloatVector',
          params: [{ key: 'dim', value: '4' }],
        },
      ],
      load: 'LoadStateLoaded',
    },
  },
  '/entities/query': {
    code: 0,
    data: [{ id: 1, title: 'The Left Hand of Darkness' }],
  },
  '/entities/search': {
    code: 0,
    data: [{ id: 1, distance: 0.98, title: 'The Left Hand of Darkness' }],
  },
  '/databases/list': { code: 0, data: ['default'] },
  '/partitions/list': { code: 0, data: ['_default'] },
  '/collections/has': { code: 0, data: { has: true } },
  '/partitions/has': { code: 0, data: { has: true } },
};
export function exampleResponse(route: string): Body | undefined {
  return responses[route];
}

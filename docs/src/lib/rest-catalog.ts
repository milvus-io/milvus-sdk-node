import bindings from './rest-bindings.json';
import { fieldNotes, exampleRequest, exampleResponse } from './rest-examples';

export type RestOperation = {
  slug: string;
  group: string;
  title: string;
  path: string;
  description: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
};

type Route = keyof typeof bindings.routes;
type Entry = [Route, string, string];
type Group = {
  title: string;
  slug: string;
  prefix: string;
  operations: Entry[];
};

// Routes and parameter bindings are pinned to the SDK's target Milvus version.
// Groups below follow the resource being managed, including separate job lifecycles.
const groups: Group[] = [
  {
    title: 'Entities & search',
    slug: 'entities',
    prefix: '/entities/',
    operations: [
      [
        '/entities/insert',
        'Insert entities',
        'Write rows to a collection. Each row must satisfy its schema, including vector dimensions.',
      ],
      [
        '/entities/upsert',
        'Upsert entities',
        'Insert new rows or replace rows with matching primary keys. Use partialUpdate to update selected fields.',
      ],
      [
        '/entities/get',
        'Get by ID',
        'Fetch one or more entities by primary key from a loaded collection.',
      ],
      [
        '/entities/query',
        'Query entities',
        'Read rows matching a scalar filter. Supply a limit when reading without a filter.',
      ],
      [
        '/entities/search',
        'Search vectors',
        'Find nearest neighbors in a loaded collection. Provide query data or existing primary keys and select a vector field when needed.',
      ],
      [
        '/entities/hybrid_search',
        'Hybrid search',
        'Combine multiple vector searches and rerank the candidates into one result list.',
      ],
      [
        '/entities/advanced_search',
        'Advanced search (alias)',
        'Compatibility alias for hybrid search. New integrations can use the hybrid_search route.',
      ],
      [
        '/entities/delete',
        'Delete entities',
        'Delete entities matching a scalar expression. A primary-key filter limits the deletion to specific rows.',
      ],
    ],
  },
  {
    title: 'Collections',
    slug: 'collections',
    prefix: '/collections/',
    operations: [
      [
        '/collections/list',
        'List collections',
        'List the names of collections in a database.',
      ],
      [
        '/collections/create',
        'Create collection',
        'Create a collection using a vector dimension for quick setup or an explicit schema for custom fields and functions.',
      ],
      [
        '/collections/has',
        'Check collection existence',
        'Check whether a named collection exists in the database.',
      ],
      [
        '/collections/describe',
        'Describe collection',
        'Read field names, data types, indexes and load state for a collection.',
      ],
      [
        '/collections/get_stats',
        'Collection statistics',
        'Read collection statistics, including the reported row count.',
      ],
      [
        '/collections/load',
        'Load collection',
        'Load collection data into query nodes so it can serve queries and vector searches.',
      ],
      [
        '/collections/get_load_state',
        'Get load state',
        'Check the loading state of a collection or its named partitions.',
      ],
      [
        '/collections/refresh_load',
        'Refresh loaded data',
        'Refresh a loaded collection to pick up changes in its data or indexes.',
      ],
      [
        '/collections/release',
        'Release collection',
        'Release a collection from query-node memory. Load it again before searching.',
      ],
      [
        '/collections/rename',
        'Rename collection',
        'Change the collection name, optionally specifying a destination database.',
      ],
      [
        '/collections/alter_properties',
        'Set properties',
        'Set collection properties by key. Supplied values replace existing values for those keys.',
      ],
      [
        '/collections/drop_properties',
        'Remove properties',
        'Remove the specified collection property keys.',
      ],
      [
        '/collections/flush',
        'Flush collection',
        'Request a flush of data in the collection.',
      ],
      [
        '/collections/compact',
        'Start compaction',
        'Schedule compaction of collection segments and obtain a compaction job ID.',
      ],
      [
        '/collections/get_compaction_state',
        'Get compaction state',
        'Read the state of a previously submitted compaction job.',
      ],
      [
        '/collections/truncate',
        'Truncate collection',
        'Remove all entities while retaining the collection schema and indexes.',
      ],
      [
        '/collections/drop',
        'Drop collection',
        'Permanently remove the named collection and its data.',
      ],
    ],
  },
  {
    title: 'Fields & functions',
    slug: 'schema',
    prefix: '/collections/',
    operations: [
      [
        '/collections/fields/add',
        'Add field',
        'Add a field to an existing collection using a field schema.',
      ],
      [
        '/collections/struct_fields/add',
        'Add struct field',
        'Add a struct-array field with its nested field definitions.',
      ],
      [
        '/collections/fields/alter_properties',
        'Set field properties',
        'Change supported field parameters on an existing collection field.',
      ],
      [
        '/collections/fields/drop',
        'Drop field',
        'Remove a field by name or field ID. Existing data for the removed field is lost.',
      ],
      [
        '/collections/add_function',
        'Add function',
        'Bind a function to input and output fields in the collection schema.',
      ],
      [
        '/collections/alter_function',
        'Alter function',
        'Replace the definition of a named collection function.',
      ],
      [
        '/collections/drop_function',
        'Drop function',
        'Remove a named function from the collection schema.',
      ],
      [
        '/collections/add_function_field',
        'Add function and field',
        'Add a function with its output field and optional index configuration.',
      ],
      [
        '/collections/drop_function_field',
        'Drop function and field',
        'Remove a function together with its output field.',
      ],
    ],
  },
  {
    title: 'Indexes',
    slug: 'indexes',
    prefix: '/indexes/',
    operations: [
      ['/indexes/list', 'List indexes', 'List index names for a collection.'],
      [
        '/indexes/create',
        'Create index',
        'Build an index on a field. Vector indexes require a compatible metric.',
      ],
      [
        '/indexes/describe',
        'Describe index',
        'Inspect index configuration and build state.',
      ],
      [
        '/indexes/alter_properties',
        'Set index properties',
        'Update supported properties on a named index.',
      ],
      [
        '/indexes/drop_properties',
        'Remove index properties',
        'Remove specified keys from index properties.',
      ],
      [
        '/indexes/drop',
        'Drop index',
        'Remove a named index from a collection.',
      ],
    ],
  },
  {
    title: 'Partitions',
    slug: 'partitions',
    prefix: '/partitions/',
    operations: [
      [
        '/partitions/list',
        'List partitions',
        'List partitions in a collection.',
      ],
      [
        '/partitions/create',
        'Create partition',
        'Create a named partition in a collection that supports manual partitions.',
      ],
      [
        '/partitions/has',
        'Check partition existence',
        'Check whether the named partition exists in a collection.',
      ],
      [
        '/partitions/get_stats',
        'Partition statistics',
        'Read statistics for the specified partition.',
      ],
      [
        '/partitions/load',
        'Load partitions',
        'Load the specified partitions so their data can serve read requests.',
      ],
      [
        '/partitions/release',
        'Release partitions',
        'Release the specified partitions from query-node memory.',
      ],
      [
        '/partitions/drop',
        'Drop partition',
        'Remove a partition and the entities stored in it.',
      ],
    ],
  },
  {
    title: 'Databases',
    slug: 'databases',
    prefix: '/databases/',
    operations: [
      [
        '/databases/list',
        'List databases',
        'List the databases visible to the caller.',
      ],
      [
        '/databases/create',
        'Create database',
        'Create a database, optionally supplying its properties.',
      ],
      [
        '/databases/describe',
        'Describe database',
        'Read properties and metadata for a database.',
      ],
      [
        '/databases/alter_properties',
        'Set database properties',
        'Set or replace database property values.',
      ],
      [
        '/databases/alter',
        'Alter database',
        'Alternative route for updating database properties.',
      ],
      [
        '/databases/drop_properties',
        'Remove database properties',
        'Remove the specified database property keys.',
      ],
      [
        '/databases/drop',
        'Drop database',
        'Remove an empty database after its collections have been removed.',
      ],
    ],
  },
  {
    title: 'Collection aliases',
    slug: 'aliases',
    prefix: '/aliases/',
    operations: [
      [
        '/aliases/list',
        'List aliases',
        'List collection aliases, optionally filtering by collection.',
      ],
      [
        '/aliases/create',
        'Create alias',
        'Associate a new alias with a collection.',
      ],
      [
        '/aliases/describe',
        'Describe alias',
        'Look up the collection associated with an alias.',
      ],
      [
        '/aliases/alter',
        'Reassign alias',
        'Point an existing alias at another collection.',
      ],
      [
        '/aliases/drop',
        'Drop alias',
        'Remove an alias while retaining its underlying collection.',
      ],
    ],
  },
  {
    title: 'Bulk import',
    slug: 'import-jobs',
    prefix: '/jobs/import/',
    operations: [
      [
        '/jobs/import/create',
        'Start import',
        'Submit files already accessible to Milvus for import into a collection.',
      ],
      [
        '/jobs/import/list',
        'List import jobs',
        'List import jobs, optionally filtering by collection.',
      ],
      [
        '/jobs/import/describe',
        'Describe import job',
        'Read job state, progress, and any reported failure reason.',
      ],
      [
        '/jobs/import/get_progress',
        'Get progress (legacy)',
        'Legacy route for reading import progress. Prefer the describe route for new integrations.',
      ],
      [
        '/jobs/import/commit',
        'Commit import',
        'Commit a prepared import job using the job ID returned at submission.',
      ],
      [
        '/jobs/import/abort',
        'Abort import',
        'Abort an import job using its job ID.',
      ],
    ],
  },
  {
    title: 'External collections',
    slug: 'external-collections',
    prefix: '/jobs/external_collection/',
    operations: [
      [
        '/jobs/external_collection/refresh',
        'Refresh external collection',
        'Submit a refresh of an external collection from its configured or supplied data source.',
      ],
      [
        '/jobs/external_collection/list',
        'List refresh jobs',
        'List external collection refresh jobs.',
      ],
      [
        '/jobs/external_collection/describe',
        'Describe refresh job',
        'Inspect refresh progress using the unquoted integer job ID returned at submission.',
      ],
    ],
  },
  {
    title: 'Collection snapshots',
    slug: 'snapshots',
    prefix: '/snapshots/',
    operations: [
      [
        '/snapshots/create',
        'Create snapshot',
        'Capture a snapshot of a collection for later restoration.',
      ],
      [
        '/snapshots/list',
        'List snapshots',
        'List the snapshots associated with a collection.',
      ],
      [
        '/snapshots/describe',
        'Describe snapshot',
        'Read metadata for a specific collection snapshot.',
      ],
      [
        '/snapshots/restore',
        'Restore snapshot',
        'Start a restore from a named collection snapshot into a target collection.',
      ],
      [
        '/snapshots/pin',
        'Pin snapshot data',
        'Pin snapshot data against reclamation and obtain a pin ID.',
      ],
      [
        '/snapshots/unpin',
        'Unpin snapshot data',
        'Release a previously acquired snapshot pin using its ID.',
      ],
      [
        '/snapshots/drop',
        'Drop snapshot',
        'Delete a named collection snapshot.',
      ],
    ],
  },
  {
    title: 'Snapshot jobs',
    slug: 'snapshot-jobs',
    prefix: '/jobs/snapshot/',
    operations: [
      [
        '/jobs/snapshot/list',
        'List restore jobs',
        'List snapshot restore jobs, optionally filtering by collection.',
      ],
      [
        '/jobs/snapshot/describe',
        'Describe restore job',
        'Read the state of a snapshot restore job.',
      ],
      [
        '/jobs/snapshot/export',
        'Export snapshot',
        'Start exporting a named snapshot to the target S3 location.',
      ],
      [
        '/jobs/snapshot/export/describe',
        'Describe export job',
        'Read the state of a snapshot export job.',
      ],
      [
        '/jobs/snapshot/restore_external',
        'Restore external snapshot',
        'Start a restore using snapshot metadata in external storage.',
      ],
    ],
  },
  {
    title: 'Users',
    slug: 'users',
    prefix: '/users/',
    operations: [
      ['/users/list', 'List users', 'List users in the Milvus instance.'],
      [
        '/users/create',
        'Create user',
        'Create a Milvus user with a password. Replace the example value before submitting.',
      ],
      [
        '/users/describe',
        'Describe user',
        'Read information about a user and their role memberships.',
      ],
      [
        '/users/update_password',
        'Update user',
        'Update a user password or description. For a password change supply the current and new passwords.',
      ],
      ['/users/grant_role', 'Assign role', 'Assign a role to a user.'],
      [
        '/users/revoke_role',
        'Revoke role',
        'Remove a role assignment from a user.',
      ],
      ['/users/drop', 'Drop user', 'Remove a user account from the instance.'],
    ],
  },
  {
    title: 'Roles & grants',
    slug: 'roles',
    prefix: '/roles/',
    operations: [
      ['/roles/list', 'List roles', 'List roles in the Milvus instance.'],
      [
        '/roles/create',
        'Create role',
        'Create a role for grouping privileges.',
      ],
      [
        '/roles/describe',
        'Describe role',
        'Inspect a role and the privileges granted to it.',
      ],
      ['/roles/alter', 'Alter role', 'Update the description of a role.'],
      [
        '/roles/grant_privilege_v2',
        'Grant privilege',
        'Grant a privilege or privilege group to a role at the specified scope.',
      ],
      [
        '/roles/revoke_privilege_v2',
        'Revoke privilege',
        'Revoke a privilege or privilege group from a role at the specified scope.',
      ],
      [
        '/roles/grant_privilege',
        'Grant on object (legacy)',
        'Grant a privilege using an object type and object name.',
      ],
      [
        '/roles/revoke_privilege',
        'Revoke on object (legacy)',
        'Revoke a privilege using an object type and object name.',
      ],
      ['/roles/drop', 'Drop role', 'Remove a role from the instance.'],
    ],
  },
  {
    title: 'Privilege groups',
    slug: 'privilege-groups',
    prefix: '/privilege_groups/',
    operations: [
      [
        '/privilege_groups/list',
        'List privilege groups',
        'List privilege groups and their privileges.',
      ],
      [
        '/privilege_groups/create',
        'Create privilege group',
        'Create a custom group of privileges.',
      ],
      [
        '/privilege_groups/add_privileges_to_group',
        'Add privileges',
        'Add one or more privileges to a custom privilege group.',
      ],
      [
        '/privilege_groups/remove_privileges_from_group',
        'Remove privileges',
        'Remove the specified privileges from a custom privilege group.',
      ],
      [
        '/privilege_groups/drop',
        'Drop privilege group',
        'Delete a custom privilege group.',
      ],
    ],
  },
  {
    title: 'Resource groups',
    slug: 'resource-groups',
    prefix: '/resource_groups/',
    operations: [
      [
        '/resource_groups/list',
        'List resource groups',
        'List query-node resource groups.',
      ],
      [
        '/resource_groups/create',
        'Create resource group',
        'Create a resource group with an optional query-node allocation configuration.',
      ],
      [
        '/resource_groups/describe',
        'Describe resource group',
        'Inspect the configuration and capacity of a resource group.',
      ],
      [
        '/resource_groups/alter',
        'Update resource groups',
        'Change the requested node counts and limits for one or more resource groups.',
      ],
      [
        '/resource_groups/transfer_replica',
        'Transfer replicas',
        'Move collection replicas between resource groups.',
      ],
      [
        '/resource_groups/drop',
        'Drop resource group',
        'Remove a resource group.',
      ],
    ],
  },
  {
    title: 'Text analysis & files',
    slug: 'text-analysis',
    prefix: '/',
    operations: [
      [
        '/common/run_analyzer',
        'Run text analyzer',
        'Tokenize text using an analyzer configuration or an analyzer-enabled collection field.',
      ],
      [
        '/file_resources/add',
        'Register file resource',
        'Register a server-accessible file for use by text analyzers.',
      ],
      [
        '/file_resources/list',
        'List file resources',
        'List registered analyzer file resources.',
      ],
      [
        '/file_resources/remove',
        'Remove file resource',
        'Unregister a named file resource.',
      ],
    ],
  },
  {
    title: 'Diagnostics',
    slug: 'diagnostics',
    prefix: '/',
    operations: [
      [
        '/segments/describe',
        'Describe segments',
        'Inspect segment information for a collection ID or specific segment IDs.',
      ],
      [
        '/quotacenter/describe',
        'Describe quota metrics',
        'Read quota metrics from the Milvus quota center.',
      ],
    ],
  },
];

export const restOperations: RestOperation[] = groups.flatMap((group) =>
  group.operations.map(([route, title, description]) => {
    const schema =
      bindings.schemas[bindings.routes[route] as keyof typeof bindings.schemas];
    const request = exampleRequest(route, schema.required, schema.properties);
    const fields = Object.entries(schema.properties)
      .filter(([name]) => fieldNotes(route, name) !== undefined)
      .map(([name, type]) => ({
        name,
        type,
        required:
          (schema.required as string[]).includes(name) ||
          (name === 'data' &&
            ['/entities/insert', '/entities/upsert'].includes(route)),
        description: fieldNotes(route, name)!,
      }));
    return {
      slug:
        group.slug + '/' + route.slice(group.prefix.length).replace(/_/g, '-'),
      group: group.title,
      title,
      path: '/v2/vectordb' + route,
      description,
      fields,
      request,
      response: exampleResponse(route),
    };
  })
);

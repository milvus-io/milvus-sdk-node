import {
  HttpClient,
  HttpError,
  DEFAULT_METRIC_TYPE,
  DEFAULT_VECTOR_FIELD,
  HttpClientConfig,
  MilvusClient,
  DEFAULT_DB,
} from '../../milvus';
import {
  genCollectionParams,
  generateInsertData,
  dynamicFields,
  GENERATE_NAME,
} from '../tools';

export function generateTests(
  config: HttpClientConfig & { address?: string; cloud?: boolean; desc: string }
) {
  describe(config.desc, () => {
    if (!config.cloud) {
      let milvusClient = new MilvusClient({ address: config.address! });

      beforeAll(async () => {
        await milvusClient.createDatabase({ db_name: config.database! });
      });

      afterAll(async () => {
        await milvusClient.dropDatabase({ db_name: config.database! });
      });
    }

    // Mock configuration object
    const createParams = {
      dimension: 4,
      dbName: config.database,
      collectionName: 'my_collection',
      metricType: 'L2',
      primaryFieldName: 'id',
      vectorFieldName: 'vector',
      consistencyLevel: 'Strong',
    };

    const createDefaultParams = {
      dbName: config.database,
      collectionName: 'default_collection_name',
      dimension: 128,
    };

    const createAliasParams = {
      dbName: config.database,
      collectionName: createParams.collectionName,
      aliasName: 'my_alias',
    };

    const createUserParams = {
      userName: `${config.database ?? DEFAULT_DB}_user`,
      password: 'user1234',
    };

    const databaseParams = {
      dbName: `test_http_database_${config.database}`,
    };

    const roleParams = {
      roleName: `${config.database ?? DEFAULT_DB}_readOnly`,
      objectType: 'Collection',
      objectName: '*',
      privilege: 'Search',
    };

    const createCustomSetupParams = {
      collectionName: 'custom_setup_indexed',
      schema: {
        autoId: false,
        enabledDynamicField: false,
        fields: [
          {
            fieldName: 'my_id',
            dataType: 'Int64',
            isPrimary: true,
          },
          {
            fieldName: 'my_vector',
            dataType: 'FloatVector',
            elementTypeParams: {
              dim: 5,
            },
          },
        ],
      },
    };

    const createIndexParams = {
      metricType: 'L2',
      fieldName: 'my_vector',
      indexName: 'my_vector',
      params: {
        index_type: 'IVF_FLAT',
        nlist: 128,
      },
    };

    const addCollectionFieldParams = {
      collectionName: createParams.collectionName,
      schema: {
        fieldName: 'new_field',
        dataType: 'VarChar',
        nullable: true,
        defaultValue: 'default_value',
        elementTypeParams: {
          max_length: 255,
        },
      },
    };

    const alterCollectionPropertiesParams = {
      collectionName: createParams.collectionName,
      properties: {
        'collection.ttl.seconds': 3600,
      },
    };

    const alterCollectionFieldPropertiesParams = {
      collectionName: createParams.collectionName,
      fieldName: 'new_field',
      fieldParams: {
        max_length: 100,
      },
    };

    const dropCollectionPropertiesParams = {
      collectionName: createParams.collectionName,
      propertyKeys: ['collection.ttl.seconds'],
    };

    const alterDatabasePropertiesParams = {
      dbName: config.database ?? DEFAULT_DB,
      properties: {
        'database.replica.number': 1,
      },
    };

    const dropDatabasePropertiesParams = {
      dbName: config.database ?? DEFAULT_DB,
      propertyKeys: ['database.replica.number'],
    };

    const alterIndexPropertiesParams = {
      collectionName: createParams.collectionName,
      indexName: createParams.vectorFieldName,
      properties: {
        'mmap.enabled': true,
      },
    };

    const dropIndexPropertiesParams = {
      collectionName: createParams.collectionName,
      indexName: createParams.vectorFieldName,
      propertyKeys: ['mmap.enabled'],
    };

    const importFile = '/d1782fa1-6b65-4ff3-b05a-43a436342445/1.json';

    const count = 100;
    const data = generateInsertData(
      [
        ...genCollectionParams({
          collectionName: createParams.collectionName,
          dim: [createParams.dimension],
          enableDynamic: true,
        }).fields,
        ...dynamicFields,
      ],
      count
    ).map((item, index) => ({ ...item, id: index + 1 }));

    // Create an instance of HttpBaseClient with the mock configuration
    const client = new HttpClient(config);

    it('should throw 404 error when endpoint path is incorrect', async () => {
      const invalidClient = new HttpClient({
        baseURL: `${config.endpoint}/v1/nonexistent`,
        database: config.database,
      });

      try {
        await invalidClient.listCollections({ dbName: config.database });
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.status).toBe(404);
        expect(error.statusText).toBeDefined();
        expect(error.url).toBeDefined();
        expect(error.message).toContain('HTTP');
        expect(error.message).toContain('404');
        expect(error.message).toContain(error.url);
      }
    });

    it('should throw error with proper structure when endpoint is invalid', async () => {
      const invalidClient = new HttpClient({
        endpoint: 'http://127.0.0.1:59999',
        database: config.database,
      });

      try {
        await invalidClient.listCollections({ dbName: config.database });
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message || error.toString()).toBeDefined();
        if (error.status !== undefined) {
          expect(error.status).toBeGreaterThanOrEqual(400);
          expect(error.statusText).toBeDefined();
          expect(error.url).toBeDefined();
          expect(error.message).toContain('HTTP');
          expect(error.message).toContain(error.status.toString());
        }
      }
    });

    it('should create collection successfully', async () => {
      const create = await client.createCollection(createParams);

      expect(create.code).toEqual(0);
    });

    it('should create collection with only dimension successfully', async () => {
      const createDefault = await client.createCollection(createDefaultParams);

      expect(createDefault.code).toEqual(0);
    });

    it('should alter database properties successfully', async () => {
      const alter = await client.alterDatabaseProperties(
        alterDatabasePropertiesParams
      );

      expect(alter.code).toEqual(0);
    });

    it('should drop database properties successfully', async () => {
      const drop = await client.dropDatabaseProperties(
        dropDatabasePropertiesParams
      );

      expect(drop.code).toEqual(0);
    });

    it('should create database successfully', async () => {
      const create = await client.createDatabase(databaseParams);
      expect(create.code).toEqual(0);
    });

    it('should list databases successfully', async () => {
      const list = await client.listDatabases();
      expect(list.code).toEqual(0);
      expect(list.data.includes(databaseParams.dbName)).toEqual(true);
    });

    it('should describe database successfully', async () => {
      const describe = await client.describeDatabase(databaseParams);
      expect(describe.code).toEqual(0);
      expect(describe.data.dbName).toEqual(databaseParams.dbName);
    });

    it('should drop database successfully', async () => {
      const drop = await client.dropDatabase(databaseParams);
      expect(drop.code).toEqual(0);
    });

    it('should describe collection successfully', async () => {
      const describe = await client.describeCollection({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });

      expect(describe.code).toEqual(0);
      expect(describe.data.collectionName).toEqual(createParams.collectionName);
      expect(describe.data.shardsNum).toEqual(1);
      expect(describe.data.enableDynamicField).toEqual(true);
      expect(describe.data.fields.length).toEqual(2);
      expect(describe.data.indexes[0].fieldName).toEqual(
        createParams.vectorFieldName
      );
      expect(describe.data.indexes[0].metricType).toEqual(
        createParams.metricType
      );
    });

    it('should add collection field successfully', async () => {
      const addField = await client.addCollectionField(
        addCollectionFieldParams
      );

      expect(addField.code).toEqual(0);

      const describe = await client.describeCollection({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });

      expect(describe.code).toEqual(0);
      expect(describe.data.fields.length).toEqual(3);
    });

    it('should alter collection properties successfully', async () => {
      const alter = await client.alterCollectionProperties(
        alterCollectionPropertiesParams
      );

      expect([0, 104]).toContain(alter.code);
    });

    it('should alter collection field properties successfully', async () => {
      const alter = await client.alterCollectionFieldProperties(
        alterCollectionFieldPropertiesParams
      );

      expect(alter.code).toEqual(0);
    });

    it('should drop collection properties successfully', async () => {
      const drop = await client.dropCollectionProperties(
        dropCollectionPropertiesParams
      );

      expect(drop.code).toEqual(0);
    });

    it('should compact collection successfully', async () => {
      const compact = await client.compactCollection({
        collectionName: createParams.collectionName,
      });

      expect(compact.code).toEqual(0);
      expect(compact.data.compactionID).toBeDefined();

      const state = await client.getCompactionState({
        collectionName: createParams.collectionName,
        compactionID: compact.data.compactionID,
      });

      expect(state.code).toEqual(0);
      expect(state.data.state).toBeDefined();
    });

    it('should refresh load successfully', async () => {
      const refresh = await client.refreshLoad({
        collectionName: createParams.collectionName,
      });

      console.log(refresh);

      expect(refresh.code).toEqual(0);
    });

    it('should describe default collection successfully', async () => {
      const describe = await client.describeCollection({
        dbName: createDefaultParams.dbName,
        collectionName: createDefaultParams.collectionName,
      });

      expect(describe.code).toEqual(0);
      expect(describe.data.collectionName).toEqual(
        createDefaultParams.collectionName
      );
      expect(describe.data.shardsNum).toEqual(1);
      expect(describe.data.enableDynamicField).toEqual(true);
      expect(describe.data.fields.length).toEqual(2);
      expect(describe.data.indexes[0].fieldName).toEqual(DEFAULT_VECTOR_FIELD);
      expect(describe.data.indexes[0].metricType).toEqual(DEFAULT_METRIC_TYPE);
    });

    it('should list collections successfully', async () => {
      const list = await client.listCollections({ dbName: config.database });
      expect(list.code).toEqual(0);
      expect(list.data.indexOf(createParams.collectionName) !== -1).toEqual(
        true
      );
    });

    it('should insert data successfully', async () => {
      const insert = await client.insert({
        collectionName: createParams.collectionName,
        data: data,
      });

      expect(insert.code).toEqual(0);
      expect(insert.data.insertCount).toEqual(count);
    });

    it('should upsert data successfully', async () => {
      let target: any;
      let times = 0;

      // if data is undefined, query again
      while (!target) {
        const { data } = await client.query({
          collectionName: createParams.collectionName,
          filter: 'id > 0',
          limit: 1,
          outputFields: ['*'],
          consistencyLevel: 'Strong',
        });
        target = data[0];

        times++;
      }

      const upsert = await client.upsert({
        collectionName: createParams.collectionName,
        data: [{ ...target, int64: 0 }],
      });

      expect(upsert.code).toEqual(0);
      expect(upsert.data.upsertCount).toEqual(1);
      expect(upsert.data.upsertIds).toEqual([target.id]);
    });

    it('should flush collection successfully', async () => {
      const flush = await client.flushCollection({
        collectionName: createParams.collectionName,
      });

      expect(flush.code).toEqual(0);
    });

    it('should hybrid search data successfully', async () => {
      const search = await client.hybridSearch({
        collectionName: createParams.collectionName,
        outputFields: ['*'],
        rerank: {
          strategy: 'rrf',
          params: {
            k: 5,
          },
        },
        search: [
          {
            data: [[1, 2, 3, 4]],
            outputFields: ['*'],
            limit: 5,
          },
        ],
      });

      expect(search.code).toEqual(0);
      expect(search.data.length).toEqual(5);
      expect(typeof search.data[0].distance).toEqual('number');
    });

    it('should query data and get data and delete successfully', async () => {
      const query = await client.query({
        collectionName: createParams.collectionName,
        outputFields: ['id'],
        filter: 'id > 0',
      });

      expect(query.code).toEqual(0);
      expect(query.data.length).toEqual(data.length);

      const ids = query.data.map(d => d.id);

      const get = await client.get({
        collectionName: createParams.collectionName,
        id: ids,
        outputFields: ['id', 'vector'],
      });
      expect(get.code).toEqual(0);
      expect(get.data.length).toEqual(ids.length);

      const del = await client.delete({
        collectionName: createParams.collectionName,
        filter: `id in [${ids.join(',')}]`,
      });
      expect(del.code).toEqual(0);
    });

    it('should search data successfully', async () => {
      const search = await client.search({
        collectionName: createParams.collectionName,
        outputFields: ['*'],
        data: [[1, 2, 3, 4]],
        limit: 5,
      });

      expect(search.code).toEqual(0);
      // Check if data is an array and not empty before accessing elements
      expect(Array.isArray(search.data)).toBe(true);
      expect(search.data.length).toBeGreaterThanOrEqual(1);

      // Check if the first element is NOT an array (single query result expected)
      if (!Array.isArray(search.data[0])) {
        expect(search.data.length).toEqual(5); // Assuming limit applies to the single query
        expect(typeof search.data[0].distance).toEqual('number');
      } else {
        // This case might indicate an unexpected response structure for a single vector search
        // Or the API always returns 2D array even for single vector search
        // Adjust assertion based on actual API behavior if needed
        // For now, let's assume the test expects a 1D array here
        throw new Error(
          'Expected search.data to be a one-dimensional array for single vector search'
        );
      }
    });

    it('should search data successfully if nq > 1', async () => {
      const search = await client.search({
        collectionName: createParams.collectionName,
        outputFields: ['*'],
        data: [
          [1, 2, 3, 4],
          [1, 2, 3, 4],
        ],
        limit: 5,
      });

      expect(search.code).toEqual(0);
      // Check if data is an array and not empty
      expect(Array.isArray(search.data)).toBe(true);
      expect(search.data.length).toEqual(2); // Expecting results for 2 queries

      // Check if the first element IS an array (multi-query result expected)
      if (Array.isArray(search.data[0])) {
        // Check if the inner array is not empty before accessing its elements
        expect(search.data[0].length).toBeGreaterThanOrEqual(1);
        expect(typeof search.data[0][0].distance).toEqual('number');
      } else {
        // This case would be unexpected for a multi-vector search
        throw new Error(
          'Expected search.data to be a two-dimensional array for multi-vector search'
        );
      }
    });

    it('should hasCollection successfully', async () => {
      const has = await client.hasCollection({
        dbName: config.database ?? DEFAULT_DB,
        collectionName: createParams.collectionName,
      });

      expect(has.code).toEqual(0);
      expect(has.data.has).toEqual(true);
    });

    it('should rename collection successfully', async () => {
      const newCollectionName = GENERATE_NAME();
      const rename = await client.renameCollection({
        dbName: config.database,
        collectionName: createParams.collectionName,
        newCollectionName,
      });

      const describe = await client.describeCollection({
        dbName: config.database,
        collectionName: newCollectionName,
      });

      expect(rename.code).toEqual(0);
      expect(describe.code).toEqual(0);
      expect(describe.data.collectionName).toEqual(newCollectionName);

      await client.renameCollection({
        dbName: config.database,
        collectionName: newCollectionName,
        newCollectionName: createParams.collectionName,
      });
    });

    it('should release collection successfully', async () => {
      const release = await client.releaseCollection({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });

      expect(release.code).toEqual(0);
    });

    it('should load collection successfully', async () => {
      const load = await client.loadCollection({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });

      expect(load.code).toEqual(0);
    });

    it('should getCollectionStatistics successfully', async () => {
      const statistics = await client.getCollectionStatistics({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });

      expect(statistics.code).toEqual(0);
      expect(statistics.data.rowCount).toEqual(101);
    });

    it('should getCollectionLoadState successfully', async () => {
      const state = await client.getCollectionLoadState({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });

      expect(state.code).toEqual(0);
      expect(state.data.loadState).toMatch('LoadState');
      expect(state.data.loadProgress).toBeLessThanOrEqual(100);
    });

    /* test index operations */
    it('should list indexes successfully', async () => {
      const list = await client.listIndexes({
        dbName: config.database,
        collectionName: createParams.collectionName,
      });
      expect(list.code).toEqual(0);
      expect(list.data.length).toEqual(1);
      expect(list.data[0]).toEqual(createParams.vectorFieldName);
    });

    it('should alter index properties successfully', async () => {
      const alter = await client.alterIndexProperties(
        alterIndexPropertiesParams
      );

      expect([0, 104]).toContain(alter.code);
    });

    it('should drop index properties successfully', async () => {
      const drop = await client.dropIndexProperties(dropIndexPropertiesParams);

      expect([0, 104]).toContain(drop.code);
    });

    it('should create and describe index successfully', async () => {
      await client.createCollection(createCustomSetupParams);
      const create = await client.createIndex({
        indexParams: [createIndexParams],
        collectionName: createCustomSetupParams.collectionName,
      });
      const describe = await client.describeIndex({
        collectionName: createCustomSetupParams.collectionName,
        indexName: createIndexParams.indexName,
      });
      expect(create.code).toEqual(0);
      expect(describe.code).toEqual(0);
      expect(describe.data[0].indexName).toEqual(createIndexParams.indexName);
      expect(describe.data[0].indexType).toEqual(
        createIndexParams.params.index_type
      );
    });

    it('should drop index successfully', async () => {
      const { collectionName } = createCustomSetupParams;
      await client.releaseCollection({ collectionName });
      const drop = await client.dropIndex({
        dbName: config.database,
        collectionName,
        indexName: createIndexParams.indexName,
      });
      await client.dropCollection({ collectionName });
      expect(drop.code).toEqual(0);
    });

    /* test alias operations */
    it('should create alias successfully', async () => {
      const create = await client.createAlias(createAliasParams);
      expect(create.code).toEqual(0);
    });

    it('should describe alias successfully', async () => {
      /**
       * https://github.com/milvus-io/milvus/issues/31978
       * TODO: Alias describe api has issue, temporarily commented out.
       */
      // const describe = await client.describeAlias({
      //   dbName: config.database ?? DEFAULT_DB,
      //   aliasName: createAliasParams.aliasName,
      // });
      // expect(describe.code).toEqual(0);
      // expect(describe.data.aliasName).toEqual(createAliasParams.aliasName);
      // expect(describe.data.collectionName).toEqual(
      //   createAliasParams.collectionName
      // );
    });

    it('should list aliases successfully', async () => {
      const list = await client.listAliases({
        dbName: config.database ?? DEFAULT_DB,
      });
      expect(list.code).toEqual(0);
      expect(list.data.length).toBeGreaterThanOrEqual(1);
      expect(list.data[0]).toEqual(createAliasParams.aliasName);
    });

    it('should alter alias successfully', async () => {
      const newCollectionName = GENERATE_NAME();
      await client.createCollection({
        ...createParams,
        collectionName: newCollectionName,
      });
      const alter = await client.alterAlias({
        dbName: config.database ?? DEFAULT_DB,
        collectionName: newCollectionName,
        aliasName: createAliasParams.aliasName,
      });
      await client.dropCollection({ collectionName: newCollectionName });
      expect(alter.code).toEqual(0);
    });

    it('should drop alias successfully', async () => {
      const list = await client.listAliases({
        dbName: config.database ?? DEFAULT_DB,
      });
      if (list.data.includes(createAliasParams.aliasName)) {
        const drop = await client.dropAlias({
          dbName: config.database ?? DEFAULT_DB,
          aliasName: createAliasParams.aliasName,
        });
        expect(drop.code).toEqual(0);
      }
    });

    /* test partition operations */
    it('should list partitions successfully', async () => {
      const list = await client.listPartitions({
        collectionName: createParams.collectionName,
      });
      expect(list.code).toEqual(0);
      expect(list.data.length).toEqual(1);
      expect(list.data[0]).toEqual('_default');
    });

    it('should create partition successfully', async () => {
      const create = await client.createPartition({
        collectionName: createParams.collectionName,
        partitionName: 'my_partition',
      });
      expect(create.code).toEqual(0);
    });

    it('should load partitions successfully', async () => {
      const load = await client.loadPartitions({
        collectionName: createParams.collectionName,
        partitionNames: ['my_partition'],
      });
      expect(load.code).toEqual(0);
    });

    it('should release partitions successfully', async () => {
      const release = await client.releasePartitions({
        collectionName: createParams.collectionName,
        partitionNames: ['my_partition'],
      });
      expect(release.code).toEqual(0);
    });

    it('should has partition successfully', async () => {
      const has = await client.hasPartition({
        collectionName: createParams.collectionName,
        partitionName: 'my_partition',
      });
      expect(has.code).toEqual(0);
      expect(has.data.has).toEqual(true);
    });

    it('should get partitions statistics successfully', async () => {
      const statistics = await client.getPartitionStatistics({
        collectionName: createParams.collectionName,
        partitionName: 'my_partition',
      });
      expect(statistics.code).toEqual(0);
      expect(statistics.data.rowCount).toEqual(0);
    });

    it('should drop partition successfully', async () => {
      const drop = await client.dropPartition({
        collectionName: createParams.collectionName,
        partitionName: 'my_partition',
      });
      expect(drop.code).toEqual(0);
    });

    /* test import operations */
    it('should import jobs successfully', async () => {
      const create = await client.createImportJobs({
        collectionName: createParams.collectionName,
        files: [[importFile]],
      });
      const jobId = create.data.jobId;
      const list = await client.listImportJobs({
        collectionName: createParams.collectionName,
      });
      const job = list.data.records.find(j => j.jobId === jobId);
      const progress = await client.getImportJobProgress({ jobId });
      expect(create.code).toEqual(0);
      expect(list.code).toEqual(0);
      if (job) {
        expect(job.collectionName).toEqual(createParams.collectionName);
        expect(job.progress).toBeLessThanOrEqual(100);
      }
      expect(progress.code).toEqual(0);
      expect(progress.data.jobId).toEqual(jobId);
    });

    it('should drop collection successfully', async () => {
      const drop = await client.dropCollection({
        collectionName: createParams.collectionName,
      });

      expect(drop.code).toEqual(0);

      const dropDefault = await client.dropCollection({
        collectionName: createDefaultParams.collectionName,
      });
      expect(dropDefault.code).toEqual(0);
    });

    /* test role operations */
    it('should list roles successfully', async () => {
      const list = await client.listRoles();
      expect(list.code).toEqual(0);
      expect(list.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should describe role successfully', async () => {
      const describe = await client.describeRole({ roleName: 'public' });
      expect(describe.code).toEqual(0);
    });

    it('should create role successfully', async () => {
      const create = await client.createRole({
        roleName: roleParams.roleName,
      });
      expect(create.code).toEqual(0);
    });

    it('should drop role successfully', async () => {
      const drop = await client.dropRole({ roleName: roleParams.roleName });
      expect(drop.code).toEqual(0);
    });

    /* test user operations */
    it('should create user successfully', async () => {
      const create = await client.createUser(createUserParams);
      expect(create.code).toEqual(0);
    });

    it('should list users successfully', async () => {
      const list = await client.listUsers();
      expect(list.code).toEqual(0);
      expect(list.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should describe user successfully', async () => {
      const describe = await client.describeUser({
        userName: createUserParams.userName,
      });
      expect(describe.code).toEqual(0);
    });

    it('should update user password successfully', async () => {
      const newPassword = 'test_new_password';
      const update = await client.updateUserPassword({
        userName: createUserParams.userName,
        password: createUserParams.password,
        newPassword,
      });
      expect(update.code).toEqual(0);
    });

    it('should grant role to user successfully', async () => {
      const grant = await client.grantRoleToUser({
        userName: createUserParams.userName,
        roleName: 'public',
      });
      expect(grant.code).toEqual(0);
    });

    it('should revoke role from user successfully', async () => {
      const revoke = await client.revokeRoleFromUser({
        userName: createUserParams.userName,
        roleName: 'public',
      });
      expect(revoke.code).toEqual(0);
    });

    it('should drop user successfully', async () => {
      const drop = await client.dropUser({
        userName: createUserParams.userName,
      });
      expect(drop.code).toEqual(0);
    });
  });
}

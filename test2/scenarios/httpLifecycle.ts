import { randomBytes } from 'crypto';
import { HttpClient, HttpClientConfig, LoadState } from '../../milvus';
import { expectHttpSuccess } from '../support/assertions';
import { step } from '../support/scenario';
import { waitFor } from '../support/wait';

/** One HTTP lifecycle is reusable for local native/node-fetch and optional cloud services. */
export async function httpLifecycle(config: HttpClientConfig) {
  const client = new HttpClient({ ...config, acceptInt64: false });
  const collectionName = `http_${randomBytes(8).toString('hex')}`;
  const rows = [
    { id: '9007199254740993', vector: [1, 0, 0, 0], label: 'apple' },
    { id: '9007199254740994', vector: [0, 1, 0, 0], label: 'orange' },
  ];
  let failed = false;
  try {
    await step('HTTP create, index and load', async () => {
      expectHttpSuccess(
        await client.createCollection({
          collectionName,
          schema: {
            autoID: false,
            enabledDynamicField: false,
            fields: [
              { fieldName: 'id', dataType: 'Int64', isPrimary: true },
              {
                fieldName: 'vector',
                dataType: 'FloatVector',
                elementTypeParams: { dim: 4 },
              },
              {
                fieldName: 'label',
                dataType: 'VarChar',
                elementTypeParams: { max_length: 64 },
              },
            ],
          },
          params: { consistencyLevel: 'Strong' },
        })
      );
      expectHttpSuccess(
        await client.createIndex({
          collectionName,
          indexParams: [
            {
              fieldName: 'vector',
              indexName: 'vector',
              metricType: 'L2',
              params: { index_type: 'AUTOINDEX' },
            },
          ],
        })
      );
      expectHttpSuccess(await client.loadCollection({ collectionName }));
      await waitFor(
        'HTTP collection loaded',
        async () => {
          const result = await client.getCollectionLoadState({
            collectionName,
          });
          expectHttpSuccess(result);
          return result.data.loadState;
        },
        value => value === LoadState.LoadStateLoaded
      );
    });
    const query = async () => {
      const result = await client.query({
        collectionName,
        filter: 'id > 0',
        outputFields: ['id', 'vector', 'label'],
        consistencyLevel: 'Strong',
      });
      expectHttpSuccess(result);
      return result.data;
    };
    await step('HTTP insert, read and search', async () => {
      expectHttpSuccess(await client.insert({ collectionName, data: rows }));
      const actual = await query();
      expect(actual).toHaveLength(2);
      for (const row of rows)
        expect(actual.find(value => String(value.id) === row.id)).toEqual(row);
      const search = await client.search({
        collectionName,
        data: [rows[0].vector],
        filter: 'label == "apple"',
        outputFields: ['id', 'label'],
        limit: 1,
      });
      expectHttpSuccess(search);
      expect(search.data).toEqual([
        expect.objectContaining({ id: rows[0].id, label: 'apple' }),
      ]);
    });
    await step('HTTP upsert and delete', async () => {
      expectHttpSuccess(
        await client.upsert({
          collectionName,
          data: [{ ...rows[0], label: 'updated' }],
        })
      );
      expect(
        (await query()).find(row => String(row.id) === rows[0].id)?.label
      ).toBe('updated');
      expectHttpSuccess(
        await client.delete({ collectionName, filter: `id == ${rows[0].id}` })
      );
      expect((await query()).map(row => String(row.id))).toEqual([rows[1].id]);
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      const has = await client.hasCollection({
        collectionName,
        dbName: client.database,
      });
      expectHttpSuccess(has);
      if (has.data.has)
        expectHttpSuccess(await client.dropCollection({ collectionName }));
    } catch (error) {
      if (!failed) throw error;
      console.error('HTTP cleanup also failed:', error);
    }
  }
}

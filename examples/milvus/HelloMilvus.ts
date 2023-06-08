import { MilvusClient, DataType, InsertReq } from '@zilliz/milvus2-sdk-node';

const milvusClient = new MilvusClient('localhost:19530');

const generateInsertData = function generateInsertData(
  fields: { isVector: boolean; dim?: number; name: string; isBool?: boolean }[],
  count: number
) {
  const results: any = [];
  while (count > 0) {
    let value: any = {};

    fields.forEach(v => {
      const { isVector, dim, name, isBool } = v;
      value[name] = isVector
        ? [...Array(dim)].map(() => Math.random() * 10)
        : isBool
        ? count % 2 === 0
        : count;
    });

    value['count'] = count;
    results.push(value);
    count--;
  }
  return results;
};

const hello_milvus = async () => {
  const checkVersion = await milvusClient.getVersion();
  console.log('--- check version ---', checkVersion);
  const collectionName = 'hello_milvus';
  const dim = '4';
  const createRes = await milvusClient.createCollection({
    collection_name: collectionName,
    fields: [
      {
        name: 'count',
        data_type: DataType.VarChar,
        is_primary_key: true,
        type_params: {
          max_length: '100',
        },
        description: '',
      },
      {
        name: 'random_value',
        data_type: DataType.Double,
        description: '',
      },
      {
        name: 'float_vector',
        data_type: DataType.FloatVector,
        description: '',
        type_params: {
          dim,
        },
      },
    ],
  });
  console.log('--- Create collection ---', createRes, collectionName);

  const showCollectionRes = await milvusClient.showCollections();
  console.log('--- Show collections ---', showCollectionRes);

  const hasCollectionRes = await milvusClient.hasCollection({
    collection_name: collectionName,
  });
  console.log(
    '--- Has collection (' + collectionName + ') ---',
    hasCollectionRes
  );

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: 'float_vector',
    },
    {
      isVector: false,
      name: 'random_value',
    },
  ];
  const vectorsData = generateInsertData(fields, 100);

  const params: InsertReq = {
    collection_name: collectionName,
    fields_data: vectorsData,
  };
  await milvusClient.insert(params);
  console.log('--- Insert Data to Collection ---');

  await milvusClient.createIndex({
    collection_name: collectionName,
    field_name: 'float_vector',
    extra_params: {
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: JSON.stringify({ nlist: 10 }),
    },
  });
  console.log('--- Create Index in Collection ---');

  // need load collection before search
  const loadCollectionRes = await milvusClient.loadCollectionSync({
    collection_name: collectionName,
  });
  console.log(
    '--- Load collection (' + collectionName + ') ---',
    loadCollectionRes
  );

  const result = await milvusClient.search({
    collection_name: collectionName,
    vectors: [vectorsData[0]['float_vector']],
    search_params: {
      anns_field: 'float_vector',
      topk: '4',
      metric_type: 'L2',
      params: JSON.stringify({ nprobe: 1024 }),
      round_decimal: 4,
    },
    output_fields: ['count'],
    vector_type: DataType.FloatVector,
  });
  console.log('--- Search collection (' + collectionName + ') ---', result);

  const releaseRes = await milvusClient.releaseCollection({
    collection_name: collectionName,
  });
  console.log('--- Release Collection ---', releaseRes);

  const dropRes = await milvusClient.dropCollection({
    collection_name: collectionName,
  });
  console.log('--- Drop Collection ---', dropRes);
};

hello_milvus();

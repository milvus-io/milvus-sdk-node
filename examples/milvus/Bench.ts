// import {
//   MilvusClient,
//   InsertReq,
//   DataType,
//   FieldType,
//   convertToDataType,
// } from '@zilliz/milvus2-sdk-node';

import {
  MilvusClient,
  InsertReq,
  DataType,
  FieldType,
  convertToDataType,
} from '../../milvus';

const COLLECTION_NAME = 'bench_milvus';
const generateString = (index: number, random: boolean = false): string => {
  if (!random) {
    return Math.random().toString(36).substring(2, 7);
  } else {
    const fixedStrings = ['apple', 'banana', 'orange'];
    return fixedStrings[
      index > fixedStrings.length
        ? Math.floor(Math.random() * fixedStrings.length)
        : index
    ];
  }
};

const generateInsertData = (fields: FieldType[], count: number = 10) => {
  const results: any = []; // Initialize an empty array to store the generated data
  while (count > 0) {
    // Loop until we've generated the desired number of data points
    let value: any = {}; // Initialize an empty object to store the generated values for this data point

    fields.forEach(f => {
      // bypass autoID
      if (f.autoID) {
        return;
      }
      // convert to data type
      const data_type = convertToDataType(f.data_type);
      // Loop through each field we need to generate data for
      const { name } = f; // Destructure the field object to get its properties
      const isVector =
        data_type === DataType.BinaryVector ||
        data_type === DataType.FloatVector;
      let dim = f.dim || (f.type_params && f.type_params.dim);
      const isBool = data_type === DataType.Bool;
      const isVarChar = data_type === DataType.VarChar;
      const isJson = data_type === DataType.JSON;

      dim = f.data_type === DataType.BinaryVector ? (dim as number) / 8 : dim;
      value[name] = isVector // If the field is a vector field
        ? [...Array(Number(dim))].map(() => Math.random()) // Generate an array of random numbers between 0 and 10 with length equal to the vector dimension
        : isBool // If the field is a boolean field
        ? count % 2 === 0 // Generate a random boolean value based on the current count
        : isJson // If the field is a boolean field
        ? Math.random() > 0.4
          ? {
              string: Math.random().toString(36).substring(2, 7),
              float: 1 + Math.random(),
              number: Math.floor(Math.random() * 100000),
            }
          : {} // Generate a random boolean value based on the current count
        : isVarChar // If the field is a varchar field
        ? generateString(count, f.is_partition_key) // Generate a random string of characters
        : Math.floor(Math.random() * 100000); // Otherwise, generate a random integer between 0 and 100000
    });
    results.push(value); // Add the generated values for this data point to the results array
    count--; // Decrement the count to keep track of how many data points we've generated so far
  }
  return results; // Return the array of generated data
};

(async () => {
  // build client
  const milvusClient = new MilvusClient({
    address: 'localhost',
    username: 'username',
    password: 'Aa12345!!',
  });

  console.log('Node client is initialized.');
  const fields = [
    {
      name: 'age',
      description: 'ID field',
      data_type: DataType.Int64,
      is_primary_key: true,
      autoID: true,
    },
    {
      name: 'vector',
      description: 'Vector field',
      data_type: DataType.FloatVector,
      dim: 8,
    },
    { name: 'height', description: 'int64 field', data_type: DataType.Int64 },
    {
      name: 'name',
      description: 'VarChar field',
      data_type: DataType.VarChar,
      max_length: 128,
    },
  ];
  // create collection
  const create = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields,
  });
  console.log('Create collection is finished.', create);

  // build example data
  const vectorsData = generateInsertData(fields, 10000);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);
  console.log('Data is inserted.');

  // create index
  const createIndex = await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: 'vector',
    metric_type: 'L2',
  });

  console.log('Index is created', createIndex);

  // need load collection before search
  const load = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('Collection is loaded.', load);

  // do the search
  for (let i = 0; i < 100; i++) {
    console.time('Search time');
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME,
      vector: vectorsData[i]['vector'],
      output_fields: ['age', 'height', 'name'],
      limit: 5,
    });
    console.timeEnd('Search time');
    console.log('\n');

    // console.log('Search result', search);
  }

  // drop collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();

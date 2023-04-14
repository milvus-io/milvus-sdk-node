import { MilvusClient, DataType, InsertReq } from '@zilliz/milvus2-sdk-node';
import { IP } from '../const';
import { generateInsertData, GENERATE_NAME, genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';
const milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const ALIAS_NAME = GENERATE_NAME();

const Search = async () => {
  // create collection
  let res: any = await milvusClient.createCollection(
    genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
  );

  const fields = [
    {
      isVector: true,
      dim: 4,
      name: VECTOR_FIELD_NAME,
    },
    {
      isVector: false,
      name: 'age',
    },
  ];
  // build example data
  const vectorsData = generateInsertData(fields, 100);
  const params: InsertReq = {
    collection_name: COLLECTION_NAME,
    fields_data: vectorsData,
  };
  // insert data into collection
  await milvusClient.insert(params);

  // await milvusClient.deleteEntities({
  //   collection_name: COLLECTION_NAME,
  //   expr: `age in [${vectorsData[0].age}]`,
  // });

  // create index
  await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: VECTOR_FIELD_NAME,
    extra_params: {
      index_type: 'IVF_FLAT',
      metric_type: 'L2',
      params: JSON.stringify({ nlist: 10 }),
    },
  });

  // need load collection before search
  res = await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });
  console.log('--- load done ----', res);

  // do the search
  const result = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // expr: "rich == true",
    vectors: [vectorsData[0][VECTOR_FIELD_NAME]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: '4',
      metric_type: 'L2',
      params: JSON.stringify({ nprobe: 1024 }),
      round_decimal: 4,
    },
    output_fields: ['age'],
    vector_type: DataType.FloatVector,
  });
  console.log('----search result----', result);

  // create collection alias
  await milvusClient.createAlias({
    collection_name: COLLECTION_NAME,
    alias: ALIAS_NAME,
  });

  // search with alias
  const aliasResult = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    // partition_names: [],
    // expr: "rich == true",
    vectors: [vectorsData[0][VECTOR_FIELD_NAME]],
    search_params: {
      anns_field: VECTOR_FIELD_NAME,
      topk: '4',
      metric_type: 'L2',
      params: JSON.stringify({ nprobe: 1024 }),
      round_decimal: 4,
    },
    output_fields: ['age'],
    vector_type: DataType.FloatVector,
  });
  console.log('---- alias search result----', aliasResult);

  // delete collection
  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
};

Search();

// When created collection, all bool value will store as false.
// After Milvus has more test about bool,we can test this.
// const BoolExprSearch = async () => {
//   let res: any = await milvusClient.createCollection({
//     collection_name: COLLECTION_NAME,
//     fields: [
//       {
//         name: VECTOR_FIELD_NAME,
//         description: "vector field",
//         data_type: DataType.FloatVector,

//         type_params: {
//           dim: "4",
//         },
//       },
//       {
//         name: "age",
//         data_type: DataType.Int64,
//         autoID: true,
//         is_primary_key: true,
//         description: "",
//       },
//       {
//         name: "rich",
//         data_type: DataType.Bool,
//         autoID: false,
//         is_primary_key: false,
//         description: "",
//       },
//     ],
//   });

//   const fields = [
//     {
//       isVector: true,
//       dim: 4,
//       name: VECTOR_FIELD_NAME,
//     },
//     {
//       name: "rich",
//       isVector: false,
//       isBool: true,
//     },
//   ];
//   const vectorsData = generateInsertData(fields, 100);
//   console.log("--- insert data ---", vectorsData[0]);
//   const params: InsertReq = {
//     collection_name: COLLECTION_NAME,
//     fields_data: vectorsData,
//   };
//   res = await milvusClient.insert(params);
//   console.log("--- insert ---", res);

//   res = await milvusClient.flushSync({
//     collection_names: [COLLECTION_NAME],
//   });

//   console.log("--- flush ---", res);

//   // need load collection before search
//   res = await milvusClient.loadCollectionSync({
//     collection_name: COLLECTION_NAME,
//   });
//   console.log("--- load ---", res);
//   res = await milvusClient.flushSync({
//     collection_names: [COLLECTION_NAME],
//   });
//   console.log("--- flush ---", res);

//   res = await milvusClient.search({
//     collection_name: COLLECTION_NAME,
//     // partition_names: [],
//     // expr: "rich == true",
//     vectors: [vectorsData[0][VECTOR_FIELD_NAME]],
//     search_params: {
//       anns_field: VECTOR_FIELD_NAME,
//       topk: "4",
//       metric_type: "L2",
//       params: JSON.stringify({ nprobe: 1024 }),
//       round_decimal: 1,
//     },
//     output_fields: ["age", "rich"],
//     vector_type: DataType.FloatVector,
//   });
//   console.log("---- search result ----", res);
//   await milvusClient.dropCollection({
//     collection_name: COLLECTION_NAME,
//   });
// };

// BoolExprSearch();

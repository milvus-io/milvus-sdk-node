import { MilvusNode } from "../milvus/index";
import { GENERATE_NAME, IP } from "../const";
import { DataType } from "../milvus/types/Common";
const milvusClient = new MilvusNode(IP);
const COLLECTION_NAME = GENERATE_NAME();

const test = async () => {
  const createRes = await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: "vector_01",
        description: "vector field",
        data_type: DataType.FloatVector,

        type_params: [
          {
            key: "dim",
            value: "128",
          },
          {
            key: "metric_type",
            value: "L2",
          },
        ],
      },
    ],
  });
  console.log("--- create collection ---", createRes, COLLECTION_NAME);

  let res: any = await milvusClient.showCollections();
  console.log(res);

  res = await milvusClient.hasCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await milvusClient.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await milvusClient.loadCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await milvusClient.describeCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);
  console.log(res.schema.fields);

  res = await milvusClient.releaseCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log(res);

  res = await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
  console.log("delete---", res);
};

test();

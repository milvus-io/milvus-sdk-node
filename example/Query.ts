import { MilvusClient } from "../milvus/index";
import { IP } from "../const";
const milvusClient = new MilvusClient(IP);

// when test_1 collection includes some data.
const query = async () => {
  const res = await milvusClient.dataManager.query({
    collection_name: "test_1",
    expr: "id > 427621230836979095 and id < 427621230836979298",
    output_fields: ["id", "vector"],
  });
  console.log(res);
};

query();

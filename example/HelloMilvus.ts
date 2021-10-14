import { MilvusClient } from "@zilliz/milvus2-sdk-node"
import { DataType } from "@zilliz/milvus2-sdk-node/dist/milvus/types/Common";
import { InsertReq } from "@zilliz/milvus2-sdk-node/dist/milvus/types/Insert";

const milvusClient = new MilvusClient("localhost:19530");
const collectionManager = milvusClient.collectionManager;

console.log("Milvus SDK Version: ", MilvusClient.getSdkVersion());

const generateInsertData = function generateInsertData(
  fields: { isVector: boolean; dim?: number; name: string; isBool?: boolean }[],
  count: number) {
    const results = [];
    while (count > 0) {
      let value: any = {};
  
      fields.forEach((v) => {
        const { isVector, dim, name, isBool } = v;
        value[name] = isVector
          ? [...Array(dim)].map(() => Math.random() * 10)
          : isBool
          ? count % 2 === 0
          : count;
      });

      value["count"] = count;
      results.push(value);
      count--;
    }
    return results;
}

const hello_milvus = async () => {
    const collectionName = "hello_milvus";
    const dim = "4";
    const createRes = await collectionManager.createCollection(
        {
            collection_name: collectionName,
            fields: [
                {
                    name: "count",
                    data_type: DataType.Int64,
                    is_primary_key: true,
                    description: "",
                }, 
                {
                    name: "random_value",
                    data_type: DataType.Double,
                    description: "",
                }, 
                {
                    name: "float_vector",
                    data_type: DataType.FloatVector,
                    description: "",
                    type_params: {
                      dim
                    }
                }
            ]
          }
    );


    console.log("--- Create collection ---", createRes, collectionName);

    
    let showCollectionRes  = await collectionManager.showCollections();
    console.log("--- Show collections ---", showCollectionRes);

    
    let hasCollectionRes = await collectionManager.hasCollection({
      collection_name: collectionName,
    });
    console.log("--- Has collection (" + collectionName + ") ---", hasCollectionRes);


    await milvusClient.partitionManager.createPartition({
      collection_name: collectionName,
      partition_name: "test",
    });

    console.log("--- Create Partition in Collection ---", collectionName, "test");

  
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: "float_vector",
      },
      {
        isVector: false,
        name: "random_value",
      },
    ];
    const vectorsData = generateInsertData(fields, 1000);
  
    const params: InsertReq = {
      collection_name: collectionName,
      fields_data: vectorsData,
      partition_name: "test",
    };
  
    await milvusClient.dataManager.insert(params);
    console.log("--- Insert Data to Collection ---");


    const queryRes = await milvusClient.dataManager.query({
      collection_name: collectionName,
      expr: "count < 10",
      output_fields: ["count", "random_value", "float_vector"]
    });
    console.log("--- Query Collection ---", queryRes);

    const releaseRes = await collectionManager.releaseCollection({
      collection_name: collectionName,
    });
    console.log("--- Release Collection ---", releaseRes);
  
    const dropRes = await collectionManager.dropCollection({
      collection_name: collectionName,
    });
    console.log("--- Drop Collection ---", dropRes);
}

hello_milvus();

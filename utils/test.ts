import { ConsistencyLevelEnum } from "../milvus/types";
import { DataType } from "../milvus/types/Common";

export const VECTOR_FIELD_NAME = "vector_field";
export const genCollectionParams = (
  collectionName: string,
  dim: string,
  vectorType:
    | DataType.FloatVector
    | DataType.BinaryVector = DataType.FloatVector,
  autoID: boolean = true
) => {
  return {
    collection_name: collectionName,
    fields: [
      {
        name: VECTOR_FIELD_NAME,
        description: "vector field",
        data_type: vectorType,

        type_params: {
          dim,
        },
      },
      {
        name: "age",
        data_type: DataType.Int64,
        autoID,
        is_primary_key: true,
        description: "",
      },
    ],
  };
};

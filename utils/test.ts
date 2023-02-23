import { DataType } from '../milvus/const/Milvus';

export const VECTOR_FIELD_NAME = 'vector_field';
export const INDEX_NAME = 'index_name';
export const genCollectionParams = (
  collectionName: string,
  dim: string,
  vectorType:
    | DataType.FloatVector
    | DataType.BinaryVector = DataType.FloatVector,
  autoID: boolean = true,
  fields?: any[]
) => {
  fields = fields || [];
  return {
    collection_name: collectionName,
    fields: [
      {
        name: VECTOR_FIELD_NAME,
        description: 'vector field',
        data_type: vectorType,

        type_params: {
          dim,
        },
      },
      {
        name: 'age',
        data_type: DataType.Int64,
        autoID,
        is_primary_key: true,
        description: '',
      },
      ...fields,
    ],
  };
};

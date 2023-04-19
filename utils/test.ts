import { DataType } from '../milvus/const/Milvus';

export const VECTOR_FIELD_NAME = 'vector_field';
export const INDEX_NAME = 'index_name';
export const genCollectionParams = (
  collectionName: string,
  dim: string | number,
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

export const GENERATE_NAME = (pre = 'collection') =>
  `${pre}_${Math.random().toString(36).substr(2, 8)}`;

export function generateInsertData(
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
        : Math.floor(Math.random() * 100000);
    });
    results.push(value);
    count--;
  }
  return results;
}

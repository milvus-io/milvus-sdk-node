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
        dim: 16,
      },
      {
        name: 'age',
        description: '',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID,
      },
      {
        name: 'name',
        description: '',
        data_type: DataType.VarChar,
        max_length: 128,
      },
      ...fields,
    ],
  };
};

export const GENERATE_NAME = (pre = 'collection') =>
  `${pre}_${Math.random().toString(36).substr(2, 8)}`;

/**
 * Generates random data for inserting into a collection
 * @param fields An array of objects describing the fields to generate data for
 * @param count The number of data points to generate
 * @returns An array of objects representing the generated data
 */
export function generateInsertData(
  fields: {
    isVector: boolean;
    dim?: number;
    name: string;
    isBool?: boolean;
    isVarChar?: boolean;
  }[],
  count: number
) {
  const results: any = []; // Initialize an empty array to store the generated data
  while (count > 0) {
    // Loop until we've generated the desired number of data points
    let value: any = {}; // Initialize an empty object to store the generated values for this data point

    fields.forEach(v => {
      // Loop through each field we need to generate data for
      const { isVector, dim, name, isBool, isVarChar } = v; // Destructure the field object to get its properties
      value[name] = isVector // If the field is a vector field
        ? [...Array(dim)].map(() => Math.random() * 10) // Generate an array of random numbers between 0 and 10 with length equal to the vector dimension
        : isBool // If the field is a boolean field
        ? count % 2 === 0 // Generate a random boolean value based on the current count
        : isVarChar // If the field is a varchar field
        ? Math.random().toString(36).substring(2, 15) // Generate a random string of characters
        : Math.floor(Math.random() * 100000); // Otherwise, generate a random integer between 0 and 100000
    });
    results.push(value); // Add the generated values for this data point to the results array
    count--; // Decrement the count to keep track of how many data points we've generated so far
  }
  return results; // Return the array of generated data
}

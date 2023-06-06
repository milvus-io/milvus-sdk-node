import { KeyValuePair, DataType } from '../';

/**
 * Promisify a function call with optional timeout
 * @param obj - The object containing the target function
 * @param target - The name of the target function to call
 * @param params - The parameters to pass to the target function
 * @param timeout - Optional timeout in milliseconds
 * @returns A Promise that resolves with the result of the target function call
 */
export function promisify(
  obj: any,
  target: string,
  params: any,
  timeout: number
): Promise<any> {
  // Calculate the deadline for the function call
  const deadline = new Date(Date.now() + timeout);

  // Create a new Promise that wraps the target function call
  const res = new Promise((resolve, reject) => {
    try {
      // Call the target function with the provided parameters and deadline
      obj[target](params, { deadline }, (err: any, result: any) => {
        if (err) {
          // If there was an error, reject the Promise with the error
          reject(err);
        }
        // Otherwise, resolve the Promise with the result
        resolve(result);
      });
    } catch (e: any) {
      // If there was an exception, throw a new Error
      throw new Error(e);
    }
  }).catch(err => {
    // Return a rejected Promise with the error
    return Promise.reject(err);
  });

  // Return the Promise
  return res;
}

export const findKeyValue = (obj: KeyValuePair[], key: string) =>
  obj.find(v => v.key === key)?.value;

export const sleep = (time: number) => {
  return new Promise(resolve => setTimeout(resolve, time));
};

// build default schema
export const buildDefaultSchema = (data: {
  dimension: number;
  primary_field_name: string;
  id_type: DataType.Int64 | DataType.VarChar;
  vector_field_name: string;
  auto_id: boolean;
}) => {
  return [
    {
      name: data.primary_field_name,
      data_type: data.id_type,
      is_primary_key: true,
      autoID: data.auto_id,
    },
    {
      name: data.vector_field_name,
      data_type: DataType.FloatVector,
      dim: data.dimension,
    },
  ];
};

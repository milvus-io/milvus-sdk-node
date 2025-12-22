import { DataType } from '@zilliz/milvus2-sdk-node';
import { getMilvusClient } from './milvus-client';

async function getCollectionSchema(collectionName: string) {
  const milvusClient = getMilvusClient();
  const result = await milvusClient.describeCollection({
    collection_name: collectionName,
  });
  return result.schema;
}

export async function insertData(collectionName: string, count: number = 1) {
  if (!collectionName || collectionName.trim() === '') {
    throw new Error('Collection name is required');
  }

  if (count < 1) {
    throw new Error('Count must be at least 1');
  }

  const milvusClient = getMilvusClient();

  // Get collection schema to determine vector type and dimension
  const schema = await getCollectionSchema(collectionName);
  const vectorField = schema.fields.find(
    (field) =>
      field.data_type === 'FloatVector' ||
      field.data_type === 'BinaryVector' ||
      field.dataType === DataType.FloatVector ||
      field.dataType === DataType.BinaryVector
  );

  if (!vectorField) {
    throw new Error('No vector field found in collection schema');
  }

  const isBinaryVector =
    vectorField.data_type === 'BinaryVector' ||
    vectorField.dataType === DataType.BinaryVector;

  // Get dimension from type_params or direct property
  let dimension = 128; // default
  if (vectorField.dim) {
    dimension = Number(vectorField.dim);
  } else if (vectorField.type_params && Array.isArray(vectorField.type_params)) {
    const dimParam = vectorField.type_params.find(
      (p: any) => p.key === 'dim' || p.key === 'dimension'
    );
    if (dimParam) {
      dimension = Number(dimParam.value);
    }
  } else if ((vectorField as any).dimension) {
    dimension = Number((vectorField as any).dimension);
  }

  if (dimension <= 0 || !Number.isFinite(dimension)) {
    throw new Error(`Invalid dimension: ${dimension}`);
  }

  // Generate data based on vector type
  const data = Array.from({ length: count }, () => {
    if (isBinaryVector) {
      // For binary vector, generate Uint8Array with length = dimension / 8
      const byteLength = Math.ceil(dimension / 8);
      const binaryVector = new Uint8Array(byteLength);
      for (let i = 0; i < byteLength; i++) {
        binaryVector[i] = Math.floor(Math.random() * 256);
      }
      return { vector: Array.from(binaryVector) };
    } else {
      // For float vector, generate array of floats
      return {
        vector: Array.from({ length: dimension }, () => Math.random()),
      };
    }
  });

  const result = await milvusClient.insert({
    collection_name: collectionName,
    fields_data: data,
  });

  return result;
}


import {
  ERROR_REASONS,
  DataType,
  RowData,
  _Field,
  JSON,
  FieldData,
  bytesToSparseRow,
  Float16Vector,
  BFloat16Vector,
  InsertTransformers,
  OutputTransformers,
  f32ArrayToBf16Bytes,
  f32ArrayToF16Bytes,
  bf16BytesToF32Array,
  f16BytesToF32Array,
  cloneObj,
  Struct,
} from '../';

/**
 * Builds a dynamic row object by separating the input data into non-dynamic fields and a dynamic field.
 *
 * @param {RowData} rowData - The input data object.
 * @param {Map<string, Field>} fieldMap - A map of field names to field objects.
 * @param {string} dynamicFieldName - The name of the dynamic field.
 * @returns {RowData} The generated dynamic row object.
 */
export const buildDynamicRow = (
  rowData: RowData,
  fieldMap: Map<string, _Field>,
  dynamicFieldName: string,
  functionOutputFields: string[]
) => {
  const originRow = cloneObj(rowData);

  const row: RowData = {};

  // iterate through each key in the input data object
  for (let key in originRow) {
    row[dynamicFieldName] = row[dynamicFieldName] || ({} as JSON); // initialize the dynamic field object

    if (fieldMap.has(key)) {
      // if the key is in the fieldMap, add it to the non-dynamic fields
      row[key] = originRow[key];
    } else {
      if (!functionOutputFields.includes(key)) {
        const obj: JSON = row[dynamicFieldName] as JSON;
        // otherwise, add it to the dynamic field
        obj[key] = originRow[key];
      }
    }
  }

  return row; // return the generated dynamic row object
};

/**
 * Processes vector data from gRPC response format
 * @param item - The vector field item from gRPC response
 * @param transformers - Optional transformers for data conversion
 * @returns Processed vector data
 */
export const processVectorData = (
  item: any,
  transformers?: OutputTransformers
): any => {
  const dataKey = item.vectors!.data;
  let field_data: any;

  switch (dataKey) {
    case 'float_vector':
    case 'binary_vector':
      const vectorValue =
        dataKey === 'float_vector'
          ? item.vectors![dataKey]!.data
          : item.vectors![dataKey]!.toJSON().data;

      // if binary vector , need use dim / 8 to split vector data
      const dim =
        item.vectors?.data === 'float_vector'
          ? Number(item.vectors!.dim)
          : Number(item.vectors!.dim) / 8;
      field_data = [];

      // parse number[] to number[][] by dim
      vectorValue.forEach((v: any, i: number) => {
        const index = Math.floor(i / dim);
        if (!field_data[index]) {
          field_data[index] = [];
        }
        field_data[index].push(v);
      });
      break;

    case 'int8_vector':
      field_data = [];
      const int8Dim = Number(item.vectors!.dim);
      const int8Bytes = item.vectors![dataKey]!;

      const localTransformers = {
        [DataType.Int8Vector]: Array.from,
        ...transformers,
      };

      // split buffer data to int8 vector
      for (let i = 0; i < int8Bytes.byteLength; i += int8Dim) {
        const slice = int8Bytes.slice(i, i + int8Dim);

        field_data.push(localTransformers[DataType.Int8Vector](slice));
      }

      break;

    case 'float16_vector':
    case 'bfloat16_vector':
      field_data = [];
      const f16Dim = Number(item.vectors!.dim) * 2; // float16 is 2 bytes, so we need to multiply dim with 2 = one element length
      const f16Bytes = item.vectors![dataKey]!;

      // split buffer data to float16 vector(bytes)
      for (let i = 0; i < f16Bytes.byteLength; i += f16Dim) {
        const slice = f16Bytes.slice(i, i + f16Dim);
        const isFloat16 = dataKey === 'float16_vector';
        let dataType: DataType.BFloat16Vector | DataType.Float16Vector;

        dataType = isFloat16 ? DataType.Float16Vector : DataType.BFloat16Vector;

        const localTransformers = {
          [DataType.BFloat16Vector]: bf16BytesToF32Array,
          [DataType.Float16Vector]: f16BytesToF32Array,
          ...transformers,
        };

        field_data.push(localTransformers[dataType]!(slice));
      }
      break;
    case 'sparse_float_vector':
      const sparseVectorValue = item.vectors![dataKey]!.contents;
      field_data = [];

      sparseVectorValue.forEach((buffer: any, i: number) => {
        field_data[i] = bytesToSparseRow(buffer);
      });
      break;
    case 'vector_array':
      field_data = [];
      const vectorArrayValue = item.vectors![dataKey]!.data;
      vectorArrayValue.forEach((vector: any) => {
        field_data.push(
          processVectorData({
            vectors: {
              ...vector,
            },
          })
        );
      });
      break;
    default:
      break;
  }

  return field_data;
};

/**
 * Processes scalar data from gRPC response format
 * @param item - The scalar field item from gRPC response
 * @returns Processed scalar data
 */
export const processScalarData = (item: any): any => {
  // parse scalar data
  const dataKey = item.scalars!.data;
  let field_data = item.scalars![dataKey]!.data;

  // we need to handle array element specifically here
  if (dataKey === 'array_data') {
    field_data = field_data.map((f: any) => {
      const dataKey = f.data;
      return dataKey ? f[dataKey].data : [];
    });
  }

  switch (dataKey) {
    // decode json
    case 'json_data':
      field_data.forEach((buffer: any, i: number) => {
        field_data[i] = buffer.length ? JSON.parse(buffer.toString()) : null;
      });
      break;
    default:
      break;
  }

  // set the field data with null if item.valid_data is not empty array, it the item in valid_data is false, set the field data with null
  if (item.valid_data && item.valid_data.length) {
    item.valid_data.forEach((v: any, i: number) => {
      if (!v) {
        field_data[i] = null;
      }
    });
  }

  return field_data;
};

/**
 * Processes struct arrays data from gRPC response format
 * @param item - The struct arrays field item from gRPC response
 * @returns Processed struct arrays data as array of objects
 */
export const processStructArraysData = (item: any): any => {
  const structArrays = item.struct_arrays;
  const fields = structArrays.fields;

  // Process each field using the existing processScalarData function
  const processedFields = fields.map((field: any) => {
    return {
      fieldName: field.field_name,
      fieldData: field.scalars
        ? processScalarData(field)
        : processVectorData(field),
    };
  });

  // Get the number of rows from the first processed field
  const rowCount = processedFields[0].fieldData.length;

  // Initialize result array
  const result = [];

  // Process each row
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    // Get the length of arrays in this row (assuming all fields have same array length)
    const firstFieldArray = processedFields[0].fieldData[rowIndex];
    const arrayLength = firstFieldArray.length;

    // Create an array of struct objects for this row
    const rowArray = [];
    for (let arrayIndex = 0; arrayIndex < arrayLength; arrayIndex++) {
      const structObject: any = {};

      // Process each field in the struct
      processedFields.forEach(
        ({ fieldName, fieldData }: { fieldName: string; fieldData: any[] }) => {
          const fieldArray = fieldData[rowIndex];
          structObject[fieldName] = fieldArray[arrayIndex];
        }
      );

      rowArray.push(structObject);
    }

    result.push(rowArray);
  }

  // Apply valid_data filtering if present
  if (item.valid_data && item.valid_data.length) {
    item.valid_data.forEach((v: any, i: number) => {
      if (!v) {
        result[i] = null;
      }
    });
  }

  return result;
};

/**
 * create a data map for each fields, resolve grpc data format
 * If the field is a vector, split the data into chunks of the appropriate size.
 * If the field is a scalar, decode the JSON/array data if necessary.
 */
export const buildFieldDataMap = (
  fields_data: any[],
  transformers?: OutputTransformers
) => {
  const fieldsDataMap = new Map<string, RowData[]>();

  fields_data.forEach((item, i) => {
    // field data
    let field_data: any;

    // parse data based on field type
    if (item.vectors) {
      field_data = processVectorData(item, transformers);
    } else if (item.scalars) {
      field_data = processScalarData(item);
    } else if (item.struct_arrays) {
      field_data = processStructArraysData(item);
    }

    // Add the parsed data to the fieldsDataMap
    fieldsDataMap.set(item.field_name, field_data);
  });

  return fieldsDataMap;
};

/**
 * Builds the field data for a given row and column.
 *
 * @param {RowData} rowData - The data for the row.
 * @param {Field} column - The column information.
 * @returns {FieldData} The field data for the row and column.
 */
export const buildFieldData = (
  rowData: RowData,
  field: _Field,
  transformers?: InsertTransformers,
  rowIndex?: number
): FieldData => {
  const { type, elementType, name, fieldMap } = field;
  const isFloat32 = Array.isArray(rowData[name]);

  switch (type) {
    case DataType.BinaryVector:
    case DataType.FloatVector:
    case DataType.Int8Vector:
      return rowData[name];
    case DataType.BFloat16Vector:
      const bf16Transformer =
        transformers?.[DataType.BFloat16Vector] || f32ArrayToBf16Bytes;
      return isFloat32
        ? bf16Transformer(rowData[name] as BFloat16Vector)
        : rowData[name];
    case DataType.Float16Vector:
      const f16Transformer =
        transformers?.[DataType.Float16Vector] || f32ArrayToF16Bytes;
      return isFloat32
        ? f16Transformer(rowData[name] as Float16Vector)
        : rowData[name];
    case DataType.JSON:
      return rowData[name]
        ? Buffer.from(JSON.stringify(rowData[name] || {}))
        : Buffer.alloc(0);

    case DataType.Array:
      const elementField = { ...field, type: elementType!, fieldMap: fieldMap };

      // Special handling for struct types
      if (elementType == DataType.Struct) {
        // Process each struct element as if it were fields_data
        (rowData[name] as Struct[]).forEach((structElement, elementIndex) => {
          // get field names
          const fieldNames = Object.keys(structElement);

          // loop through each field name
          fieldNames.forEach(fieldName => {
            const structField = fieldMap.get(fieldName);

            if (!structField) {
              throw new Error(
                `${ERROR_REASONS.INSERT_CHECK_WRONG_FIELD} in struct at index ${elementIndex}`
              );
            }

            // Build field data for the struct field
            const fieldData = buildFieldData(
              { [fieldName]: structElement[fieldName] },
              structField,
              transformers,
              rowIndex
            );

            // Special handling for binary and float vector types
            const dataArray = structField.data[rowIndex!] || [];
            structField.data[rowIndex!] = dataArray;

            const isVectorType =
              structField.elementType === DataType.BinaryVector ||
              structField.elementType === DataType.FloatVector;

            if (isVectorType) {
              (dataArray as FieldData[]).push(
                ...(Array.isArray(fieldData) ? fieldData : [fieldData])
              );
            } else {
              (dataArray as FieldData[]).push(fieldData);
            }
          });
        });
        // Return the original data for Array of Struct
        return rowData[name];
      } else {
        // Regular array field
        return rowData[name] === null
          ? undefined
          : buildFieldData(rowData, elementField, transformers, rowIndex);
      }

    default:
      return rowData[name] === null ? undefined : rowData[name];
  }
};

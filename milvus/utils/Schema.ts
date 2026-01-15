import { Type } from 'protobufjs';
import {
  FieldType,
  TypeParamKey,
  TypeParam,
  cloneObj,
  DataType,
  DataTypeMap,
  parseToKeyValue,
  ERROR_REASONS,
  isVectorType,
  CreateCollectionReq,
  CreateCollectionWithSchemaReq,
  CreateCollectionWithFieldsReq,
  FunctionObject,
  FunctionType,
} from '../';

function convertToCamelCase(str: string) {
  return str.replace(/_(.)/g, function (match, letter) {
    return letter.toUpperCase();
  });
}

// build default schema
export const buildDefaultSchema = (data: {
  dimension: number;
  primary_field_name: string;
  id_type: DataType.Int64 | DataType.VarChar;
  vector_field_name: string;
  auto_id: boolean;
}): FieldType[] => {
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

export const getDataKey = (type: DataType, camelCase: boolean = false) => {
  let dataKey = '';
  switch (type) {
    case DataType.FloatVector:
      dataKey = 'float_vector';
      break;
    case DataType.Float16Vector:
      dataKey = 'float16_vector';
      break;
    case DataType.BFloat16Vector:
      dataKey = 'bfloat16_vector';
      break;
    case DataType.BinaryVector:
      dataKey = 'binary_vector';
      break;
    case DataType.SparseFloatVector:
      dataKey = 'sparse_float_vector';
      break;
    case DataType.Int8Vector:
      dataKey = 'int8_vector';
      break;
    case DataType.Double:
      dataKey = 'double_data';
      break;
    case DataType.Float:
      dataKey = 'float_data';
      break;
    case DataType.Int64:
      dataKey = 'long_data';
      break;
    case DataType.Int32:
    case DataType.Int16:
    case DataType.Int8:
      dataKey = 'int_data';
      break;
    case DataType.Bool:
      dataKey = 'bool_data';
      break;
    case DataType.VarChar:
      dataKey = 'string_data';
      break;
    case DataType.Array:
      dataKey = 'array_data';
      break;
    case DataType.JSON:
      dataKey = 'json_data';
      break;
    case DataType.Geometry:
      dataKey = 'geometry_wkt_data';
      break;
    case DataType.Timestamptz:
      dataKey = 'timestamptz_data';
      break;
    case 106 as DataType: // Internal: ArrayOfVector
      dataKey = 'vector_array';
      break;
    case DataType.None:
    case DataType.Struct:
      dataKey = 'none';
      break;

    default:
      throw new Error(
        `${ERROR_REASONS.INSERT_CHECK_WRONG_DATA_TYPE} "${type}."`
      );
  }
  return camelCase ? convertToCamelCase(dataKey) : dataKey;
};

/**
 * Assigns specified properties from the `field` object to `type_params` within the `FieldType` object.
 * Converts properties to strings, serializing objects as JSON strings if needed, then removes them from `field`.
 *
 * @param field - The `FieldType` object to modify.
 * @param typeParamKeys - Keys to assign to `type_params` if present in `field`.
 * @returns The modified `FieldType` object.
 */
export const assignTypeParams = (
  field: FieldType,
  typeParamKeys: TypeParamKey[] = [
    'dim',
    'max_length',
    'max_capacity',
    'enable_match',
    'enable_analyzer',
    'analyzer_params',
    'multi_analyzer_params',
    'mmap.enabled',
  ]
): FieldType => {
  const newField = cloneObj<FieldType>(field);

  // Initialize `type_params` if undefined
  newField.type_params ??= {} as Record<TypeParamKey, TypeParam>;

  typeParamKeys.forEach(key => {
    if (key in newField) {
      const value = newField[key as keyof FieldType];
      // Convert the value to a string, JSON-stringify if it's an object
      newField.type_params![key] =
        typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      delete newField[key as keyof FieldType];
    }
  });

  // delete type_params if it's empty
  if (!Object.keys(newField.type_params).length) {
    delete newField.type_params;
  }

  return newField;
};

/**
 * Converts a `key` of type `keyof typeof DataTypeMap | DataType` to a `DataType`.
 *
 * @param {keyof typeof DataTypeMap | DataType} key - The key to convert.
 * @returns {DataType} The converted `DataType`.
 */
export const convertToDataType = (
  key: keyof typeof DataTypeMap | DataType | number
): DataType => {
  if (typeof key === 'string' && key in DataTypeMap) {
    return DataType[key as keyof typeof DataTypeMap];
  } else if (typeof key === 'number' && Object.values(DataType).includes(key)) {
    return key as DataType;
  } else if (typeof key === 'number') {
    return key as DataType; // for internal data type like ArrayOfVector 106
  }
  throw new Error(ERROR_REASONS.FIELD_TYPE_IS_NOT_SUPPORT);
};

/**
 * Formats a field schema by converting its properties to the appropriate types and adding additional properties.
 *
 * @param {FieldType} field - The field to format.
 * @param {Record<string, Type>} schemaTypes - The schema types to use for formatting.
 * @param {Object} [override] - Optional override object for additional properties.
 * @returns {Object} The formatted field schema.
 */
export const formatFieldSchema = (
  field: FieldType,
  schemaTypes: Record<string, Type>,
  override?: {
    partition_key_field?: string;
    functionOutputFields?: string[];
    clustring_key_field?: string;
  }
): { [k: string]: any } => {
  const {
    partition_key_field,
    functionOutputFields = [],
    clustring_key_field,
  } = override || {};
  // Assign the typeParams property to the result of parseToKeyValue(type_params).
  const {
    type_params,
    data_type,
    element_type,
    is_function_output,
    is_partition_key,
    is_primary_key,
    ...rest
  } = assignTypeParams(field);
  const dataType = convertToDataType(field.data_type);
  const createObj: any = {
    ...rest,
    typeParams: parseToKeyValue(type_params),
    data_type, // compatibility with old version
    dataType,
    isPrimaryKey: !!is_primary_key,
    isPartitionKey: !!is_partition_key || field.name === partition_key_field,
    isFunctionOutput:
      !!is_function_output || functionOutputFields.includes(field.name),
    isClusteringKey:
      !!field.is_clustering_key || field.name === clustring_key_field,
  };

  // if element type exist and
  if (
    (dataType === DataType.Array || dataType === (106 as DataType)) &&
    typeof element_type !== 'undefined'
  ) {
    createObj.elementType = convertToDataType(element_type);
    createObj.element_type = element_type; // compatibility with old version
  }

  if (typeof field.default_value !== 'undefined') {
    const dataKey = getDataKey(createObj.dataType, true);

    // Convert TIMESTAMPTZ default value to UTC microseconds (int64)
    // Milvus stores TIMESTAMPTZ default values internally as int64 (UTC microsecond)
    // Users can pass either a string (RFC3339 format) or a number (microseconds)
    if (createObj.dataType === DataType.Timestamptz) {
      if (typeof field.default_value === 'string') {
        // Convert RFC3339 string to UTC microseconds
        const date = new Date(field.default_value);
        field.default_value = (date.getTime() * 1000).toString();
      } else if (typeof field.default_value === 'number') {
        // If already a number, assume it's microseconds (or milliseconds if < 1e12)
        // Convert to microseconds if it looks like milliseconds (< year 2286)
        const value =
          field.default_value < 1e12
            ? field.default_value * 1000
            : field.default_value;
        field.default_value = Math.floor(value).toString();
      }
    }

    createObj.defaultValue = {
      [dataKey]: field.default_value,
    };
  }
  return schemaTypes.fieldSchemaType.create(createObj);
};

/**
 * Formats a FunctionObject into a FunctionSchema payload for gRPC.
 * Returns a plain object with snake_case field names matching the proto definition
 * in milvus.ts (used by @grpc/proto-loader).
 *
 * @param {FunctionObject} func - The function object to format.
 * @returns {Object} The formatted function schema payload (plain object).
 */
export const formatFunctionSchema = (func: FunctionObject): { [k: string]: any } => {
  const { input_field_names, output_field_names, type, ...rest } = func;

  // Ensure type is a number (enum value), not a string
  const typeValue =
    typeof type === 'number'
      ? type
      : FunctionType[type as keyof typeof FunctionType] ?? type;

  // Return a plain object with snake_case field names for gRPC
  // The @grpc/proto-loader uses milvus.ts which has snake_case field names
  return {
    ...rest,
    type: typeValue,
    input_field_names: input_field_names || [],
    output_field_names: output_field_names || [],
    params: parseToKeyValue(func.params, true),
  };
};

/**
 * Formats a struct array field schema by converting its properties to the appropriate types and adding additional properties.
 *
 * @param {FieldType} field - The field to format.
 * @param {Record<string, Type>} schemaTypes - The schema types to use for formatting.
 * @returns {Object} The formatted struct array field schema.
 */
export const formatStructArrayFieldSchema = (
  field: FieldType,
  schemaTypes: Record<string, Type>
) => {
  return schemaTypes.structArrayFieldSchemaType.create({
    name: field.name,
    description: field.description,
    fields: field.fields!.map((f: FieldType) => {
      // convert the field to array field, and set the max capacity
      f.element_type = f.data_type;
      f.data_type = isVectorType(convertToDataType(f.data_type as DataType)!)
        ? (106 as DataType) // ArrayOfVector
        : DataType.Array;
      f.max_capacity = field.max_capacity;

      // format schema
      return formatFieldSchema(f, schemaTypes);
    }),
  });
};

/**
 * Formats the input data into a request payload for creating a collection.
 *
 * @param {CreateCollectionReq} data - The input data for creating a collection.
 * @param {Type} schemaType - The schema type for the collection.
 * @returns {Object} The formatted request payload.
 */
export const formatCollectionSchema = (
  data: CreateCollectionReq,
  schemaTypes: Record<string, Type>
): { [k: string]: any } => {
  const {
    collection_name,
    description,
    enable_dynamic_field,
    enableDynamicField,
    partition_key_field,
    functions,
    clustring_key_field,
  } = data;

  let fields = (data as CreateCollectionWithFieldsReq).fields;

  if ((data as CreateCollectionWithSchemaReq).schema) {
    fields = (data as CreateCollectionWithSchemaReq).schema;
  }

  let payload = {} as any;

  // extract function output fields
  const functionOutputFields: string[] = [];

  // if functions is set, parse its params to key-value pairs, and delete inputs and outputs
  if (functions) {
    payload.functions = functions.map((func: FunctionObject) => {
      const { input_field_names, output_field_names, ...rest } = func;

      functionOutputFields.push(...(output_field_names || []));

      return schemaTypes.functionSchemaType.create({
        ...rest,
        inputFieldNames: input_field_names || [],
        outputFieldNames: output_field_names || [],
        params: parseToKeyValue(func.params, true),
      });
    });
  }

  // extract struct array fields and others
  const [structArrayFields, fieldsWithoutStructArray] = fields.reduce<
    [FieldType[], FieldType[]]
  >(
    (acc, field) => {
      if (
        field.data_type === DataType.Array &&
        field.element_type === DataType.Struct
      ) {
        acc[0].push(field);
      } else {
        acc[1].push(field);
      }
      return acc;
    },
    [[], []]
  );

  // format the payload
  payload = {
    name: collection_name,
    description: description || '',
    enableDynamicField: !!enableDynamicField || !!enable_dynamic_field,
    fields: fieldsWithoutStructArray.map(field =>
      formatFieldSchema(field, schemaTypes, {
        partition_key_field,
        functionOutputFields,
        clustring_key_field,
      })
    ),
    structArrayFields: structArrayFields.map(field =>
      formatStructArrayFieldSchema(field, schemaTypes)
    ),
    ...payload,
  };

  return payload;
};

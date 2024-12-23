import { Type, Root } from 'protobufjs';
import {
  findKeyValue,
  ERROR_REASONS,
  KeyValuePair,
  FieldType,
  DataTypeMap,
  DataType,
  CreateCollectionReq,
  DescribeCollectionResponse,
  getDataKey,
  RowData,
  _Field,
  JSON,
  FieldData,
  CreateCollectionWithFieldsReq,
  CreateCollectionWithSchemaReq,
  SearchReq,
  SearchSimpleReq,
  VectorTypes,
  SearchParam,
  HybridSearchSingleReq,
  HybridSearchReq,
  DEFAULT_TOPK,
  DslType,
  SearchRes,
  DEFAULT_DYNAMIC_FIELD,
  ConsistencyLevelEnum,
  isVectorType,
  RANKER_TYPE,
  RerankerObj,
  bytesToSparseRow,
  buildPlaceholderGroupBytes,
  Float16Vector,
  BFloat16Vector,
  getSparseFloatVectorType,
  InsertTransformers,
  OutputTransformers,
  SparseVectorArray,
  f32ArrayToBf16Bytes,
  f32ArrayToF16Bytes,
  bf16BytesToF32Array,
  f16BytesToF32Array,
  SearchDataType,
  FieldSchema,
  SearchMultipleDataType,
  TypeParamKey,
  TypeParam,
  keyValueObj,
} from '../';
import { get } from 'http';

/**
 * Formats key-value data based on the provided keys.
 * @param {KeyValuePair[]} data - The array of key-value pairs.
 * @param {string[]} keys - The keys to include in the formatted result.
 * @returns {Object} - The formatted key-value data as an object.
 */
export const formatKeyValueData = (data: KeyValuePair[], keys: string[]) => {
  const result: { [x: string]: any } = {};
  keys.forEach(k => {
    const value = findKeyValue(data, k);
    result[k] = value;
  });

  return result;
};

/**
 * parse {row_count:4} to [{key:"row_count",value:"4"}]
 * @param data Object
 * @returns {KeyValuePair[]}
 */
export const parseToKeyValue = (
  data?: {
    [x: string]: any;
  },
  valueToString?: boolean
): KeyValuePair[] => {
  return data
    ? Object.keys(data).reduce(
        (pre: any[], cur: string) => [
          ...pre,
          { key: cur, value: valueToString ? String(data[cur]) : data[cur] },
        ],
        []
      )
    : [];
};

/**
 *
 * @param number Number like 3.1738998889923096
 * @param precision The precision you want, if is 3 will return 3.173 and If is 2 will return 3.17
 * @returns
 */
export const formatNumberPrecision = (number: number, precision: number) => {
  return Number(
    number
      .toString()
      .split('.')
      .map((v, i) => {
        if (i === 1) {
          return v.slice(0, precision);
        }
        return v;
      })
      .join('.')
  );
};

const LOGICAL_BITS = BigInt(18);
// const LOGICAL_BITS_MASK = (1 << LOGICAL_BITS) - 1;

/**
 * Checks if the given time parameter is valid.
 *
 * @param ts - The time parameter to be checked.
 * @returns A boolean value indicating whether the time parameter is valid or not.
 */
export const checkTimeParam = (ts: any) => {
  switch (typeof ts) {
    case 'bigint':
      return true;
    case 'string':
      return isNaN(Number(ts)) ? false : true;
    default:
      return false;
  }
};

/**
 * Converts a hybrid timestamp to Unix time.
 * @param hybridts - The hybrid timestamp to convert.
 * @returns The Unix time representation of the hybrid timestamp.
 * @throws An error if the hybridts parameter fails the time parameter check.
 */
export const hybridtsToUnixtime = (hybridts: bigint | string) => {
  if (!checkTimeParam(hybridts)) {
    throw new Error(`hybridts ${ERROR_REASONS.TIMESTAMP_PARAM_CHECK}`);
  }
  const timestamp = typeof hybridts === 'bigint' ? hybridts : BigInt(hybridts);
  const physical = timestamp >> LOGICAL_BITS;
  return (physical / BigInt(1000)).toString();
};

/**
 * Converts a Unix timestamp to a hybrid timestamp.
 * @param unixtime - The Unix timestamp to convert.
 * @returns The hybrid timestamp as a string.
 * @throws An error if the unixtime parameter fails the check.
 */
export const unixtimeToHybridts = (unixtime: bigint | string) => {
  if (!checkTimeParam(unixtime)) {
    throw new Error(`hybridts ${ERROR_REASONS.TIMESTAMP_PARAM_CHECK}`);
  }
  const timestamp = typeof unixtime === 'bigint' ? unixtime : BigInt(unixtime);

  const physical = (timestamp * BigInt(1000)) << LOGICAL_BITS;
  return physical.toString();
};

/**
 * Converts a JavaScript Date object to a hybridts timestamp.
 * @param datetime - The JavaScript Date object to be converted.
 * @returns The hybridts timestamp.
 * @throws An error if the input is not a valid Date object.
 */
export const datetimeToHybrids = (datetime: Date) => {
  if (!(datetime instanceof Date)) {
    throw new Error(`hybridts ${ERROR_REASONS.DATE_TYPE_CHECK}`);
  }
  return unixtimeToHybridts((datetime.getTime() / 1000).toString());
};

/**
 * Converts a string to base64 encoding.
 * @param str The string to convert.
 * @returns The base64 encoded string.
 */
export const stringToBase64 = (str: string) =>
  Buffer.from(str, 'utf-8').toString('base64');

/**
 * Formats the given address by removing the http or https prefix and appending the default Milvus port if necessary.
 * @param address The address to format.
 * @returns The formatted address.
 */
export const formatAddress = (address: string) => {
  // remove http or https prefix from address
  return address.replace(/(http|https)*:\/\//, '');
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
    'mmap.enabled',
  ]
): FieldType => {
  const newField = cloneObj<FieldType>(field);

  // Initialize `type_params` if undefined
  newField.type_params ??= {} as Record<TypeParamKey, TypeParam>;

  typeParamKeys.forEach(key => {
    if (key in newField) {
      const value = newField[key as keyof FieldType];
      // Convert the value to a string, JSON-stringify if it’s an object
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
 * Parses a time token and returns the corresponding number of milliseconds.
 *
 * @param {string} token - The time token to parse.
 * @returns {number} The number of milliseconds corresponding to the time token.
 * @throws {Error} If the time token is invalid.
 */
export const parseTimeToken = (token: string): number => {
  const num = parseInt(token.slice(0, -1));
  const unit = token.slice(-1);
  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    case 'w':
      return num * 7 * 24 * 60 * 60 * 1000;
    case 'M':
      return num * 30 * 24 * 60 * 60 * 1000;
    case 'Y':
      return num * 365 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time token: ${token}`);
  }
};

/**
 * Extracts the method name from a URL path.
 *
 * @param {string} query - The URL path to extract the method name from.
 * @returns {string} The extracted method name.
 */
export const extractMethodName = (query: string): string => {
  const parts = query.split('/');
  return parts[parts.length - 1];
};

/**
 * Converts a `key` of type `keyof typeof DataTypeMap | DataType` to a `DataType`.
 *
 * @param {keyof typeof DataTypeMap | DataType} key - The key to convert.
 * @returns {DataType} The converted `DataType`.
 */
export const convertToDataType = (
  key: keyof typeof DataTypeMap | DataType
): DataType => {
  if (typeof key === 'string' && key in DataTypeMap) {
    return DataType[key as keyof typeof DataTypeMap];
  } else if (typeof key === 'number' && Object.values(DataType).includes(key)) {
    return key as DataType;
  }
  throw new Error(ERROR_REASONS.FIELD_TYPE_IS_NOT_SUPPORT);
};

/**dd
 * Creates a deep copy of the provided object using JSON.parse and JSON.stringify.
 * Note that this function is not efficient and may cause performance issues if used with large or complex objects. It also does not handle cases where the object being cloned contains functions or prototype methods.
 *
 * @typeparam T The type of object being cloned.
 * @param {T} obj - The object to clone.
 * @returns {T} A new object with the same properties and values as the original.
 */
export const cloneObj = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
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

  const functionOutputFields: string[] = [];

  // if functions is set, parse its params to key-value pairs, and delete inputs and outputs
  if (functions) {
    payload.functions = functions.map((func: any) => {
      const { input_field_names, output_field_names, ...rest } = func;

      functionOutputFields.push(...output_field_names);

      return schemaTypes.functionSchemaType.create({
        ...rest,
        inputFieldNames: input_field_names,
        outputFieldNames: output_field_names,
        params: parseToKeyValue(func.params, true),
      });
    });
  }

  payload = {
    name: collection_name,
    description: description || '',
    enableDynamicField: !!enableDynamicField || !!enable_dynamic_field,
    fields: fields.map(field => {
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
        isPartitionKey:
          !!is_partition_key || field.name === partition_key_field,
        isFunctionOutput:
          !!is_function_output || functionOutputFields.includes(field.name),
        isClusteringKey:
          !!field.is_clustering_key || field.name === clustring_key_field,
      };

      // if element type exist and
      if (dataType === DataType.Array && typeof element_type !== 'undefined') {
        createObj.elementType = convertToDataType(element_type);
        createObj.element_type = element_type; // compatibility with old version
      }

      if (typeof field.default_value !== 'undefined') {
        const dataKey = getDataKey(createObj.dataType, true);

        createObj.defaultValue = {
          [dataKey]: field.default_value,
        };
      }
      return schemaTypes.fieldSchemaType.create(createObj);
    }),
    ...payload,
  };

  return payload;
};

/**
 * Formats a `DescribeCollectionResponse` object by adding a `dataType` property to each field object in its `schema` array.
 * The `dataType` property represents the numerical value of the `data_type` property.
 *
 * @param {DescribeCollectionResponse} data - The `DescribeCollectionResponse` object to format.
 * @returns {DescribeCollectionResponse} A new `DescribeCollectionResponse` object with the updated `dataType` properties.
 */
export const formatDescribedCol = (
  data: DescribeCollectionResponse
): DescribeCollectionResponse => {
  // clone object
  const newData = cloneObj<DescribeCollectionResponse>(data);
  // add a dataType property which indicate datatype number
  newData.schema?.fields?.forEach(f => {
    f.dataType = DataTypeMap[f.data_type];
    // if default_value is set, parse it to the correct format
    if (f.default_value) {
      const defaultValue = f.default_value as any;
      f.default_value = defaultValue[defaultValue.data];
    }
    // extract type params(key value pair = {key: 'xxx', value: any}), and assign it to the field object(key)
    if (f.type_params && f.type_params.length > 0) {
      f.type_params.forEach(keyValuePair => {
        f[keyValuePair.key] = keyValuePair.value;
      });
    }
  });

  return newData;
};

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

    // parse vector data
    if (item.field === 'vectors') {
      const dataKey = item.vectors!.data;

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

            dataType = isFloat16
              ? DataType.Float16Vector
              : DataType.BFloat16Vector;

            const localTransformers = transformers || {
              [DataType.BFloat16Vector]: bf16BytesToF32Array,
              [DataType.Float16Vector]: f16BytesToF32Array,
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
        default:
          break;
      }
    } else {
      // parse scalar data
      const dataKey = item.scalars!.data;
      field_data = item.scalars![dataKey]!.data;

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
            field_data[i] = buffer.length
              ? JSON.parse(buffer.toString())
              : null;
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
    }

    // Add the parsed data to the fieldsDataMap
    fieldsDataMap.set(item.field_name, field_data);
  });

  return fieldsDataMap;
};

/**
 * Generates an authentication string based on the provided credentials.
 *
 * @param {Object} data - An object containing the authentication credentials.
 * @param {string} [data.username] - The username to use for authentication.
 * @param {string} [data.password] - The password to use for authentication.
 * @param {string} [data.token] - The token to use for authentication.
 * @returns {string} The authentication string.
 */
export const getAuthString = (data: {
  username?: string;
  password?: string;
  token?: string;
}) => {
  const { username, password, token } = data;
  // build auth string
  const authString = token ? token : `${username}:${password}`;
  // Encode the username and password as a base64 string.
  let auth = Buffer.from(authString, 'utf-8').toString('base64');

  // if we need to create auth interceptors
  const needAuth = (!!username && !!password) || !!token;
  return needAuth ? auth : '';
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
  transformers?: InsertTransformers
): FieldData => {
  const { type, elementType, name } = field;
  const isFloat32 = Array.isArray(rowData[name]);

  switch (DataTypeMap[type]) {
    case DataType.BinaryVector:
    case DataType.FloatVector:
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
      const elementField = { ...field, type: elementType! };
      return rowData[name] === null
        ? undefined
        : buildFieldData(rowData, elementField, transformers);
    default:
      return rowData[name] === null ? undefined : rowData[name];
  }
};

/**
 * Builds search parameters based on the provided data.
 * @param data - The data object containing search parameters.
 * @returns The search parameters in key-value format.
 */
export const buildSearchParams = (
  data: SearchSimpleReq | (HybridSearchSingleReq & HybridSearchReq),
  anns_field: string
) => {
  // create search params
  const search_params: SearchParam = {
    anns_field: data.anns_field || anns_field,
    params: JSON.stringify(data.params ?? {}),
    topk: data.limit ?? data.topk ?? DEFAULT_TOPK,
    offset: data.offset ?? 0,
    metric_type: data.metric_type ?? '', // leave it empty
    ignore_growing: data.ignore_growing ?? false,
  };

  // if group_by_field is set, add it to the search params
  if (data.group_by_field) {
    search_params.group_by_field = data.group_by_field;
  }
  if (data.strict_group_size) {
    search_params.strict_group_size = data.strict_group_size;
  }
  if (data.group_size) {
    search_params.group_size = data.group_size;
  }
  if (data.hints) {
    search_params.hints = data.hints;
  }

  return search_params;
};

/**
 * Creates a RRFRanker object with the specified value of k.
 * @param k - The value of k used in the RRFRanker strategy.
 * @returns An object representing the RRFRanker strategy with the specified value of k.
 */
export const RRFRanker = (k: number = 60): RerankerObj => {
  return {
    strategy: RANKER_TYPE.RRF,
    params: {
      k,
    },
  };
};

/**
 * Creates a weighted ranker object.
 * @param weights - An array of numbers representing the weights.
 * @returns The weighted ranker object.
 */
export const WeightedRanker = (weights: number[]): RerankerObj => {
  return {
    strategy: RANKER_TYPE.WEIGHTED,
    params: {
      weights,
    },
  };
};

/**
 * Converts the rerank parameters object to a format suitable for API requests.
 * @param rerank - The rerank parameters object.
 * @returns The converted rerank parameters object.
 */
export const convertRerankParams = (rerank: RerankerObj) => {
  const r = cloneObj(rerank) as any;
  r.params = JSON.stringify(r.params);
  return r;
};

type FormatedSearchRequest = {
  collection_name: string;
  partition_names: string[];
  output_fields: string[];
  nq?: number;
  dsl?: string;
  dsl_type?: DslType;
  placeholder_group?: Uint8Array;
  search_params?: KeyValuePair[];
  consistency_level: ConsistencyLevelEnum;
  expr?: string;
  expr_template_values?: keyValueObj;
  rank_params?: KeyValuePair[];
};

/**
 * This method is used to build search request for a given data.
 * It first fetches the collection info and then constructs the search request based on the data type.
 * It also creates search vectors and a placeholder group for the search.
 *
 * @param {SearchReq | SearchSimpleReq | HybridSearchReq} data - The data for which to build the search request.
 * @param {DescribeCollectionResponse} collectionInfo - The collection information.
 * @param {Root} milvusProto - The milvus protocol object.
 * @returns {Object} An object containing the search requests and search vectors.
 * @returns {Object} return.params - The search requests used in the operation.
 * @returns {string} return.params.collection_name - The name of the collection.
 * @returns {string[]} return.params.partition_names - The partition names.
 * @returns {string[]} return.params.output_fields - The output fields.
 * @returns {number} return.params.nq - The number of query vectors.
 * @returns {string} return.params.dsl - The domain specific language.
 * @returns {string} return.params.dsl_type - The type of the domain specific language.
 * @returns {Uint8Array} return.params.placeholder_group - The placeholder group.
 * @returns {Object} return.params.search_params - The search parameters.
 * @returns {string} return.params.consistency_level - The consistency level.
 * @returns {Number[][]} return.searchVectors - The search vectors used in the operation.
 * @returns {number} return.round_decimal - The score precision.
 */
export const buildSearchRequest = (
  data: SearchReq | SearchSimpleReq | HybridSearchReq,
  collectionInfo: DescribeCollectionResponse,
  milvusProto: Root
) => {
  // type cast
  const searchReq = data as SearchReq;
  const searchHybridReq = data as HybridSearchReq;
  const searchSimpleReq = data as SearchSimpleReq;

  // Initialize requests array
  const requests: FormatedSearchRequest[] = [];

  // detect if the request is hybrid search request
  const isHybridSearch = !!(
    searchHybridReq.data &&
    searchHybridReq.data.length &&
    typeof searchHybridReq.data[0] === 'object' &&
    searchHybridReq.data[0].anns_field
  );

  // output fields(reference fields)
  const default_output_fields: string[] = ['*'];

  // Iterate through collection fields, create search request
  for (let i = 0; i < collectionInfo.schema.fields.length; i++) {
    const field = collectionInfo.schema.fields[i];
    const { name, dataType } = field;

    // if field  type is vector, build the request
    if (isVectorType(dataType)) {
      let req: SearchSimpleReq | (HybridSearchReq & HybridSearchSingleReq) =
        data as SearchSimpleReq;

      if (isHybridSearch) {
        const singleReq = searchHybridReq.data.find(d => d.anns_field === name);
        // if it is hybrid search and no request target is not found, skip
        if (!singleReq) {
          continue;
        }
        // merge single request with hybrid request
        req = Object.assign(cloneObj(data), singleReq);
      } else {
        // if it is not hybrid search, and we have built one request
        // or user has specified an anns_field to search and is not matching
        //  skip
        const skip =
          requests.length === 1 ||
          (typeof req.anns_field !== 'undefined' && req.anns_field !== name);
        if (skip) {
          continue;
        }
      }

      // get search data
      let searchData: SearchDataType | SearchMultipleDataType = isHybridSearch
        ? req.data!
        : searchReq.vectors ||
          searchSimpleReq.vectors ||
          searchSimpleReq.vector ||
          searchSimpleReq.data;

      // format searching data
      searchData = formatSearchData(searchData, field);

      // create search request
      const request: FormatedSearchRequest = {
        collection_name: req.collection_name,
        partition_names: req.partition_names || [],
        output_fields: req.output_fields || default_output_fields,
        nq: searchReq.nq || searchData.length,
        dsl: req.expr || searchReq.expr || searchSimpleReq.filter || '', // expr
        dsl_type: DslType.BoolExprV1,
        placeholder_group: buildPlaceholderGroupBytes(
          milvusProto,
          searchData as VectorTypes[],
          field
        ),
        search_params: parseToKeyValue(
          searchReq.search_params || buildSearchParams(req, name)
        ),
        consistency_level:
          req.consistency_level || (collectionInfo.consistency_level as any),
      };

      // if exprValues is set, add it to the request(inner)
      if (req.exprValues) {
        request.expr_template_values = formatExprValues(req.exprValues);
      }

      requests.push(request);
    }
  }

  /**
   *  It will decide the score precision.
   *  If round_decimal is 3, need return like 3.142
   *  And if Milvus return like 3.142, Node will add more number after this like 3.142000047683716.
   *  So the score need to slice by round_decimal
   */
  const round_decimal =
    searchReq.search_params?.round_decimal ??
    (searchSimpleReq.params?.round_decimal as number) ??
    -1;

  // outter expr_template_values
  const expr_template_values = searchSimpleReq.exprValues
    ? formatExprValues(searchSimpleReq.exprValues)
    : undefined;

  return {
    isHybridSearch: isHybridSearch,
    request: isHybridSearch
      ? ({
          collection_name: data.collection_name,
          partition_names: data.partition_names,
          requests: requests,
          rank_params: [
            ...parseToKeyValue(
              convertRerankParams(searchHybridReq.rerank || RRFRanker())
            ),
            { key: 'round_decimal', value: round_decimal },
            {
              key: 'limit',
              value:
                searchSimpleReq.limit ?? searchSimpleReq.topk ?? DEFAULT_TOPK,
            },
          ],
          output_fields: requests[0]?.output_fields,
          consistency_level: requests[0]?.consistency_level,
        } as FormatedSearchRequest)
      : requests[0],
    nq: requests[0].nq,
    round_decimal,
    expr_template_values,
  };
};

/**
 * Formats the search results returned by Milvus into row data for easier use.
 *
 * @param {SearchRes} searchRes - The search results returned by Milvus.
 * @param {Object} options - The options for formatting the search results.
 * @param {number} options.round_decimal - The number of decimal places to which to round the scores.
 *
 * @returns {any[]} The formatted search results.
 *
 */
export const formatSearchResult = (
  searchRes: SearchRes,
  options: {
    round_decimal: number;
    transformers?: OutputTransformers;
  }
) => {
  const { round_decimal } = options;
  // build final results array
  const results: any[] = [];
  const { topks, scores, fields_data, ids } = searchRes.results;
  // build fields data map
  const fieldsDataMap = buildFieldDataMap(fields_data, options.transformers);
  // build output name array
  const output_fields = [
    'id',
    ...(!!searchRes.results.output_fields?.length
      ? searchRes.results.output_fields
      : fields_data.map(f => f.field_name)),
  ];

  // vector id support int / str id.
  const idData = ids ? ids[ids.id_field]!.data : {};
  // add id column
  fieldsDataMap.set('id', idData as RowData[]);
  // fieldsDataMap.set('score', scores); TODO: fieldDataMap to support formatter

  /**
   * This code block formats the search results returned by Milvus into row data for easier use.
   * Milvus supports multiple queries to search and returns all columns data, so we need to splice the data for each search result using the `topk` variable.
   * The `topk` variable is the key we use to splice data for every search result.
   * The `scores` array is spliced using the `topk` value, and the resulting scores are formatted to the specified precision using the `formatNumberPrecision` function. The resulting row data is then pushed to the `results` array.
   */
  topks.forEach((v, index) => {
    const topk = Number(v);

    scores.splice(0, topk).forEach((score, scoreIndex) => {
      // get correct index
      const i = index === 0 ? scoreIndex : scoreIndex + topk * index;

      // fix round_decimal
      const fixedScore =
        typeof round_decimal === 'undefined' || round_decimal === -1
          ? score
          : formatNumberPrecision(score, round_decimal);

      // init result object
      const result: any = { score: fixedScore };

      // build result,
      output_fields.forEach(field_name => {
        // Check if the field_name exists in the fieldsDataMap
        const isFixedSchema = fieldsDataMap.has(field_name);

        // Get the data for the field_name from the fieldsDataMap
        // If the field_name is not in the fieldsDataMap, use the DEFAULT_DYNAMIC_FIELD
        const data = fieldsDataMap.get(
          isFixedSchema ? field_name : DEFAULT_DYNAMIC_FIELD
        )!;
        // make dynamic data[i] safe
        data[i] = isFixedSchema ? data[i] : data[i] || {};
        // extract dynamic info from dynamic field if necessary
        result[field_name] = isFixedSchema ? data[i] : data[i][field_name];
      });

      // init result slot
      results[index] = results[index] || [];
      // push result data
      results[index].push(result);
    });
  });

  return results;
};

/**
 * Formats the search vector to match a specific data type.
 * @param {SearchDataType[]} searchVector - The search vector or array of vectors to be formatted.
 * @param {DataType} dataType - The specified data type.
 * @returns {VectorTypes[]} The formatted search vector or array of vectors.
 */
export const formatSearchData = (
  searchData: SearchDataType | SearchMultipleDataType,
  field: FieldSchema
): SearchMultipleDataType => {
  const { dataType, is_function_output } = field;

  if (is_function_output) {
    return (
      Array.isArray(searchData) ? searchData : [searchData]
    ) as SearchMultipleDataType;
  }

  switch (dataType) {
    case DataType.FloatVector:
    case DataType.BinaryVector:
    case DataType.Float16Vector:
    case DataType.BFloat16Vector:
      if (!Array.isArray(searchData)) {
        return [searchData] as VectorTypes[];
      }
    case DataType.SparseFloatVector:
      const type = getSparseFloatVectorType(searchData as SparseVectorArray);
      if (type !== 'unknown') {
        return [searchData] as VectorTypes[];
      }
    default:
      return searchData as VectorTypes[];
  }
};

type TemplateValue =
  | { bool_val: boolean }
  | { int64_val: number }
  | { float_val: number }
  | { string_val: string }
  | { array_val: TemplateArrayValue };

type TemplateArrayValue =
  | { bool_data: { data: boolean[] } }
  | { long_data: { data: number[] } }
  | { double_data: { data: number[] } }
  | { string_data: { data: string[] } }
  | { json_data: { data: any[] } }
  | { array_data: { data: TemplateArrayValue[] } };

export const formatExprValues = (
  exprValues: Record<string, any>
): Record<string, TemplateValue> => {
  const result: Record<string, TemplateValue> = {};

  for (const [key, value] of Object.entries(exprValues)) {
    if (Array.isArray(value)) {
      // Handle arrays
      result[key] = { array_val: convertArray(value) };
    } else {
      // Handle primitive types
      if (typeof value === 'boolean') {
        result[key] = { bool_val: value };
      } else if (typeof value === 'number') {
        result[key] = Number.isInteger(value)
          ? { int64_val: value }
          : { float_val: value };
      } else if (typeof value === 'string') {
        result[key] = { string_val: value };
      }
    }
  }

  return result;
};

const convertArray = (arr: any[]): TemplateArrayValue => {
  const first = arr[0];

  switch (typeof first) {
    case 'boolean':
      return {
        bool_data: {
          data: arr,
        },
      };

    case 'number':
      if (Number.isInteger(first)) {
        return {
          long_data: {
            data: arr,
          },
        };
      } else {
        return {
          double_data: {
            data: arr,
          },
        };
      }

    case 'string':
      return {
        string_data: {
          data: arr,
        },
      };

    case 'object':
      if (Array.isArray(first)) {
        return {
          array_data: {
            data: arr.map(convertArray),
          },
        };
      } else {
        return {
          json_data: {
            data: arr,
          },
        };
      }

    default:
      return {
        string_data: {
          data: arr,
        },
      };
  }
};

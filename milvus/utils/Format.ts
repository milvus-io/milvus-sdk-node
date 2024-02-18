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
  Field,
  JSON,
  FieldData,
  CreateCollectionWithFieldsReq,
  CreateCollectionWithSchemaReq,
  SearchReq,
  SearchSimpleReq,
  VectorTypes,
  HybridSearchReq,
  DEFAULT_TOPK,
  DslType,
  parseFloatVectorToBytes,
  parseBinaryVectorToBytes,
  SearchRes,
  DEFAULT_DYNAMIC_FIELD,
  ConsistencyLevelEnum,
  isVectorType,
} from '../';

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
export const parseToKeyValue = (data?: {
  [x: string]: any;
}): KeyValuePair[] => {
  return data
    ? Object.keys(data).reduce(
        (pre: any[], cur: string) => [...pre, { key: cur, value: data[cur] }],
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
 * Assigns properties with keys `dim` or `max_length` to the `type_params` object of a `FieldType` object.
 * If the property exists in the `field` object, it is converted to a string and then deleted from the `field` object.
 * If the property already exists in the `type_params` object, it is also converted to a string.
 *
 * @param field The `FieldType` object to modify.
 * @returns The modified `FieldType` object.
 */
export const assignTypeParams = (
  field: FieldType,
  typeParamKeys: string[] = ['dim', 'max_length', 'max_capacity']
) => {
  let newField = cloneObj<FieldType>(field);
  typeParamKeys.forEach(key => {
    if (newField.hasOwnProperty(key)) {
      // if the property exists in the field object, assign it to the type_params object
      newField.type_params = newField.type_params || {};
      newField.type_params[key] = String(newField[key as keyof FieldType]);
      // delete the property from the field object
      delete newField[key as keyof FieldType];
    }

    if (newField.type_params && newField.type_params[key]) {
      // if the property already exists in the type_params object, convert it to a string
      newField.type_params[key] = String(newField.type_params[key]);
    }
  });
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

/**
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
  fieldSchemaType: Type
): { [k: string]: any } => {
  const {
    collection_name,
    description,
    enable_dynamic_field,
    enableDynamicField,
    partition_key_field,
  } = data;

  let fields = (data as CreateCollectionWithFieldsReq).fields;

  if ((data as CreateCollectionWithSchemaReq).schema) {
    fields = (data as CreateCollectionWithSchemaReq).schema;
  }

  const payload = {
    name: collection_name,
    description: description || '',
    enableDynamicField: !!enableDynamicField || !!enable_dynamic_field,
    fields: fields.map(field => {
      // Assign the typeParams property to the result of parseToKeyValue(type_params).
      const { type_params, ...rest } = assignTypeParams(field);
      const dataType = convertToDataType(field.data_type);
      const createObj: any = {
        ...rest,
        typeParams: parseToKeyValue(type_params),
        dataType,
        isPrimaryKey: !!field.is_primary_key,
        isPartitionKey:
          !!field.is_partition_key || field.name === partition_key_field,
      };

      // if element type exist and
      if (
        dataType === DataType.Array &&
        typeof field.element_type !== 'undefined'
      ) {
        createObj.elementType = convertToDataType(field.element_type);
      }

      if (typeof field.default_value !== 'undefined') {
        const dataKey = getDataKey(createObj.dataType, true);

        createObj.defaultValue = {
          [dataKey]: field.default_value,
        };
      }
      return fieldSchemaType.create(createObj);
    }),
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
  fieldMap: Map<string, Field>,
  dynamicFieldName: string
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
      const obj: JSON = row[dynamicFieldName] as JSON;
      // otherwise, add it to the dynamic field
      obj[key] = originRow[key];
    }
  }

  return row; // return the generated dynamic row object
};

/**
 * create a data map for each fields, resolve grpc data format
 * If the field is a vector, split the data into chunks of the appropriate size.
 * If the field is a scalar, decode the JSON/array data if necessary.
 */
export const buildFieldDataMap = (fields_data: any[]) => {
  const fieldsDataMap = new Map<string, RowData[]>();

  fields_data.forEach((item, i) => {
    // field data
    let field_data: any;

    // parse vector data
    if (item.field === 'vectors') {
      const key = item.vectors!.data;
      const vectorValue =
        key === 'float_vector'
          ? item.vectors![key]!.data
          : item.vectors![key]!.toJSON().data;

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
    } else {
      // parse scalar data
      const key = item.scalars!.data;
      field_data = item.scalars![key]!.data;

      // we need to handle array element specifically here
      if (key === 'array_data') {
        field_data = field_data.map((f: any) => {
          const key = f.data;
          return key ? f[key].data : [];
        });
      }

      // decode json
      switch (key) {
        case 'json_data':
          field_data.forEach((buffer: any, i: number) => {
            // console.log(JSON.parse(buffer.toString()));
            field_data[i] = JSON.parse(buffer.toString());
          });
          break;
        default:
          break;
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
export const buildFieldData = (rowData: RowData, field: Field): FieldData => {
  const { type, elementType, name } = field;
  switch (DataTypeMap[type]) {
    case DataType.BinaryVector:
    case DataType.FloatVector:
      return rowData[name];
    case DataType.JSON:
      return Buffer.from(JSON.stringify(rowData[name] || {}));
    case DataType.Array:
      const elementField = { ...field, type: elementType! };
      return buildFieldData(rowData, elementField);
    default:
      return rowData[name];
  }
};

/**
 * This function builds a placeholder group in bytes format for Milvus.
 *
 * @param {Root} milvusProto - The root object of the Milvus protocol.
 * @param {VectorTypes[]} searchVectors - An array of search vectors.
 * @param {DataType} vectorDataType - The data type of the vectors.
 *
 * @returns {Uint8Array} The placeholder group in bytes format.
 */
export const buildPlaceholderGroupBytes = (
  milvusProto: Root,
  searchVectors: VectorTypes[],
  vectorDataType: DataType
) => {
  // bytes builder
  const bytesBuilder = new Map<DataType, (input: VectorTypes) => Uint8Array>([
    [DataType.FloatVector, parseFloatVectorToBytes],
    [DataType.BinaryVector, parseBinaryVectorToBytes],
  ]);
  // create placeholder_group
  const PlaceholderGroup = milvusProto.lookupType(
    'milvus.proto.common.PlaceholderGroup'
  );
  // tag $0 is hard code in milvus, when dsltype is expr
  const placeholderGroupBytes = PlaceholderGroup.encode(
    PlaceholderGroup.create({
      placeholders: [
        {
          tag: '$0',
          type: vectorDataType,
          values: searchVectors.map(v => bytesBuilder.get(vectorDataType)!(v)),
        },
      ],
    })
  ).finish();

  return placeholderGroupBytes;
};

/**
 * This method is used to build search parameters for a given data.
 * It first fetches the collection info and then constructs the search parameters based on the data type.
 * It also creates search vectors and a placeholder group for the search.
 *
 * @param {SearchReq | SearchSimpleReq} data - The data for which to build the search parameters.
 * @param {DescribeCollectionResponse} collectionInfo - The collection information.
 * @param {Root} milvusProto - The milvus protocol object.
 * @returns {Object} An object containing the search parameters and search vectors.
 * @returns {Object} return.params - The search parameters used in the operation.
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
export const buildSearchParams = (
  data: SearchReq | SearchSimpleReq | HybridSearchReq,
  collectionInfo: DescribeCollectionResponse,
  milvusProto: Root
) => {
  // parse data
  const searchReqData = data as SearchReq;
  const searchSimpleReqData = data as SearchSimpleReq;
  const searchHybridReqData = data as HybridSearchReq;

  // create search vectors
  let searchVectors: VectorTypes[] =
    searchReqData.vectors ||
    searchSimpleReqData.data ||
    searchSimpleReqData.vector;

  // make sure the searchVectors format is correct
  if (!Array.isArray(searchVectors[0])) {
    searchVectors = [searchVectors as unknown] as number[][];
  }

  // build request map
  const requests: Map<
    string, // anns_field
    {
      collection_name: string;
      partition_names: string[];
      output_fields: string[];
      nq: number;
      dsl: string;
      dsl_type: DslType;
      placeholder_group: Uint8Array;
      search_params: KeyValuePair[];
      consistency_level: ConsistencyLevelEnum;
    }
  > = new Map();

  // get default output fields
  const defaultOutputFields: string[] = collectionInfo.schema.fields.map(
    f => f.name
  );

  // get information from collection info
  collectionInfo.schema.fields.forEach(field => {
    const { name, dataType } = field;

    // if field  type is vector, lets build the request
    if (isVectorType(dataType)) {
      // ensure data exist
      searchHybridReqData.data = searchHybridReqData.data || [];
      // build req object
      const req =
        searchHybridReqData.data.find((d: any) => d.anns_field === name) ||
        searchSimpleReqData;

      // create search params
      const search_params = searchReqData.search_params || {
        anns_field: req.anns_field || name,
        topk:
          searchSimpleReqData.limit ?? searchSimpleReqData.topk ?? DEFAULT_TOPK,
        offset: searchSimpleReqData.offset ?? 0,
        metric_type: req.metric_type ?? '', // leave it empty
        params: JSON.stringify(req.params ?? {}),
        ignore_growing: req.ignore_growing ?? false,
      };

      // if group_by_field is set, add it to the search params
      if (req.group_by_field) {
        search_params.group_by_field = req.group_by_field;
      }

      // create search request
      requests.set(name, {
        collection_name: data.collection_name,
        partition_names: data.partition_names || [],
        output_fields: data.output_fields || defaultOutputFields,
        nq: searchReqData.nq || searchVectors.length,
        dsl: searchReqData.expr || searchSimpleReqData.filter || '',
        dsl_type: DslType.BoolExprV1,
        placeholder_group: buildPlaceholderGroupBytes(
          milvusProto,
          searchVectors,
          field.dataType!
        ),
        search_params: parseToKeyValue(search_params),
        consistency_level:
          data.consistency_level || (collectionInfo.consistency_level as any),
      });
    }
  });

  /**
   *  It will decide the score precision.
   *  If round_decimal is 3, need return like 3.142
   *  And if Milvus return like 3.142, Node will add more number after this like 3.142000047683716.
   *  So the score need to slice by round_decimal
   */
  const round_decimal =
    searchReqData.search_params?.round_decimal ??
    (searchSimpleReqData.params?.round_decimal as number);

  // convert map to array
  const requestArray = Array.from(requests.values());

  return {
    params: requests.size == 1 ? requestArray[0] : requestArray,
    searchVectors,
    round_decimal,
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
  }
) => {
  const { round_decimal } = options;
  // build final results array
  const results: any[] = [];
  const { topks, scores, fields_data, ids } = searchRes.results;
  // build fields data map
  const fieldsDataMap = buildFieldDataMap(fields_data);
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

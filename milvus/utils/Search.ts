import { Root } from 'protobufjs';
import {
  ERROR_REASONS,
  KeyValuePair,
  DataType,
  DescribeCollectionResponse,
  _Field,
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
  buildPlaceholderGroupBytes,
  getSparseFloatVectorType,
  OutputTransformers,
  SparseVectorArray,
  SearchDataType,
  FieldSchema,
  SearchMultipleDataType,
  keyValueObj,
  FunctionObject,
  buildFieldDataMap,
  cloneObj,
  parseToKeyValue,
  formatNumberPrecision,
} from '../';

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

  // if group_by_field is set
  // reminder: never add this kind of key again, just put params in the params object
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

  // data.params -> search_params
  for (let key in data.params) {
    search_params[key] = data.params[key];
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
  function_score?: any;
  requests?: FormatedSearchRequest[];
};

/**
 * Creates function_score object for search requests
 * @param isRerankFunction - Whether the rerank is a function object
 * @param searchHybridReq - The hybrid search request
 * @param schemaTypes - Schema types for creating function objects
 * @returns Function score object or empty object
 */
const createFunctionScore = (
  hasRerankFunction: boolean,
  searchHybridReq: HybridSearchReq
) => {
  if (!hasRerankFunction) {
    return {};
  }

  return {
    function_score: {
      functions: [searchHybridReq.rerank as FunctionObject].map(
        (func: FunctionObject) => {
          const { input_field_names, output_field_names, ...rest } = func;
          const result = {
            ...rest,
            input_field_names: input_field_names || [],
            output_field_names: output_field_names || [],
            params: parseToKeyValue(func.params, true),
          };
          return result;
        }
      ),
      params: [],
    },
  };
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
  params: SearchReq | SearchSimpleReq | HybridSearchReq,
  collectionInfo: DescribeCollectionResponse,
  milvusProto: Root
) => {
  // type cast
  const searchReq = params as SearchReq;
  const searchHybridReq = params as HybridSearchReq;
  const searchSimpleReq = params as SearchSimpleReq;
  const searchSimpleOrHybridReq = params as SearchSimpleReq | HybridSearchReq;
  const hasRerankFunction = !!(
    searchSimpleOrHybridReq.rerank &&
    typeof searchSimpleOrHybridReq.rerank === 'object' &&
    'type' in searchSimpleOrHybridReq.rerank
  );

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
        params as SearchSimpleReq;

      if (isHybridSearch) {
        const singleReq = searchHybridReq.data.find(d => d.anns_field === name);
        // if it is hybrid search and no request target is not found, skip
        if (!singleReq) {
          continue;
        }
        // merge single request with hybrid request
        req = Object.assign(cloneObj(params), singleReq);
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

  // if no anns_field found in search request, throw error
  if (requests.length === 0) {
    throw new Error(ERROR_REASONS.NO_ANNS_FEILD_FOUND_IN_SEARCH);
  }

  return {
    isHybridSearch: isHybridSearch,
    request: isHybridSearch
      ? {
          collection_name: params.collection_name,
          partition_names: params.partition_names,
          requests: requests,
          output_fields: requests[0]?.output_fields,
          consistency_level: requests[0]?.consistency_level,

          // if ranker is set and it is a hybrid search, add it to the request
          ...createFunctionScore(hasRerankFunction, searchHybridReq),

          // if ranker is not exist, use RRFRanker ranker
          ...{
            rank_params: [
              ...(!hasRerankFunction
                ? parseToKeyValue(convertRerankParams(RRFRanker()))
                : []),
              { key: 'round_decimal', value: round_decimal },
              {
                key: 'limit',
                value:
                  searchSimpleReq.limit ?? searchSimpleReq.topk ?? DEFAULT_TOPK,
              },
            ],
          },
        }
      : ({
          ...requests[0],
          ...createFunctionScore(hasRerankFunction, searchHybridReq),
        } as FormatedSearchRequest),
    // if round_decimal is set, add it to the return object
    ...(round_decimal !== -1 ? { round_decimal } : {}),
    nq: requests[0].nq,
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
    ...(!!searchRes.results.output_fields?.length
      ? searchRes.results.output_fields
      : fields_data.map(f => f.field_name)),
  ];

  // fieldsDataMap.set('score', scores); TODO: fieldDataMap to support formatter

  /**
   * This code block formats the search results returned by Milvus into row data for easier use.
   * Milvus supports multiple queries to search and returns all columns data, so we need to splice the data for each search result using the `topk` variable.
   * The `topk` variable is the key we use to splice data for every search result.
   * The `scores` array is spliced using the `topk` value, and the resulting scores are formatted to the specified precision using the `formatNumberPrecision` function. The resulting row data is then pushed to the `results` array.
   */
  let offset = 0;
  topks.forEach((v, queryIndex) => {
    const topk = Number(v);
    const queryResults: any[] = [];

    if (topk > 0) {
      for (let hitIndex = 0; hitIndex < topk; hitIndex++) {
        const absoluteIndex = offset + hitIndex; // Correct index for flat arrays

        const score = scores[absoluteIndex]; // Access score without modifying array
        const fixedScore =
          typeof round_decimal === 'undefined' || round_decimal === -1
            ? score
            : formatNumberPrecision(score, round_decimal);

        const result: any = { score: fixedScore };

        // Get ID - Assuming ID field name is known or included in output_fields
        // Example: const idFieldName = collectionInfo.schema.primary_field_name;
        // if (fieldsDataMap.has(idFieldName)) {
        //    result.id = fieldsDataMap.get(idFieldName)![absoluteIndex];
        // }

        output_fields.forEach(field_name => {
          const isFixedSchema = fieldsDataMap.has(field_name);
          const dataArray = fieldsDataMap.get(
            isFixedSchema ? field_name : DEFAULT_DYNAMIC_FIELD
          )!;

          // Safer read-only access for dynamic fields
          const value = isFixedSchema
            ? dataArray[absoluteIndex]
            : dataArray[absoluteIndex]
            ? dataArray[absoluteIndex][field_name]
            : undefined;

          result[field_name] = value;
        });

        queryResults.push(result);
      }
    }

    results[queryIndex] = queryResults;
    offset += topk; // Update offset for the next query's results
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
    case DataType.Int8Vector:
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

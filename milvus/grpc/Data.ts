import {
  DataType,
  DataTypeMap,
  ERROR_REASONS,
  DslType,
  DeleteEntitiesReq,
  FlushReq,
  GetFlushStateReq,
  GetQuerySegmentInfoReq,
  InsertReq,
  LoadBalanceReq,
  ImportReq,
  ListImportTasksReq,
  ErrorCode,
  FlushResult,
  GetFlushStateResponse,
  GetMetricsResponse,
  GetQuerySegmentInfoResponse,
  MutationResult,
  QueryResults,
  ResStatus,
  SearchResults,
  ImportResponse,
  ListImportTasksResponse,
  GetMetricsRequest,
  QueryReq,
  GetReq,
  DeleteReq,
  QueryRes,
  SearchReq,
  SearchRes,
  SearchSimpleReq,
  DEFAULT_TOPK,
  DEFAULT_METRIC_TYPE,
  promisify,
  findKeyValue,
  sleep,
  formatNumberPrecision,
  parseToKeyValue,
  checkCollectionName,
  checkSearchParams,
  parseBinaryVectorToBytes,
  parseFloatVectorToBytes,
  DEFAULT_DYNAMIC_FIELD,
  generateDynamicRow,
  getFieldDataMap,
} from '../';
import { Collection } from './Collection';

export class Data extends Collection {
  // vectorTypes
  vectorTypes = [DataType.BinaryVector, DataType.FloatVector];

  /**
   * Insert data into Milvus.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_name(optional)| String | Partition name |
   *  | fields_data or data | { [x: string]: any }[] | If the field type is binary, the vector data length needs to be dimension / 8 |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | succ_index |  Index array of the successfully inserted data |
   *  | err_index | Index array of the unsuccessfully inserted data |
   *  | IDs | ID array of the successfully inserted data |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).insert({
   *    collection_name: COLLECTION_NAME,
   *    fields_data: [{
   *      vector_field: [1,2,2,4],
   *      scalar_field: 1
   *    }]
   *  });
   * ```
   */
  async insert(data: InsertReq): Promise<MutationResult> {
    checkCollectionName(data);
    // ensure fields data available
    data.fields_data = data.fields_data || data.data;
    if (
      !data.fields_data ||
      !Array.isArray(data.fields_data) ||
      !data.fields_data.length
    ) {
      throw new Error(ERROR_REASONS.INSERT_CHECK_FIELD_DATA_IS_REQUIRED);
    }
    const { collection_name } = data;
    const collectionInfo = await this.describeCollection({
      collection_name,
    });

    if (collectionInfo.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(collectionInfo.status.reason);
    }

    // Tip: The field data sequence needs to be set same as `collectionInfo.schema.fields`.
    // If primarykey is set `autoid = true`, you cannot insert the data.
    const fieldsDataMap = new Map(
      collectionInfo.schema.fields
        .filter(v => !v.is_primary_key || !v.autoID)
        .map(v => [
          v.name,
          {
            name: v.name,
            type: v.data_type,
            dim: Number(findKeyValue(v.type_params, 'dim')),
            value: [], // value container
          } as any,
        ])
    );

    // The actual data we pass to Milvus gRPC.
    const params: any = { ...data, num_rows: data.fields_data.length };

    // dynamic field is enabled, create $meta field
    const isDynamic = collectionInfo.schema.enable_dynamic_field;
    if (isDynamic) {
      fieldsDataMap.set(DEFAULT_DYNAMIC_FIELD, {
        name: DEFAULT_DYNAMIC_FIELD,
        type: 'JSON',
        value: [], // value container
      });
    }

    // Loop through each row and set the corresponding field values in the Map.
    data.fields_data.forEach((v, i) => {
      // if support dynamic field, all field not in the schema would be grouped to a dynamic field
      v = isDynamic
        ? generateDynamicRow(v, fieldsDataMap, DEFAULT_DYNAMIC_FIELD)
        : v;

      // get each fieldname in the data object
      const fieldNames = Object.keys(v);
      // go through each fieldname and encode or format data
      fieldNames.forEach(name => {
        const target = fieldsDataMap.get(name);
        if (!target) {
          throw new Error(`${ERROR_REASONS.INSERT_CHECK_WRONG_FIELD} ${i}`);
        }
        if (
          DataTypeMap[target.type] === DataType.BinaryVector &&
          v[name].length !== target.dim / 8
        ) {
          throw new Error(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
        }

        // encode data
        switch (DataTypeMap[target.type]) {
          case DataType.BinaryVector:
          case DataType.FloatVector:
            for (let val of v[name]) {
              target.value.push(val);
            }
            break;
          case DataType.JSON:
            // ensure empty string
            target.value[i] = Buffer.from(JSON.stringify(v[name] || {}));
            break;
          default:
            target.value[i] = v[name];
            break;
        }
      });
    });

    // transform data from map to array, milvus grpc params
    params.fields_data = Array.from(fieldsDataMap.values()).map(v => {
      // milvus return string for field type, so we define the DataTypeMap to the value we need.
      // but if milvus change the string, may cause we cant find value.
      const type = DataTypeMap[v.type];
      const key = this.vectorTypes.includes(type) ? 'vectors' : 'scalars';
      let dataKey = 'float_vector';
      switch (type) {
        case DataType.FloatVector:
          dataKey = 'float_vector';
          break;
        case DataType.BinaryVector:
          dataKey = 'binary_vector';
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
        case DataType.JSON:
          dataKey = 'json_data';
          break;
        default:
          throw new Error(
            `${ERROR_REASONS.INSERT_CHECK_WRONG_DATA_TYPE} "${v.type}."`
          );
      }
      return {
        type,
        field_name: v.name,
        is_dynamic: v.name === DEFAULT_DYNAMIC_FIELD,
        [key]:
          type === DataType.FloatVector
            ? {
                dim: v.dim,
                [dataKey]: {
                  data: v.value,
                },
              }
            : type === DataType.BinaryVector
            ? {
                dim: v.dim,
                [dataKey]: parseBinaryVectorToBytes(v.value),
              }
            : {
                [dataKey]: {
                  data: v.value,
                },
              },
      };
    });

    const promise = await promisify(
      this.client,
      'Insert',
      params,
      data.timeout || this.timeout
    );

    return promise;
  }

  /**
   * Delete entities in Milvus
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_name(optional)| String | Partition name |
   *  | expr or filter | String | Boolean expression used to filter attribute. |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status |  { error_code: number, reason: string } |
   *  | IDs | ID array of the successfully deleted data |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).deleteEntities({
   *    collection_name: COLLECTION_NAME,
   *    expr: 'id in [1,2,3,4]'
   *  });
   * ```
   */
  async deleteEntities(data: DeleteEntitiesReq): Promise<MutationResult> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }

    // check expr or filter
    if (!data.filter && !data.expr) {
      throw new Error(ERROR_REASONS.FILTER_EXPR_REQUIRED);
    }

    // filter > expr
    data.expr = data.filter || data.expr;

    const promise = await promisify(
      this.client,
      'Delete',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Delete entities in Milvus
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | partition_name(optional)| String | Partition name |
   *  | ids | String[] or Number[] | ids to delete |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status |  { error_code: number, reason: string } |
   *  | IDs | ID array of the successfully deleted data |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).deleteEntities({
   *    collection_name: COLLECTION_NAME,
   *    expr: 'id in [1,2,3,4]'
   *  });
   * ```
   */
  async delete(data: DeleteReq): Promise<MutationResult> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }

    if (!data.ids || data.ids.length === 0) {
      throw new Error(ERROR_REASONS.IDS_REQUIRED);
    }

    const pkField = await this.getPkFieldName(data);

    const req = { ...data, expr: `${pkField} in [${data.ids.join(',')}]` };
    return this.deleteEntities(req);
  }

  /**
   * Perform vector similarity search.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | vectors or data or (vector) | Number[][] or Number[] | Original vector to search with |
   *  | partition_names(optional)| String[] | Array of partition names |
   *  | limit(optional) | number | topk alias |
   *  | topk(optional) | number | topk |
   *  | offset(optional) | number | offset |
   *  | filter(optional) | String | Scalar field filter expression |
   *  | expr(optional) | String | filter alias |
   *  | output_fields(optional) | String[] | Support scalar field |
   *  | metric_type(optional) | String | similarity metric |
   *  | params(optional) | key value object | search params |
   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *  | results | {score:number,id:string}[]; |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).search({
   *   collection_name: COLLECTION_NAME,
   *   vector: [1, 2, 3, 4],
   *  });
   * ```
   */
  async search(data: SearchReq | SearchSimpleReq): Promise<SearchResults> {
    // params check
    checkSearchParams(data);

    try {
      // get collection info
      const collectionInfo = await this.describeCollection({
        collection_name: data.collection_name,
      });

      // get information from collection info
      let vectorType: DataType;
      let defaultOutputFields = [];
      let anns_field: string;
      for (let i = 0; i < collectionInfo.schema.fields.length; i++) {
        const f = collectionInfo.schema.fields[i];
        const type = DataTypeMap[f.data_type];

        // filter vector field
        if (type === DataType.FloatVector || type === DataType.BinaryVector) {
          // anns field
          anns_field = f.name;
          // vector type
          vectorType = type;
        } else {
          // save field name
          defaultOutputFields.push(f.name);
        }
      }

      // create search params
      const search_params = (data as SearchReq).search_params || {
        anns_field: anns_field!,
        topk:
          (data as SearchSimpleReq).limit ||
          (data as SearchSimpleReq).topk ||
          DEFAULT_TOPK,
        offset: (data as SearchSimpleReq).offset || 0,
        metric_type:
          (data as SearchSimpleReq).metric_type || DEFAULT_METRIC_TYPE,
        params: JSON.stringify((data as SearchSimpleReq).params || {}),
      };

      // create search vectors
      let searchVectors: number[] | number[][] =
        (data as SearchReq).vectors ||
        (data as SearchSimpleReq).data ||
        (data as SearchSimpleReq).vector;

      // make sure the searchVectors format is correct
      if (!Array.isArray(searchVectors[0])) {
        searchVectors = [searchVectors as unknown] as number[][];
      }

      /**
       *  It will decide the score precision.
       *  If round_decimal is 3, need return like 3.142
       *  And if Milvus return like 3.142, Node will add more number after this like 3.142000047683716.
       *  So the score need to slice by round_decimal
       */
      const round_decimal =
        (data as SearchReq).search_params?.round_decimal ??
        ((data as SearchSimpleReq).params?.round_decimal as number);

      // create placeholder_group
      const PlaceholderGroup = this.milvusProto.lookupType(
        'milvus.proto.common.PlaceholderGroup'
      );
      // tag $0 is hard code in milvus, when dsltype is expr
      const placeholderGroupBytes = PlaceholderGroup.encode(
        PlaceholderGroup.create({
          placeholders: [
            {
              tag: '$0',
              type: vectorType!,
              values: searchVectors.map(v =>
                vectorType === DataType.BinaryVector
                  ? parseBinaryVectorToBytes(v)
                  : parseFloatVectorToBytes(v)
              ),
            },
          ],
        })
      ).finish();

      const promise: SearchRes = await promisify(
        this.client,
        'Search',
        {
          collection_name: data.collection_name,
          partition_names: data.partition_names,
          output_fields: data.output_fields || defaultOutputFields,
          nq: (data as SearchReq).nq || searchVectors.length,
          dsl:
            (data as SearchReq).expr || (data as SearchSimpleReq).filter || '',
          dsl_type: DslType.BoolExprV1,
          placeholder_group: placeholderGroupBytes,
          search_params: parseToKeyValue(search_params),
          consistency_level: data.consistency_level,
        },
        data.timeout || this.timeout
      );

      // if search failed, return empty with status
      if (promise.status.error_code !== ErrorCode.SUCCESS) {
        return {
          status: promise.status,
          results: [],
        };
      }

      // build final results array
      const results: any[] = [];
      const { topks, scores, fields_data, ids } = promise.results;
      // build fields data map
      const fieldsDataMap = getFieldDataMap(fields_data);
      // build output name array
      const output_fields = [
        'id',
        ...(promise.results.output_fields ||
          fields_data.map(f => f.field_name)),
      ];

      // vector id support int / str id.
      const idData = ids ? ids[ids.id_field]?.data : undefined;
      // add id column
      fieldsDataMap.set('id', idData);
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
          const i = index === 0 ? scoreIndex : scoreIndex + topk;
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
            );

            // make data[i] safe
            data[i] = data[i] || {};
            // extract dynamic info from dynamic field if necessary
            result[field_name] = isFixedSchema ? data[i] : data[i][field_name];
          });

          // init result slot
          results[index] = results[index] || [];
          // push result data
          results[index].push(result);
        });
      });

      return {
        status: promise.status,
        // if only searching 1 vector, return the first object of results array
        results: searchVectors.length === 1 ? results[0] : results,
      };
    } catch (err) {
      /* istanbul ignore next */
      throw new Error(err);
    }
  }

  /**
   * Milvus temporarily buffers the newly inserted vectors in the cache. Call `flush()` to persist them to the object storage.
   * It's async function, so it's will take some times to execute.
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_names | String[] | Array of collection names |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number, reason: string } |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).flush({
   *     collection_names: ['my_collection'],
   *  });
   * ```
   */
  async flush(data: FlushReq): Promise<FlushResult> {
    if (
      !data ||
      !Array.isArray(data.collection_names) ||
      !data.collection_names.length
    ) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'Flush',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * It's same function as flush. But flushSync is sync function.
   * So you can ensure it's flushed after function return the result.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_names | String[] | Array of collection names |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status |  { error_code: number, reason: string } |
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).flushSync({
   *     collection_names: ['my_collection'],
   *  });
   * ```
   */
  async flushSync(data: FlushReq): Promise<GetFlushStateResponse> {
    if (
      !data ||
      !Array.isArray(data.collection_names) ||
      !data.collection_names.length
    ) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    // copy flushed collection names
    const res = await promisify(
      this.client,
      'Flush',
      data,
      data.timeout || this.timeout
    );
    // After flush will return collection segment ids, need use GetPersistentSegmentInfo to check segment flush status.
    const segIDs = Object.keys(res.coll_segIDs)
      .map(v => res.coll_segIDs[v].data)
      .reduce((pre, cur) => [...pre, ...cur], []);

    let isFlushed = false;
    let flushRes = null;
    while (!isFlushed) {
      flushRes = await this.getFlushState({ segmentIDs: segIDs });
      await sleep(100);
      isFlushed = flushRes.flushed;
    }
    // Before Milvus pre-GA will throw error
    return flushRes as GetFlushStateResponse;
  }

  /**
   * Query vector data in Milvus. Current release of Milvus only supports expression as fieldname in [id1,id2,id3]
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | expr or filter | String | Scalar field filter expression |
   *  | partitions_names(optional) | String[] | Array of partition names |
   *  | output_fields | String[] | Vector or scalar field to be returned |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *  | params | {key: value}[] | An optional key pair json array
   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | data | Data of all fields that you defined in `output_fields`, {field_name: value}[] |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).query({
   *    collection_name: 'my_collection',
   *    expr: "age in [1,2,3,4,5,6,7,8]",
   *    output_fields: ["age"],
   *  });
   * ```
   */
  async query(data: QueryReq): Promise<QueryResults> {
    checkCollectionName(data);

    // Set up limits and offset for the query
    let limits: { limit: number } | undefined;
    let offset: { offset: number } | undefined;

    if (typeof data.limit === 'number') {
      limits = { limit: data.limit };
    }
    if (typeof data.offset === 'number') {
      offset = { offset: data.offset };
    }

    // check expr or filter
    if (!data.filter && !data.expr) {
      throw new Error(ERROR_REASONS.FILTER_EXPR_REQUIRED);
    }

    // filter > expr
    data.expr = data.filter || data.expr;

    // Execute the query and get the results
    const promise: QueryRes = await promisify(
      this.client,
      'Query',
      {
        ...data,
        query_params: parseToKeyValue({ ...limits, ...offset }),
      },
      data.timeout || this.timeout
    );

    // compatible with milvus before v2.2.9
    const output_fields =
      promise.output_fields || promise.fields_data.map(f => f.field_name);

    // Initialize an array to hold the query results
    const results: { [x: string]: any }[] = [];

    const fieldsDataMap = getFieldDataMap(promise.fields_data);

    // For each output field, check if it has a fixed schema or not
    const fieldData = output_fields.map(field_name => {
      // Check if the field_name exists in the fieldsDataMap
      const isFixedSchema = fieldsDataMap.has(field_name);

      // Get the data for the field_name from the fieldsDataMap
      // If the field_name is not in the fieldsDataMap, use the DEFAULT_DYNAMIC_FIELD
      const data = fieldsDataMap.get(
        isFixedSchema ? field_name : DEFAULT_DYNAMIC_FIELD
      );

      // Return an object containing the field_name and its corresponding data
      // If the schema is fixed, use the data directly
      // If the schema is not fixed, map the data to extract the field_name values
      return {
        data: isFixedSchema ? data : data.map((d: any) => d[field_name]),
        field_name,
      };
    });

    // parse column data to [{fieldname:value}]
    fieldData.forEach((v: any) => {
      v.data.forEach((d: string | number[], i: number) => {
        if (!results[i]) {
          results[i] = {
            [v.field_name]: d,
          };
        } else {
          results[i] = {
            ...results[i],
            [v.field_name]: d,
          };
        }
      });
    });

    return {
      status: promise.status,
      data: results,
    };
  }

  /**
   * get vector data by providing ids in Milvus
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | Collection name |
   *  | ids | String[] | ids to get |
   *  | partitions_names(optional) | String[] | Array of partition names |
   *  | output_fields | String[] | Vector or scalar field to be returned |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |

   *  | params | {key: value}[] | An optional key pair json array
   *
   * @returns
   * | Property | Description |
   *  | :-- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | data | Data of all fields that you defined in `output_fields`, {field_name: value}[] |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).get({
   *    collection_name: 'my_collection',
   *    ids: [1,2,3,4,5,6,7,8],
   *    output_fields: ["age"],
   *  });
   * ```
   */
  async get(data: GetReq): Promise<QueryResults> {
    checkCollectionName(data);

    const pkField = await this.getPkFieldName(data);

    if (!data.ids || data.ids.length === 0) {
      throw new Error(ERROR_REASONS.IDS_REQUIRED);
    }

    // build query req
    const req = { ...data, expr: `${pkField} in [${data.ids.join(',')}]` };

    return this.query(req);
  }

  /**
   * @ignore
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | request | object | Only allow "system_info" for now |
   */
  async getMetric(data: GetMetricsRequest): Promise<GetMetricsResponse> {
    if (!data || !data.request || !data.request.metric_type) {
      throw new Error(ERROR_REASONS.GET_METRIC_CHECK_PARAMS);
    }
    const res: GetMetricsResponse = await promisify(
      this.client,
      'GetMetrics',
      {
        request: JSON.stringify(data.request),
      },
      data.timeout || this.timeout
    );

    return {
      ...res,
      response: JSON.parse(res.response),
    };
  }

  /**
   * Get flush state by segment ids
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | segmentIDs | Array | The segment ids |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   * | Property | Description |
   *  | :--- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | flushed | segments flushed or not |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await milvusClient.getFlushState({
   *    segmentIDs: segIds,
   *   });
   * ```
   */
  async getFlushState(data: GetFlushStateReq): Promise<GetFlushStateResponse> {
    if (!data || !data.segmentIDs) {
      throw new Error(ERROR_REASONS.GET_FLUSH_STATE_CHECK_PARAMS);
    }
    const res = await promisify(
      this.client,
      'GetFlushState',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Do load balancing operation from source query node to destination query node.
   * Only work in cluster milvus.
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | src_nodeID | number | The source query node id to balance. |
   *  | dst_nodeIDs | number[] | The destination query node ids to balance.(optional) |
   *  | sealed_segmentIDs | number[] | Sealed segment ids to balance.(optional) |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   * @returns
   * | Property | Description |
   *  | :--- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | infos | segments information |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await loadBalance({
   *      src_nodeID: 31,
   *   });
   * ```
   */
  async loadBalance(data: LoadBalanceReq): Promise<ResStatus> {
    if (!data || !data.src_nodeID) {
      throw new Error(ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS);
    }
    const res = await promisify(
      this.client,
      'LoadBalance',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Notifies Proxy to return segments information from query nodes.
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :--- | :-- | :-- |
   *  | collectionName | String | The name of the collection to get segments info. |
   *  | timeout? | number | An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined |
   *
   *
   * @returns
   * | Property | Description |
   *  | :--- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | infos | QuerySegmentInfo is the growing segments's information in query cluster. |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await getQuerySegmentInfo({
   *      collectionName: COLLECTION,
   *    });
   * ```
   */
  async getQuerySegmentInfo(
    data: GetQuerySegmentInfoReq
  ): Promise<GetQuerySegmentInfoResponse> {
    if (!data || !data.collectionName) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'GetQuerySegmentInfo',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Import data from files
   *
   * @param data
   *  | Property | Type | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | The name of the collection |
   *  | files | string[] | File path array |
   *
   *
   * @returns
   * | Property | Description |
   *  | :--- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | tasks | taskId array |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await bulkInsert({
   *      collection_name: COLLECTION,
   *      files: [`path-to-data-file.json`]
   *    });
   * ```
   */
  /* istanbul ignore next */
  async bulkInsert(data: ImportReq): Promise<ImportResponse> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }

    if (!data || !data.files) {
      throw new Error(ERROR_REASONS.IMPORT_FILE_CHECK);
    }
    const res = await promisify(
      this.client,
      'Import',
      {
        ...data,
        options: data.options || [],
      },
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * List import tasks
   *
   * @param data
   *  | Property | Type  | Description |
   *  | :--- | :-- | :-- |
   *  | collection_name | String | The name of the collection |
   *  | limit | number | optional, maximum number of tasks returned, list all tasks if the value is 0 |
   *
   *
   * @returns
   * | Property | Description |
   *  | :--- | :-- |
   *  | status | { error_code: number,reason:string } |
   *  | state | import state |
   *  | row_count | how many rows to import|
   *  | id_list| id lists |
   *  | collection_id | collection to be imported to |
   *  | tasks | taskId array  |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await listImportTasks({
   *      collection_name: COLLECTION
   *    });
   * ```
   */
  /* istanbul ignore next */
  async listImportTasks(
    data: ListImportTasksReq
  ): Promise<ListImportTasksResponse> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.client,
      'ListImportTasks',
      {
        ...data,
        limit: data.limit || 0,
      },
      data.timeout || this.timeout
    );
    return res;
  }
}

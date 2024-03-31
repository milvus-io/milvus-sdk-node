import {
  DataType,
  DataTypeMap,
  ERROR_REASONS,
  DslType,
  DeleteEntitiesReq,
  FlushReq,
  GetFlushStateReq,
  GetQuerySegmentInfoReq,
  GePersistentSegmentInfoReq,
  InsertReq,
  LoadBalanceReq,
  ImportReq,
  ListImportTasksReq,
  // ListIndexedSegmentReq,
  // DescribeSegmentIndexDataReq,
  ErrorCode,
  FlushResult,
  GetFlushStateResponse,
  GetMetricsResponse,
  GetQuerySegmentInfoResponse,
  GePersistentSegmentInfoResponse,
  MutationResult,
  QueryResults,
  ResStatus,
  SearchResults,
  ImportResponse,
  ListImportTasksResponse,
  // ListIndexedSegmentResponse,
  // DescribeSegmentIndexDataResponse,
  GetMetricsRequest,
  QueryReq,
  GetReq,
  DeleteReq,
  DeleteByIdsReq,
  DeleteByFilterReq,
  QueryRes,
  SearchReq,
  SearchRes,
  SearchSimpleReq,
  SearchIteratorReq,
  DEFAULT_TOPK,
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
  buildDynamicRow,
  buildFieldDataMap,
  getDataKey,
  Field,
  buildFieldData,
  Vectors,
  BinaryVectors,
  RowData,
  CountReq,
  CountResult,
  DEFAULT_COUNT_QUERY_STRING,
  MIN_INT64,
  DataTypeStringEnum,
  FieldSchema,
  QueryIteratorReq,
} from '../';
import { Collection } from './Collection';

export class Data extends Collection {
  // vectorTypes
  vectorTypes = [DataType.BinaryVector, DataType.FloatVector];

  /**
   * Upsert data into Milvus, view _insert for detail
   */
  async upsert(data: InsertReq): Promise<MutationResult> {
    return this._insert(data, true);
  }

  /**
   * Insert data into Milvus, view _insert for detail
   */
  async insert(data: InsertReq): Promise<MutationResult> {
    return this._insert(data);
  }

  /**
   * Insert or upsert data into a Milvus collection.
   *
   * @param {InsertReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.partition_name] - The name of the partition (optional).
   * @param {{ [x: string]: any }[]} data.fields_data - The data to be inserted. If the field type is binary, the vector data length needs to be dimension / 8.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<MutationResult>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {number[]} succ_index - Index array of the successfully inserted data.
   * @returns {number[]} err_index - Index array of the unsuccessfully inserted data.
   * @returns {number[]} IDs - ID array of the successfully inserted data.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.insert({
   *    collection_name: 'my_collection',
   *    fields_data: [{
   *      vector_field: [1,2,2,4],
   *      scalar_field: 1
   *    }]
   *  });
   * ```
   */
  private async _insert(
    data: InsertReq,
    upsert: boolean = false
  ): Promise<MutationResult> {
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
      throw collectionInfo;
    }

    // Tip: The field data sequence needs to be set same as `collectionInfo.schema.fields`.
    // If primarykey is set `autoid = true`, you cannot insert the data.
    const fieldMap = new Map<string, Field>(
      collectionInfo.schema.fields
        .filter(v => !v.is_primary_key || !v.autoID)
        .map(v => [
          v.name,
          {
            name: v.name,
            type: v.data_type, // milvus return string here
            elementType: v.element_type,
            dim: Number(findKeyValue(v.type_params, 'dim')),
            data: [], // values container
          },
        ])
    );

    // dynamic field is enabled, create $meta field
    const isDynamic = collectionInfo.schema.enable_dynamic_field;
    if (isDynamic) {
      fieldMap.set(DEFAULT_DYNAMIC_FIELD, {
        name: DEFAULT_DYNAMIC_FIELD,
        type: 'JSON',
        elementType: 'None',
        data: [], // value container
      });
    }

    // Loop through each row and set the corresponding field values in the Map.
    data.fields_data.forEach((rowData, rowIndex) => {
      // if support dynamic field, all field not in the schema would be grouped to a dynamic field
      rowData = isDynamic
        ? buildDynamicRow(rowData, fieldMap, DEFAULT_DYNAMIC_FIELD)
        : rowData;

      // get each fieldname from the row object
      const fieldNames = Object.keys(rowData);
      // go through each fieldname and encode or format data
      fieldNames.forEach(name => {
        const field = fieldMap.get(name);
        if (!field) {
          throw new Error(
            `${ERROR_REASONS.INSERT_CHECK_WRONG_FIELD} ${rowIndex}`
          );
        }
        if (
          DataTypeMap[field.type] === DataType.BinaryVector &&
          (rowData[name] as Vectors).length !== field.dim! / 8
        ) {
          throw new Error(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
        }

        // build field data
        switch (DataTypeMap[field.type]) {
          case DataType.BinaryVector:
          case DataType.FloatVector:
            field.data = field.data.concat(buildFieldData(rowData, field));
            break;
          default:
            field.data[rowIndex] = buildFieldData(rowData, field);
            break;
        }
      });
    });

    // The actual data we pass to Milvus gRPC.
    const params = { ...data, num_rows: data.fields_data.length };

    // transform data from map to array, milvus grpc params
    params.fields_data = Array.from(fieldMap.values()).map(field => {
      // milvus return string for field type, so we define the DataTypeMap to the value we need.
      // but if milvus change the string, may cause we cant find value.
      const type = DataTypeMap[field.type];
      const key = this.vectorTypes.includes(type) ? 'vectors' : 'scalars';
      const dataKey = getDataKey(type);
      const elementType = DataTypeMap[field.elementType!];
      const elementTypeKey = getDataKey(elementType);

      return {
        type,
        field_name: field.name,
        is_dynamic: field.name === DEFAULT_DYNAMIC_FIELD,
        [key]:
          type === DataType.FloatVector
            ? {
                dim: field.dim,
                [dataKey]: {
                  data: field.data,
                },
              }
            : type === DataType.BinaryVector
            ? {
                dim: field.dim,
                [dataKey]: parseBinaryVectorToBytes(
                  field.data as BinaryVectors
                ),
              }
            : type === DataType.Array
            ? {
                [dataKey]: {
                  data: field.data.map(d => {
                    return {
                      [elementTypeKey]: {
                        type: elementType,
                        data: d,
                      },
                    };
                  }),
                  element_type: elementType,
                },
              }
            : {
                [dataKey]: {
                  data: field.data,
                },
              },
      };
    });

    // if timeout is not defined, set timeout to 0
    const timeout = typeof data.timeout === 'undefined' ? 0 : data.timeout;
    // execute Insert
    const promise = await promisify(
      this.channelPool,
      upsert ? 'Upsert' : 'Insert',
      params,
      timeout
    );

    return promise;
  }

  /**
   * Delete entities in a Milvus collection.
   *
   * @param {DeleteEntitiesReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.partition_name] - The name of the partition (optional).
   * @param {string} data.expr - Boolean expression used to filter entities for deletion.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<MutationResult>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {number[]} IDs - ID array of the successfully deleted data.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.deleteEntities({
   *    collection_name: 'my_collection',
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
      this.channelPool,
      'Delete',
      data,
      data.timeout || this.timeout
    );
    return promise;
  }

  /**
   * Delete entities in a Milvus collection.
   *
   * @param {DeleteReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} [data.partition_name] - The name of the partition (optional).
   * @param {(string[] | number[])} [data.ids] - IDs of the entities to delete.
   * @param {string} [data.filter] - Filter expression, takes precedence over ids.
   * @param {string} [data.expr] - equals to data.filter.
   * @param {number} [data.timeout] - Optional duration of time in milliseconds to allow for the RPC. If undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<MutationResult>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {number[]} IDs - Array of IDs of the successfully deleted entities.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.delete({
   *    collection_name: 'my_collection',
   *    filter: 'id in [1,2,3,4]'
   *  });
   * ```
   *
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const resStatus = await milvusClient.delete({
   *    collection_name: 'my_collection',
   *    ids: [1,2,3,4]
   *  });
   * ```
   */
  async delete(data: DeleteReq): Promise<MutationResult> {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }

    const pkField = await this.getPkFieldName(data);
    const pkFieldType = await this.getPkFieldType(data);

    let expr = '';

    // generate expr by different type of pk
    if ((data as DeleteByIdsReq).ids) {
      expr =
        DataTypeMap[pkFieldType] === DataType.VarChar
          ? `${pkField} in ["${(data as DeleteByIdsReq).ids.join('","')}"]`
          : `${pkField} in [${(data as DeleteByIdsReq).ids.join(',')}]`;
    }

    // if filter exist use filter;
    if ((data as DeleteByFilterReq).filter) {
      expr = (data as DeleteByFilterReq).filter;
    }
    const req = { ...data, expr };
    return this.deleteEntities(req);
  }

  /**
   * Perform vector similarity search in a Milvus collection.
   *
   * @param {SearchReq | SearchSimpleReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {Number[]} data.vector - Original vector to search with.
   * @param {string[]} [data.partition_names] - Array of partition names (optional).
   * @param {number} [data.topk] - Topk (optional).
   * @param {number} [data.limit] - Alias for topk (optional).
   * @param {number} [data.offset] - Offset (optional).
   * @param {string} [data.filter] - Scalar field filter expression (optional).
   * @param {string[]} [data.output_fields] - Support scalar field (optional).
   * @param {object} [data.params] - Search params (optional).
   * @returns {Promise<SearchResults>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {{score:number,id:string, [outputfield]: value}[]} results - Array of search results.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const searchResults = await milvusClient.search({
   *    collection_name: 'my_collection',
   *    vector: [1, 2, 3, 4],
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
        cache: true,
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
        metric_type: (data as SearchSimpleReq).metric_type || '', // leave it empty
        params: JSON.stringify((data as SearchSimpleReq).params || {}),
        ignore_growing: (data as SearchSimpleReq).ignore_growing || false,
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

      // get collection's consistency level
      const collection_consistency_level = collectionInfo.consistency_level;

      const promise: SearchRes = await promisify(
        this.channelPool,
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
          consistency_level:
            data.consistency_level || collection_consistency_level,
        },
        data.timeout || this.timeout
      );

      // if search failed
      // if nothing returned
      // return empty with status
      if (
        promise.status.error_code !== ErrorCode.SUCCESS ||
        promise.results.scores.length === 0
      ) {
        return {
          status: promise.status,
          results: [],
        };
      }

      // build final results array
      const results: any[] = [];
      const { topks, scores, fields_data, ids } = promise.results;
      // build fields data map
      const fieldsDataMap = buildFieldDataMap(fields_data);
      // build output name array
      const output_fields = [
        'id',
        ...(!!promise.results.output_fields?.length
          ? promise.results.output_fields
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

      return {
        status: promise.status,
        // if only searching 1 vector, return the first object of results array
        results: searchVectors.length === 1 ? results[0] || [] : results,
      };
    } catch (err) {
      /* istanbul ignore next */
      throw new Error(err);
    }
  }

  getQueryIteratorExpr(params: {
    expr: string;
    pkField: FieldSchema;
    page: number;
    pageCache: Map<
      number,
      { firstPKId: number | string; lastPKId: number | string }
    >;
  }) {
    // get params
    const { expr, page, pageCache, pkField } = params;

    // get cache
    const cache = pageCache.get(page - 1);

    // format pk value
    const formatPKValue = (pkId: string | number) =>
      pkField?.data_type === DataTypeStringEnum.VarChar ? `'${pkId}'` : pkId;

    // If cache does not exist, return expression based on primaryKey type
    let iteratorExpr = '';
    if (!cache) {
      // get default value
      const defaultValue =
        pkField?.data_type === DataTypeStringEnum.VarChar
          ? "''"
          : `${MIN_INT64}`;
      iteratorExpr = `${pkField?.name} > ${defaultValue}`;
    } else {
      // get last and first pk id
      const { lastPKId } = cache;
      const lastPKValue = formatPKValue(lastPKId);

      // build expr, get next page if (page > currentPage)
      iteratorExpr = `(${pkField?.name} > ${lastPKValue})`;
    }

    // return expr combined with iteratorExpr
    return expr ? `${expr} && ${iteratorExpr}` : iteratorExpr;
  }

  /**
   * Executes a query and returns an async iterator that allows iterating over the results in batches.
   *
   * @param {QueryIteratorReq} data - The query iterator request data.
   * @returns {Promise<any>} - An async iterator that yields batches of query results.
   * @throws {Error} - If an error occurs during the query execution.
   *
   * @example
   * const queryData = {
   *   collection_name: 'my_collection',
   *   expr: 'age > 30',
   *   limit: 100,
   *   pageSize: 10
   * };
   *
   * const iterator = await queryIterator(queryData);
   *
   * for await (const batch of iterator) {
   *   console.log(batch); // Process each batch of query results
   * }
   */
  async queryIterator(data: QueryIteratorReq): Promise<any> {
    // get collection info
    const pkField = await this.getPkField(data);
    // store client;
    const client = this;
    // expr
    const expr = data.expr || data.filter || '';
    // get count
    const count = await client.count({
      collection_name: data.collection_name,
      expr: expr,
    });
    // total should be the minimum of total and count
    let total = data.limit > count.data ? count.data : data.limit;

    // return iterator
    return {
      pageSize: data.pageSize,
      page: 0,
      expr: expr,
      localCache: new Map(),
      total: total,
      [Symbol.asyncIterator]() {
        return {
          pageSize: this.pageSize,
          page: this.page,
          expr: this.expr,
          localCache: this.localCache,
          total: this.total,
          async next() {
            // set limit for current batch
            (data as SearchSimpleReq).limit = this.pageSize;

            // get current page expr
            data.expr = client.getQueryIteratorExpr({
              page: this.page,
              expr: this.expr,
              pkField,
              pageCache: this.localCache,
            });

            // search data
            const res = await client.query(data);

            // get first item of the data
            const firstItem = res.data[0];
            // get first pk id
            const firstPKId: string | number =
              firstItem && firstItem[pkField.name];
            // get last item of the data
            const lastItem = res.data[res.data.length - 1];
            // get last pk id
            const lastPKId: string | number =
              lastItem && lastItem[pkField.name];

            // store pk id in the cache with the page number
            if (lastItem) {
              this.localCache.set(this.page, {
                lastPKId,
                firstPKId,
              });
            }

            if (this.page * this.pageSize >= this.total) {
              return { done: true, value: res.data };
            } else {
              this.page++;
              return { done: false, value: res.data };
            }
          },
        };
      },
    };
  }

  /**
   * Flushes the newly inserted vectors that are temporarily buffered in the cache to the object storage.
   * This is an asynchronous function and may take some time to execute deponds on your data size.
   *
   * @param {FlushReq} data - The request parameters.
   * @param {string[]} data.collection_names - Array of collection names.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<FlushResult>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const flushStatus = await milvusClient.flush({
   *    collection_names: ['my_collection'],
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
      this.channelPool,
      'Flush',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * This function is similar to the `flush` function, but it is synchronous.
   * This ensures that the flush operation is completed before the function returns.
   *
   * @param {FlushReq} data - The request parameters.
   * @param {string[]} data.collection_names - Array of collection names.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetFlushStateResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const flushSyncStatus = await milvusClient.flushSync({
   *    collection_names: ['my_collection'],
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
      this.channelPool,
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
   * Query vector data in Milvus. Current release of Milvus only supports expression as fieldname in [id1,id2,id3].
   *
   * @param {QueryReq} data - The request parameters.
   * @param {string} data.collection_name - Collection name.
   * @param {string[]} [data.ids] - IDs to get.
   * @param {string} [data.expr] - Scalar field filter expression.
   * @param {string} [data.filter] - Equals to data.expr.
   * @param {string[]} [data.partitions_names] - Array of partition names (optional).
   * @param {string[]} data.output_fields - Vector or scalar field to be returned.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   * @param {{key: value}[]} [data.params] - An optional key pair json array.
   *
   * @returns {Promise<QueryResults>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {{field_name: value}[]} data - Data of all fields that you defined in `output_fields`.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const queryResults = await milvusClient.query({
   *    collection_name: 'my_collection',
   *    filter: "age in [1,2,3,4,5,6,7,8]",
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

    // id in expression
    let primaryKeyInIdsExpression = '';

    // if we have ids
    if (data.ids && data.ids.length > 0) {
      const pkField = await this.getPkFieldName(data);
      const pkFieldType = await this.getPkFieldType(data);

      // generate expr by different type of pk
      primaryKeyInIdsExpression =
        DataTypeMap[pkFieldType] === DataType.VarChar
          ? `${pkField} in ["${data.ids.join('","')}"]`
          : `${pkField} in [${data.ids.join(',')}]`;
    }

    // filter > expr or empty > ids
    data.expr = data.filter || data.expr || primaryKeyInIdsExpression;

    // Execute the query and get the results
    const promise: QueryRes = await promisify(
      this.channelPool,
      'Query',
      {
        ...data,
        query_params: parseToKeyValue({ ...limits, ...offset }),
      },
      data.timeout || this.timeout
    );

    // always get output_fields from fields_data
    const output_fields = promise.fields_data.map(f => f.field_name);

    const fieldsDataMap = buildFieldDataMap(promise.fields_data);

    // For each output field, check if it has a fixed schema or not
    const fieldDataContainer = output_fields.map(field_name => {
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
        data: isFixedSchema ? data : data!.map(d => d[field_name]),
        field_name,
      };
    });

    // Initialize an array to hold the query results
    let results: RowData[] = [];

    // parse column data to [{fieldname:value}]
    results = fieldDataContainer.reduce<RowData[]>((acc, v) => {
      v.data!.forEach((d, i: number) => {
        acc[i] = {
          ...acc[i],
          [v.field_name]: d,
        };
      });
      return acc;
    }, []);

    return {
      status: promise.status,
      data: results,
    };
  }

  async count(data: CountReq): Promise<CountResult> {
    const queryResult = await this.query({
      collection_name: data.collection_name,
      expr: data.expr || '',
      output_fields: [DEFAULT_COUNT_QUERY_STRING],
    });

    return {
      status: queryResult.status,
      data: Number(queryResult.data[0][DEFAULT_COUNT_QUERY_STRING]),
    };
  }

  /**
   * Retrieve vector data by providing IDs in Milvus.
   *
   * @param {GetReq} data - The request parameters.
   * @param {string} data.collection_name - Collection name.
   * @param {string[]} data.ids - IDs to get.
   * @param {string[]} [data.partitions_names] - Array of partition names (optional).
   * @param {string[]} data.output_fields - Vector or scalar field to be returned.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   * @param {{key: value}[]} [data.params] - An optional key pair json array.
   *
   * @returns {Promise<QueryResults>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {{field_name: value}[]} data - Data of all fields that you defined in `output_fields`.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const getResults = await milvusClient.get({
   *    collection_name: 'my_collection',
   *    ids: ['1','2','3','4','5','6','7','8'],
   *    output_fields: ["age"],
   *  });
   * ```
   */
  async get(data: GetReq): Promise<QueryResults> {
    return this.query(data);
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
      this.channelPool,
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
   * Get the flush state of specified segment IDs in Milvus.
   *
   * @param {GetFlushStateReq} data - The request parameters.
   * @param {number[]} data.segmentIDs - The segment IDs.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetFlushStateResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {boolean[]} flushed - Array indicating whether each segment is flushed or not.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const flushState = await milvusClient.getFlushState({
   *    segmentIDs: [1,2,3,4],
   *  });
   * ```
   */
  async getFlushState(data: GetFlushStateReq): Promise<GetFlushStateResponse> {
    if (!data || !data.segmentIDs) {
      throw new Error(ERROR_REASONS.GET_FLUSH_STATE_CHECK_PARAMS);
    }
    const res = await promisify(
      this.channelPool,
      'GetFlushState',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Perform a load balancing operation from a source query node to destination query nodes.
   * This function only works in a Milvus cluster.
   *
   * @param {LoadBalanceReq} data - The request parameters.
   * @param {number} data.src_nodeID - The source query node id to balance.
   * @param {number[]} [data.dst_nodeIDs] - The destination query node ids to balance (optional).
   * @param {number[]} [data.sealed_segmentIDs] - Sealed segment ids to balance (optional).
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ResStatus>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {SegmentInfo[]} infos - Information about the segments.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const loadBalanceStatus = await milvusClient.loadBalance({
   *    src_nodeID: 31,
   *  });
   * ```
   */
  async loadBalance(data: LoadBalanceReq): Promise<ResStatus> {
    if (!data || !data.src_nodeID) {
      throw new Error(ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS);
    }
    const res = await promisify(
      this.channelPool,
      'LoadBalance',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Notifies Proxy to return segments information from query nodes.
   *
   * @param {GetQuerySegmentInfoReq} data - The request parameters.
   * @param {string} data.collectionName - The name of the collection to get segments info.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetQuerySegmentInfoResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {QuerySegmentInfo[]} infos - The growing segments' information in query cluster.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const querySegmentInfo = await milvusClient.getQuerySegmentInfo({
   *    collectionName: 'my_collection',
   *  });
   * ```
   */
  async getQuerySegmentInfo(
    data: GetQuerySegmentInfoReq
  ): Promise<GetQuerySegmentInfoResponse> {
    if (!data || !data.collectionName) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.channelPool,
      'GetQuerySegmentInfo',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Notifies Proxy to return segments information from data nodes.
   *
   * @param {GetPersistentSegmentInfoReq} data - The request parameters.
   * @param {string} data.collectionName - The name of the collection to get segments info.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<GetPersistentSegmentInfoResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {PersistentSegmentInfo[]} infos - The growing segments' information in data cluster.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const persistentSegmentInfo = await milvusClient.getPersistentSegmentInfo({
   *    collectionName: 'my_collection',
   *  });
   * ```
   */
  async getPersistentSegmentInfo(
    data: GePersistentSegmentInfoReq
  ): Promise<GePersistentSegmentInfoResponse> {
    if (!data || !data.collectionName) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
    const res = await promisify(
      this.channelPool,
      'GetPersistentSegmentInfo',
      data,
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * Import data from files.
   *
   * @param {ImportReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string[]} data.files - Array of file paths.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ImportResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string[]} tasks - Array of task IDs.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const importResponse = await milvusClient.bulkInsert({
   *    collection_name: 'my_collection',
   *    files: ['path-to-data-file.json'],
   *  });
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
      this.channelPool,
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
   * List import tasks.
   *
   * @param {ListImportTasksReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number} [data.limit] - Optional, maximum number of tasks returned, list all tasks if the value is 0.
   * @param {number} [data.timeout] - An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
   * @returns {Promise<ListImportTasksResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {string} state - Import state.
   * @returns {number} row_count - How many rows to import.
   * @returns {string[]} id_list - ID lists.
   * @returns {string} collection_id - Collection to be imported to.
   * @returns {string[]} tasks - TaskId array.
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const listImportTasksResponse = await milvusClient.listImportTasks({
   *    collection_name: 'my_collection',
   *  });
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
      this.channelPool,
      'ListImportTasks',
      {
        ...data,
        limit: data.limit || 0,
      },
      data.timeout || this.timeout
    );
    return res;
  }

  /**
   * List indexed segments.
   *
   * @param {ListIndexedSegmentReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {string} data.index_name - The name of the collection's index.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<ListIndexedSegmentResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {number[]} segmentIDs - Segment IDs.
   *
   * @throws {Error} if `collection_name` property is not present in `data`
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const indexedSegments = await milvusClient.listIndexedSegment({
   *    collection_name: 'my_collection',
   *    index_name: 'my_index',
   *  });
   * ```
   */
  // async listIndexedSegment(
  //   data: ListIndexedSegmentReq
  // ): Promise<ListIndexedSegmentResponse> {
  //   if (!data || !data.collection_name) {
  //     throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
  //   }

  //   const res = await promisify(
  //     this.channelPool,
  //     'ListIndexedSegment',
  //     data,
  //     data.timeout || this.timeout
  //   );
  //   return res;
  // }

  /**
   * Describe segment index data.
   *
   * @param {DescribeSegmentIndexDataReq} data - The request parameters.
   * @param {string} data.collection_name - The name of the collection.
   * @param {number[]} data.segmentsIDs - The segment IDs.
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or an error occurs. Default is undefined.
   *
   * @returns {Promise<DescribeSegmentIndexDataResponse>} The result of the operation.
   * @returns {string} status.error_code - The error code of the operation.
   * @returns {string} status.reason - The reason for the error, if any.
   * @returns {number[]} segmentIDs - Segment IDs.
   *
   * @throws {Error} if `collection_name` property is not present in `data`
   *
   * @example
   * ```
   *  const milvusClient = new milvusClient(MILUVS_ADDRESS);
   *  const segmentIndexData = await milvusClient.describeSegmentIndexData({
   *    collection_name: 'my_collection',
   *    segmentsIDs: [1,2,3,4],
   *  });
   * ```
   */
  // async describeSegmentIndexData(
  //   data: DescribeSegmentIndexDataReq
  // ): Promise<DescribeSegmentIndexDataResponse> {
  //   if (!data || !data.collection_name) {
  //     throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
  //   }

  //   const res = await promisify(
  //     this.channelPool,
  //     'DescribeSegmentIndexData',
  //     data,
  //     data.timeout || this.timeout
  //   );
  //   return res;
  // }
}

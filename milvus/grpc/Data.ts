import {
  DataType,
  VectorDataTypes,
  DataTypeMap,
  ERROR_REASONS,
  DeleteEntitiesReq,
  FlushReq,
  GetFlushStateReq,
  GetQuerySegmentInfoReq,
  GePersistentSegmentInfoReq,
  InsertReq,
  LoadBalanceReq,
  ImportReq,
  ListImportTasksReq,
  ErrorCode,
  FlushResult,
  GetFlushStateResponse,
  GetMetricsResponse,
  GetQuerySegmentInfoResponse,
  GePersistentSegmentInfoResponse,
  buildSearchRequest,
  formatSearchResult,
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
  DeleteByIdsReq,
  DeleteByFilterReq,
  QueryRes,
  SearchReq,
  SearchRes,
  SearchSimpleReq,
  SearchIteratorReq,
  DEFAULT_TOPK,
  HybridSearchReq,
  promisify,
  sleep,
  parseToKeyValue,
  checkCollectionName,
  DEFAULT_DYNAMIC_FIELD,
  buildDynamicRow,
  buildFieldDataMap,
  getDataKey,
  _Field,
  buildFieldData,
  BinaryVector,
  RowData,
  CountReq,
  CountResult,
  DEFAULT_COUNT_QUERY_STRING,
  getQueryIteratorExpr,
  QueryIteratorReq,
  getRangeFromSearchResult,
  SearchResultData,
  getPKFieldExpr,
  DEFAULT_MAX_SEARCH_SIZE,
  SparseFloatVector,
  sparseRowsToBytes,
  getSparseDim,
  f32ArrayToBinaryBytes,
  getValidDataArray,
  NO_LIMIT,
  DescribeCollectionReq,
  formatExprValues,
} from '../';
import { Collection } from './Collection';

export class Data extends Collection {
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
   * @param {{ [x: string]: any }[]} data.data - The data to be inserted. If the field type is binary, the vector data length needs to be dimension / 8.
   * @param {InsertTransformers} data.transformers - The transformers for bf16 or f16 data, it accept an f32 array, it should output f16 or bf16 bytes (optional)
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

    const describeReq = { collection_name };
    if (data.db_name) {
      (describeReq as any).db_name = data.db_name;
    }

    const collectionInfo = await this.describeCollection(describeReq);

    if (collectionInfo.status.error_code !== ErrorCode.SUCCESS) {
      throw collectionInfo;
    }

    // Tip: The field data sequence needs to be set same as `collectionInfo.schema.fields`.
    const functionOutputFields: string[] = [];
    const fieldMap = new Map<string, _Field>(
      collectionInfo.schema.fields.reduce((acc, v) => {
        // if autoID is true, ignore the primary key field or if upsert is true
        const insertable = !v.autoID || upsert;

        //  if function field is set, you need to ignore the field value in the data.
        if (v.is_function_output) {
          functionOutputFields.push(v.name); // ignore function field
        } else if (insertable) {
          acc.push([
            v.name,
            {
              name: v.name,
              type: v.data_type, // milvus return string here
              elementType: v.element_type,
              dim: Number(v.dim),
              data: [], // values container
              nullable: v.nullable,
              default_value: v.default_value,
            },
          ]);
        }
        return acc;
      }, [] as [string, _Field][])
    );

    // dynamic field is enabled, create $meta field
    const isDynamic = collectionInfo.schema.enable_dynamic_field;
    if (isDynamic) {
      fieldMap.set(DEFAULT_DYNAMIC_FIELD, {
        name: DEFAULT_DYNAMIC_FIELD,
        type: 'JSON',
        elementType: 'None',
        data: [], // value container
        nullable: false,
      });
    }

    // Loop through each row and set the corresponding field values in the Map.
    data.fields_data.forEach((rowData, rowIndex) => {
      // if support dynamic field, all field not in the schema would be grouped to a dynamic field
      rowData = isDynamic
        ? buildDynamicRow(
            rowData,
            fieldMap,
            DEFAULT_DYNAMIC_FIELD,
            functionOutputFields
          )
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
          (rowData[name] as BinaryVector).length !== field.dim! / 8
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
            field.data[rowIndex] = buildFieldData(
              rowData,
              field,
              data.transformers
            );
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
      const key = VectorDataTypes.includes(type) ? 'vectors' : 'scalars';
      const dataKey = getDataKey(type);
      const elementType = DataTypeMap[field.elementType!];
      const elementTypeKey = getDataKey(elementType);

      // check if need valid data
      const needValidData =
        key !== 'vectors' &&
        (field.nullable === true ||
          (typeof field.default_value !== 'undefined' &&
            field.default_value !== null));

      // get valid data
      const valid_data = needValidData
        ? getValidDataArray(field.data, data.fields_data?.length!)
        : [];

      // build key value
      let keyValue;
      switch (type) {
        case DataType.FloatVector:
          keyValue = {
            dim: field.dim,
            [dataKey]: {
              data: field.data,
            },
          };
          break;
        case DataType.BFloat16Vector:
        case DataType.Float16Vector:
          keyValue = {
            dim: field.dim,
            [dataKey]: Buffer.concat(field.data as Buffer[]),
          };
          break;
        case DataType.BinaryVector:
          keyValue = {
            dim: field.dim,
            [dataKey]: f32ArrayToBinaryBytes(field.data as BinaryVector),
          };
          break;
        case DataType.SparseFloatVector:
          const dim = getSparseDim(field.data as SparseFloatVector[]);
          keyValue = {
            dim,
            [dataKey]: {
              dim,
              contents: sparseRowsToBytes(field.data as SparseFloatVector[]),
            },
          };
          break;
        case DataType.Array:
          keyValue = {
            [dataKey]: {
              data: field.data
                .filter(v => v !== undefined)
                .map(d => {
                  return {
                    [elementTypeKey]: {
                      type: elementType,
                      data: d,
                    },
                  };
                }),
              element_type: elementType,
            },
          };
          break;
        default:
          keyValue = {
            [dataKey]: {
              data: field.data.filter(v => v !== undefined),
            },
          };
          break;
      }

      return {
        type,
        field_name: field.name,
        is_dynamic: field.name === DEFAULT_DYNAMIC_FIELD,
        [key]: keyValue,
        valid_data: valid_data,
      };
    });

    // if timeout is not defined, set timeout to 0
    const timeout = typeof data.timeout === 'undefined' ? 0 : data.timeout;
    // delete data
    try {
      delete params.data;
    } catch (e) {}
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
   * @param {string} [data.consistency_level] - The consistency level of the new collection. Can be "Strong" (Milvus default), "Session", "Bounded", "Eventually", or "Customized".
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

    const req = data as any;

    // if exprValues exist, format it
    if (data.exprValues) {
      req.expr_template_values = formatExprValues(data.exprValues);
    }

    const promise = await promisify(
      this.channelPool,
      'Delete',
      req,
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
   * @param {string} [data.consistency_level] - The consistency level of the new collection. Can be "Strong" (Milvus default), "Session", "Bounded", "Eventually", or "Customized".
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
    const req = { ...data, expr } as any;

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
   * @param {OutputTransformers} data.transformers - The transformers for bf16 or f16 data, it accept bytes or sparse dic vector, it can ouput f32 array or other format(optional)
   * @param {number} [data.timeout] - An optional duration of time in milliseconds to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined.
   *
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
  async search(
    data: SearchReq | SearchSimpleReq | HybridSearchReq
  ): Promise<SearchResults> {
    // default collection request
    const describeCollectionRequest = {
      collection_name: data.collection_name,
      cache: true,
    } as DescribeCollectionReq;

    // get collection info
    if (data.db_name) {
      // if the request has `db_name` pass it to the request.
      describeCollectionRequest.db_name = data.db_name;
    }

    const collectionInfo = await this.describeCollection(
      describeCollectionRequest
    );

    // build search params
    const { request, nq, round_decimal, isHybridSearch } = buildSearchRequest(
      data,
      collectionInfo,
      this.milvusProto
    );

    // if db_name exist, pass it to the request
    if (data.db_name) {
      (request as any).db_name = data.db_name;
    }

    // execute search
    const originSearchResult: SearchRes = await promisify(
      this.channelPool,
      isHybridSearch ? 'HybridSearch' : 'Search',
      request,
      data.timeout || this.timeout
    );

    // if search failed
    // if nothing returned
    // return empty with status
    if (
      originSearchResult.status.error_code !== ErrorCode.SUCCESS ||
      originSearchResult.results.scores.length === 0
    ) {
      return {
        status: originSearchResult.status,
        results: [],
        recalls: [],
      };
    }

    // build final results array
    const results = formatSearchResult(originSearchResult, {
      round_decimal,
      transformers: data.transformers,
    });

    return {
      status: originSearchResult.status,
      // nq === 1, return the first object of results array
      results: nq === 1 ? results[0] || [] : results,
      recalls: originSearchResult.results.recalls,
    };
  }

  // async searchIterator(data: SearchIteratorReq): Promise<any> {
  //   // store client
  //   const client = this;
  //   // get collection info
  //   const pkField = await this.getPkField(data);
  //   // get available count
  //   const count = await client.count({
  //     collection_name: data.collection_name,
  //     expr: data.expr || data.filter || '',
  //   });
  //   // make sure limit is not exceed the total count
  //   const total = data.limit > count.data ? count.data : data.limit;
  //   // make sure batch size is  exceed the total count
  //   let batchSize = data.batchSize > total ? total : data.batchSize;
  //   // make sure batch size is not exceed max search size
  //   batchSize =
  //     batchSize > DEFAULT_MAX_SEARCH_SIZE ? DEFAULT_MAX_SEARCH_SIZE : batchSize;

  //   // init expr
  //   const initExpr = data.expr || data.filter || '';
  //   // init search params object
  //   data.params = data.params || {};
  //   data.limit = batchSize;

  //   // user range filter set
  //   const initRadius = Number(data.params.radius) || 0;
  //   const initRangeFilter = Number(data.params.range_filter) || 0;
  //   // range params object
  //   const rangeFilterParams = {
  //     radius: initRadius,
  //     rangeFilter: initRangeFilter,
  //     expr: initExpr,
  //   };

  //   // force quite if true, at first, if total is 0, return done
  //   let done = total === 0;
  //   // batch result store
  //   let lastBatchRes: SearchResultData[] = [];

  //   // build cache
  //   const cache = await client.search({
  //     ...data,
  //     limit: total > DEFAULT_MAX_SEARCH_SIZE ? DEFAULT_MAX_SEARCH_SIZE : total,
  //   });

  //   return {
  //     currentTotal: 0,
  //     [Symbol.asyncIterator]() {
  //       return {
  //         currentTotal: this.currentTotal,
  //         async next() {
  //           // check if reach the limit
  //           if (
  //             (this.currentTotal >= total && this.currentTotal !== 0) ||
  //             done
  //           ) {
  //             return { done: true, value: lastBatchRes };
  //           }

  //           // batch result container
  //           const batchRes: SearchResultData[] = [];
  //           const bs =
  //             this.currentTotal + batchSize > total
  //               ? total - this.currentTotal
  //               : batchSize;

  //           // keep getting search data if not reach the batch size
  //           while (batchRes.length < bs) {
  //             // search results container
  //             let searchResults: SearchResults = {
  //               status: { error_code: 'SUCCESS', reason: '' },
  //               results: [],
  //             };

  //             // Iterate through the cached data, adding it to the search results container until the batch size is reached.
  //             if (cache.results.length > 0) {
  //               while (
  //                 cache.results.length > 0 &&
  //                 searchResults.results.length < bs
  //               ) {
  //                 searchResults.results.push(cache.results.shift()!);
  //               }
  //             } else if (searchResults.results.length < bs) {
  //               // build search params, overwrite range filter
  //               if (rangeFilterParams.radius && rangeFilterParams.rangeFilter) {
  //                 data.params = {
  //                   ...data.params,
  //                   radius: rangeFilterParams.radius,
  //                   range_filter:
  //                     rangeFilterParams.rangeFilter,
  //                 };
  //               }
  //               // set search expr
  //               data.expr = rangeFilterParams.expr;

  //               console.log('search param', data.params, data.expr);

  //               // iterate search, if no result, double the radius, until we doubled for 5 times
  //               let newSearchRes = await client.search(data);
  //               let retry = 0;
  //               while (newSearchRes.results.length === 0 && retry < 5) {
  //                 newSearchRes = await client.search(data);
  //                 if (searchResults.results.length === 0) {
  //                   const newRadius = rangeFilterParams.radius * 2;

  //                   data.params = {
  //                     ...data.params,
  //                     radius: newRadius,
  //                   };
  //                 }

  //                 retry++;
  //               }

  //               // combine search results
  //               searchResults.results = [
  //                 ...searchResults.results,
  //                 ...newSearchRes.results,
  //               ];
  //             }

  //             console.log('return', searchResults.results);

  //             // filter result, batchRes should be unique
  //             const filterResult = searchResults.results.filter(
  //               r =>
  //                 !lastBatchRes.some(l => l.id === r.id) &&
  //                 !batchRes.some(c => c.id === r.id)
  //             );

  //             // fill filter result to batch result, it should not exceed the batch size
  //             for (let i = 0; i < filterResult.length; i++) {
  //               if (batchRes.length < bs) {
  //                 batchRes.push(filterResult[i]);
  //               }
  //             }

  //             // get data range about last batch result
  //             const resultRange = getRangeFromSearchResult(filterResult);

  //             console.log('result range', resultRange);

  //             // if no more result, force quite
  //             if (resultRange.lastDistance === 0) {
  //               done = true;
  //               return { done: false, value: batchRes };
  //             }

  //             // update next range and expr
  //             rangeFilterParams.rangeFilter = resultRange.lastDistance;
  //             rangeFilterParams.radius =
  //               rangeFilterParams.radius + resultRange.radius;
  //             rangeFilterParams.expr = getPKFieldExpr({
  //               pkField,
  //               value: resultRange.id as string,
  //               expr: initExpr,
  //             });

  //             console.log('last', rangeFilterParams);
  //           }

  //           // store last result
  //           lastBatchRes = batchRes;

  //           // update current total
  //           this.currentTotal += batchRes.length;

  //           // return batch result
  //           return { done: false, value: batchRes };
  //         },
  //       };
  //     },
  //   };
  // }

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
    const userExpr = data.expr || data.filter || '';
    // get count
    const count = await client.count({
      collection_name: data.collection_name,
      expr: userExpr,
    });
    // if limit not set, set it to count
    if (!data.limit || data.limit === NO_LIMIT) {
      data.limit = count.data;
    }
    // total should be the minimum of total and count
    const total = data.limit > count.data ? count.data : data.limit;
    const batchSize =
      data.batchSize > DEFAULT_MAX_SEARCH_SIZE
        ? DEFAULT_MAX_SEARCH_SIZE
        : data.batchSize;

    // local variables
    let expr = userExpr;
    let lastBatchRes: Record<string, any> = [];
    let lastPKId: string | number = '';
    let currentBatchSize = batchSize; // Store the current batch size

    // return iterator
    return {
      currentTotal: 0,
      [Symbol.asyncIterator]() {
        return {
          currentTotal: this.currentTotal,
          async next() {
            // if reach the limit, return done
            if (this.currentTotal >= total) {
              return { done: true, value: lastBatchRes };
            }
            // set limit for current batch
            data.limit = currentBatchSize; // Use the current batch size

            // get current page expr
            data.expr = getQueryIteratorExpr({
              expr: expr,
              pkField,
              lastPKId,
            });

            // search data
            const res = await client.query(data as QueryReq);

            // get last item of the data
            const lastItem = res.data[res.data.length - 1];
            // update last pk id
            lastPKId = lastItem && lastItem[pkField.name];

            // store last batch result
            lastBatchRes = res.data;
            // update current total
            this.currentTotal += lastBatchRes.length;
            // Update the current batch size based on remaining data
            currentBatchSize = Math.min(batchSize, total - this.currentTotal);
            return { done: false, value: lastBatchRes };
          },
        };
      },
    };
  }
  // alias
  hybridSearch = this.search;

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
   * @param {{key: value}[]} [data.params] - An optional key pair json array of search parameters.
   * @param {OutputTransformers} data.transformers - The transformers for bf16 or f16 data, it accept bytes or sparse dic vector, it can ouput f32 array or other format(optional)
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

    // if exprValues exist, format it
    if (data.exprValues) {
      (data as any).expr_template_values = formatExprValues(data.exprValues);
    }

    // Execute the query and get the results
    const promise: QueryRes = await promisify(
      this.channelPool,
      'Query',
      {
        ...data,
        output_fields: data.output_fields || ['*'],
        query_params: parseToKeyValue({ ...limits, ...offset }),
      },
      data.timeout || this.timeout
    );

    // always get output_fields from fields_data
    const output_fields = promise.fields_data.map(f => f.field_name);

    // build field data map
    const fieldsDataMap = buildFieldDataMap(
      promise.fields_data,
      data.transformers
    );

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
    const req: any = {
      collection_name: data.collection_name,
      expr: data.expr || '',
      output_fields: [DEFAULT_COUNT_QUERY_STRING],
    };

    if (data.db_name) {
      req.db_name = data.db_name;
    }
    const queryResult = await this.query(req);

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

import protobuf from 'protobufjs';
import { promisify } from '../utils';
import { Client } from './Client';
import { Collection } from './Collection';
import { ERROR_REASONS } from './const/ErrorReason';

import { DataType, DataTypeMap, DslType } from './types/Common';
import {
  CalcDistanceReq,
  DeleteEntitiesReq,
  FlushReq,
  GetFlushStateReq,
  GetQuerySegmentInfoReq,
  InsertReq,
  LoadBalanceReq,
} from './types/Data';
import {
  CalcDistanceResponse,
  ErrorCode,
  FlushResult,
  GetFlushStateResponse,
  GetMetricsResponse,
  GetQuerySegmentInfoResponse,
  MutationResult,
  QueryResults,
  ResStatus,
  SearchResults,
} from './types/Response';
import {
  GetMetricsRequest,
  QueryReq,
  QueryRes,
  SearchReq,
  SearchRes,
} from './types/Search';
import { findKeyValue, sleep } from './utils/index';
import {
  parseBinaryVectorToBytes,
  parseFloatVectorToBytes,
} from './utils/Blob';
import path from 'path';
import { formatNumberPrecision, parseToKeyValue } from './utils/Format';

const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');

export class Data extends Client {
  vectorTypes: number[];
  collectionManager: Collection;

  constructor(client: any, collectionManager: Collection) {
    super(client);
    this.vectorTypes = [DataType.BinaryVector, DataType.FloatVector];
    this.collectionManager = collectionManager;
  }

  /**
   * Insert data into Milvus.
   *
   * @param data
   *  | Property                | Type                   |           Description              |
   *  | :---------------------- | :--------------------  | :-------------------------------  |
   *  | collection_name         | String                 |       Collection name       |
   *  | partition_name(optional)| String                 |       Partition name       |
   *  | fields_data             | { [x: string]: any }[] |      If the field type is binary, the vector data length needs to be dimension / 8   |
   *  | hash_keys(optional)    | Number[]               |  The hash value depends on the primarykey value       |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | succ_index    |  Index array of the successfully inserted data      |
   *  | err_index    |   Index array of the unsuccessfully inserted data      |
   *  | IDs    |        ID array of the successfully inserted data      |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dataManager.insert({
   *    collection_name: COLLECTION_NAME,
   *    fields_data: [{
   *      vector_field: [1,2,2,4],
   *      scalar_field: 1
   *    }]
   *  });
   * ```
   */
  async insert(data: InsertReq): Promise<MutationResult> {
    this.checkCollectionName(data);
    if (
      !data.fields_data ||
      !Array.isArray(data.fields_data) ||
      !data.fields_data.length
    ) {
      throw new Error(ERROR_REASONS.INSERT_CHECK_FILEDS_DATA_IS_REQUIRED);
    }
    const { collection_name } = data;
    const collectionInfo = await this.collectionManager.describeCollection({
      collection_name,
    });

    if (collectionInfo.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(collectionInfo.status.reason);
    }

    // Tip: The field data sequence needs to be set same as `collectionInfo.schema.fields`.
    // If primarykey is set `autoid = true`, you cannot insert the data.
    const fieldsData = collectionInfo.schema.fields
      .filter(v => !v.is_primary_key || !v.autoID)
      .map(v => ({
        name: v.name,
        type: v.data_type,
        dim: Number(findKeyValue(v.type_params, 'dim')),
        value: [] as number[],
      }));

    // The actual data we pass to Milvus gRPC.
    const params: any = { ...data, num_rows: data.fields_data.length };

    // You need to parse the original row data to column data for Milvus.
    data.fields_data.forEach((v, i) => {
      // Set the key as the field name to get all names in a row.
      const fieldNames = Object.keys(v);

      fieldNames.forEach(name => {
        const target = fieldsData.find(item => item.name === name);
        if (!target) {
          throw new Error(`${ERROR_REASONS.INSERT_CHECK_WRONG_FIELD} ${i}`);
        }
        const isVector = this.vectorTypes.includes(
          DataTypeMap[target.type.toLowerCase()]
        );

        // Check if the dimension is matched when the data type is BinaryVector.
        if (
          DataTypeMap[target.type.toLowerCase()] === DataType.BinaryVector &&
          v[name].length !== target.dim / 8
        ) {
          throw new Error(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
        }

        // Value in vector field should be array. Therefore you need concat it.
        // but array.concat is slow, we need for loop to push the value one by one
        if (isVector) {
          for (let val of v[name]) {
            target.value.push(val);
          }
        } else {
          target.value[i] = v[name];
        }
      });
    });

    params.fields_data = fieldsData.map(v => {
      // milvus return string for field type, so we define the DataTypeMap to the value we need.
      // but if milvus change the string, may casue we cant find value.
      const type = DataTypeMap[v.type.toLowerCase()];
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
        default:
          throw new Error(ERROR_REASONS.INSERT_CHECK_WRONG_DATA_TYPE);
      }
      return {
        type,
        field_name: v.name,
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
      data.timeout
    );

    return promise;
  }

  /**
   * Delete entities in Milvus
   *
   * @param data
   *  | Property                | Type                   |           Description              |
   *  | :---------------------- | :--------------------  | :-------------------------------  |
   *  | collection_name         | String                 |       Collection name       |
   *  | partition_name(optional)| String                 |       Partition name       |
   *  | expr    | String        |  Boolean expression used to filter attribute.    |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | IDs    |        ID array of the successfully deleted data      |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dataManager.deleteEntities({
   *    collection_name: COLLECTION_NAME,
   *    expr: 'id in [1,2,3,4]'
   *  });
   * ```
   */
  async deleteEntities(data: DeleteEntitiesReq): Promise<MutationResult> {
    if (!data || !data.collection_name || !data.expr) {
      throw new Error(ERROR_REASONS.DELETE_PARAMS_CHECK);
    }
    const promise = await promisify(this.client, 'Delete', data, data.timeout);
    return promise;
  }

  /**
   * Perform vector similarity search.
   *
   * @param data
   *  | Property                | Type                   |           Description              |
   *  | :---------------------- | :--------------------  | :-------------------------------  |
   *  | collection_name         | String                 |        Collection name       |
   *  | partition_names(optional)| String[]              |        Array of partition names       |
   *  | expr(optional)           | String                |      Scalar field filter expression    |
   *  | search_params            | Object        |    anns_field: vector field name <br/> topk: search result counts <br/> [metric_type](https://milvus.io/docs/v2.0.0/metric.md#floating#Similarity-Metrics) <br/>params: search params   |
   *  | vectors                  | Number[][]            |  Original vector to search with  |
   *  | output_fields(optional)  | String[]              |  Support scalar field  |
   *  | vector_type              | enum                  |  Binary field -> 100, Float field -> 101  |
   *  | travel_timestamp          | number                  |  We can get timestamp after insert success. Use this timestamp we can time travel in vector search.|
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *  | results    |        {score:number,id:string}[];       |
   *
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dataManager.search({
   *   collection_name: COLLECTION_NAME,
   *   expr: "",
   *   vectors: [[1, 2, 3, 4]],
   *   search_params: {
   *     anns_field: VECTOR_FIELD_NAME,
   *     topk: "4",
   *     metric_type: "L2",
   *     params: JSON.stringify({ nprobe: 1024 }),
   *   },
   *   output_fields: ["age", "time"],
   *   vector_type: 100,
   *  });
   * ```
   */
  async search(data: SearchReq): Promise<SearchResults> {
    const root = await protobuf.load(protoPath);
    this.checkCollectionName(data);
    if (
      !data.search_params ||
      !data.search_params.anns_field ||
      !data.search_params.metric_type ||
      !data.search_params.topk ||
      !data.search_params.params
    ) {
      throw new Error(ERROR_REASONS.SEARCH_PARAMS_IS_REQUIRED);
    }
    if (!this.vectorTypes.includes(data.vector_type))
      throw new Error(ERROR_REASONS.SEARCH_MISS_VECTOR_TYPE);

    const collectionInfo = await this.collectionManager.describeCollection({
      collection_name: data.collection_name,
    });

    // anns_field is the vector field column user want to compare.
    const targetField = collectionInfo.schema.fields.find(
      v => v.name === data.search_params.anns_field
    );
    if (!targetField) {
      throw new Error(ERROR_REASONS.SEARCH_NOT_FIND_VECTOR_FIELD);
    }

    const dim = findKeyValue(targetField.type_params, 'dim');
    const vectorType = DataTypeMap[targetField.data_type.toLowerCase()];
    const dimension =
      vectorType === DataType.BinaryVector ? Number(dim) / 8 : Number(dim);

    if (!data.vectors[0] || data.vectors[0].length !== dimension) {
      throw new Error(ERROR_REASONS.SEARCH_DIM_NOT_MATCH);
    }

    // when data type is bytes , we need use protobufjs to transform data to buffer bytes.
    const PlaceholderGroup = root.lookupType(
      'milvus.proto.common.PlaceholderGroup'
    );
    // tag $0 is hard code in milvus, when dsltype is expr
    const placeholderGroupParams = PlaceholderGroup.create({
      placeholders: [
        {
          tag: '$0',
          type: data.vector_type,
          values: data.vectors.map(v =>
            data.vector_type === DataType.BinaryVector
              ? parseBinaryVectorToBytes(v)
              : parseFloatVectorToBytes(v)
          ),
        },
      ],
    });

    const placeholderGroupBytes = PlaceholderGroup.encode(
      placeholderGroupParams
    ).finish();

    const promise: SearchRes = await promisify(
      this.client,
      'Search',
      {
        ...data,
        dsl: data.expr || '',
        dsl_type: DslType.BoolExprV1,
        placeholder_group: placeholderGroupBytes,
        search_params: parseToKeyValue(data.search_params),
      },
      data.timeout
    );
    const results: any[] = [];
    /**
     *  It will decide the score precision.
     *  If round_decimal is 3, need return like 3.142
     *  And if Milvus return like 3.142, Node will add more number after this like 3.142000047683716.
     *  So the score need to slice by round_decimal
     */
    const round_decimal = data.search_params.round_decimal;
    if (promise.results) {
      /**
       *  fields_data:  what you pass in output_fields, only support non vector fields.
       *  ids: vector id array
       *  scores: distance array
       *  topks: if you use mutiple query to search , will return mutiple topk.
       * */
      const { topks, scores, fields_data, ids } = promise.results;
      const fieldsData = fields_data.map((item, i) => {
        // if search result is empty, will cause value is undefined.
        const value = item.field ? item[item.field] : undefined;
        return {
          type: item.type,
          field_name: item.field_name,
          data: value ? value[value?.data].data : '',
        };
      });
      // verctor id support int / str id.
      const idData = ids ? ids[ids.id_field]?.data : undefined;
      /**
       *  milvus support mutilple querys to search
       *  milvus will return all columns data
       *  so we need to format value to row data for easy to use
       *  topk is the key we can splice data for every search result
       */
      topks.forEach((v, index) => {
        const topk = Number(v);

        scores.splice(0, topk).forEach((score, scoreIndex) => {
          const i = index === 0 ? scoreIndex : scoreIndex + topk;
          const fixedScore =
            typeof round_decimal === 'undefined' || round_decimal === -1
              ? score
              : formatNumberPrecision(score, round_decimal);

          const result: any = {
            score: fixedScore,
            id: idData ? idData[i] : '',
          };
          fieldsData.forEach(field => {
            result[field.field_name] = field.data[i];
          });
          results.push(result);
        });
      });
    }

    return {
      status: promise.status,
      results,
    };
  }

  /**
   * Milvus temporarily buffers the newly inserted vectors in the cache. Call `flush()` to persist them to the object storage.
   * It's async function, so it's will take some times to excute.
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collection_names        | String[] |        Array of collection names      |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dataManager.flush({
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
    const res = await promisify(this.client, 'Flush', data, data.timeout);
    return res;
  }

  /**
   * It's same function as flush. But flushSync is sync function.
   * So you can ensure it's flushed after function return the result.
   *
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collection_names        | String[] |        Array of collection names      |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number, reason: string }|
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dataManager.flushSync({
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
    const res = await promisify(this.client, 'Flush', data, data.timeout);
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
   *  | Property                     | Type   |           Description              |
   *  | :--------------------------- | :----  | :-------------------------------  |
   *  | collection_name              | String |        Collection name      |
   *  | expr                         | String |       Scalar field filter expression     |
   *  | partitions_names(optional)   | String[] |       Array of partition names      |
   *  | output_fields                | String[] |       Vector or scalar field to be returned    |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-------------| :-------------------------------  |
   *  | status        |  { error_code: number,reason:string } |
   *  | data   |  Data of all fields that you defined in `output_fields`, {field_name: value}[] |
   *
   *
   * #### Example
   *
   * ```
   *  new milvusClient(MILUVS_ADDRESS).dataManager.query({
   *    collection_name: 'my_collection',
   *    expr: "age in [1,2,3,4,5,6,7,8]",
   *    output_fields: ["age"],
   *  });
   * ```
   */
  async query(data: QueryReq): Promise<QueryResults> {
    this.checkCollectionName(data);
    const promise: QueryRes = await promisify(
      this.client,
      'Query',
      data,
      data.timeout
    );
    const results: { [x: string]: any }[] = [];
    /**
     * type: DataType
     * field_name: Field name
     * field_id: enum DataType
     * field: decide the key we can use. If return 'vectors', we can use item.vectors.
     * vectors: vector data.
     * scalars: scalar data
     */
    const fieldsData = promise.fields_data.map((item, i) => {
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
        const data: number[][] = [];

        // parse number[] to number[][] by dim
        vectorValue.forEach((v, i) => {
          const index = Math.floor(i / dim);
          if (!data[index]) {
            data[index] = [];
          }
          data[index].push(v);
        });

        return {
          field_name: item.field_name,
          data,
        };
      }

      const key = item.scalars!.data;
      const scalarValue = item.scalars![key]!.data;

      return {
        field_name: item.field_name,
        data: scalarValue,
      };
    });

    // parse column data to [{fieldname:value}]
    fieldsData.forEach(v => {
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
   * @ignore
   * @param data
   *  | Property             | Type   |           Description                      |
   *  | :------------------- | :----  | :----------------------------------------  |
   *  | request              | object |        Only allow "system_info" for now    |
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
      data.timeout
    );

    return {
      ...res,
      response: JSON.parse(res.response),
    };
  }

  /**
   * @ignore
   * @param data
   */
  async calcDistance(data: CalcDistanceReq): Promise<CalcDistanceResponse> {
    const res = await promisify(
      this.client,
      'CalcDistance',
      data,
      data.timeout
    );
    return res;
  }

  /**
   * Get flush state by segment ids
   *
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | segmentIDs              | Array  |       The segment ids        |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-----------| :-------------------------------  |
   *  | status      |  { error_code: number,reason:string } |
   *  | flushed     |  segments flushed or not  |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await milvusClient.dataManager.getFlushState({
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
      data.timeout
    );
    return res;
  }

  /**
   * Do load balancing operation from source query node to destination query node.
   * Only work in cluster milvus.
   *
   * @param data
   *  | Property            | Type     |           Description              |
   *  | :-------------------| :----    | :-------------------------------  |
   *  | src_nodeID          | number   |     The source query node id to balance.        |
   *  | dst_nodeIDs         | number[] |     The destination query node ids to balance.(optional)        |
   *  | sealed_segmentIDs   | number[] |     Sealed segment ids to balance.(optional)       |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   * @return
   *  | Property    |           Description              |
   *  | :-----------| :-------------------------------  |
   *  | status      |  { error_code: number,reason:string } |
   *  | infos       |  segments infomations  |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await dataManager.loadBalance({
   *      src_nodeID: 31,
   *   });
   * ```
   */
  async loadBalance(data: LoadBalanceReq): Promise<ResStatus> {
    if (!data || !data.src_nodeID) {
      throw new Error(ERROR_REASONS.LOAD_BALANCE_CHECK_PARAMS);
    }
    const res = await promisify(this.client, 'LoadBalance', data, data.timeout);
    return res;
  }

  /**
   * Notifies Proxy to return segments information from query nodes.
   *
   * @param data
   *  | Property                | Type   |           Description              |
   *  | :---------------------- | :----  | :-------------------------------  |
   *  | collectionName          | String |      The name of the collection to get segments info.       |
   *  | timeout        | number |        An optional duration of time in millisecond to allow for the RPC. If it is set to undefined, the client keeps waiting until the server responds or error occurs. Default is undefined       |
   *
   *
   * @return
   *  | Property    |           Description              |
   *  | :-----------| :-------------------------------  |
   *  | status      |  { error_code: number,reason:string } |
   *  | infos       |  QuerySegmentInfo is the growing segments's information in query cluster.  |
   *
   *
   * #### Example
   *
   * ```
   *   const res = await dataManager.getQuerySegmentInfo({
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
      data.timeout
    );
    return res;
  }
}

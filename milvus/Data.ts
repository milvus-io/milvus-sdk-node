import protobuf from "@grpc/proto-loader/node_modules/protobufjs";
import { promisify } from "../utils";
import { Client } from "./Client";
import { Collection } from "./Collection";
import { ERROR_REASONS } from "./const/ErrorReason";

import { DataType, DataTypeMap, DslType } from "./types/Common";
import { FlushReq, InsertReq } from "./types/Insert";
import { ErrorCode, MutationResult, SearchResults } from "./types/Response";
import { QueryReq, SearchReq, SearchRes } from "./types/Search";
import { findKeyValue } from "./utils";
import {
  parseBinaryVectorToBytes,
  parseFloatVectorToBytes,
} from "./utils/Blob";
import path from "path";

const protoPath = path.resolve(__dirname, "../grpc-proto/milvus.proto");

export class Data extends Client {
  vectorTypes: number[];
  collectionManager: Collection;

  constructor(client: any, collectionManager: Collection) {
    super(client);
    this.vectorTypes = [DataType.BinaryVector, DataType.FloatVector];
    this.collectionManager = collectionManager;
  }
  /**
   * if field type is binary, the vector data length need to be dimension / 8query
   * fields_data: [{id:1,age:2,time:3,face:[1,2,3,4]}]
   *
   * hash_keys: Node sdk just pass to grpc right now. transfer primary key value to hash , let's figure out how to use it.
   * num_rows: The row length you want to insert.
   *
   * After insert data you may need flush this collection.
   */
  async insert(data: InsertReq): Promise<MutationResult> {
    const { collection_name } = data;
    const collectionInfo = await this.collectionManager.describeCollection({
      collection_name,
    });

    if (collectionInfo.status.error_code !== ErrorCode.SUCCESS) {
      throw new Error(collectionInfo.status.reason);
    }

    // Tip: The field data sequence need same with collectionInfo.schema.fields.
    // If primarykey is autoid = true, user can not insert the data
    const fieldsData = collectionInfo.schema.fields
      .filter((v) => !v.is_primary_key || !v.autoID)
      .map((v) => ({
        name: v.name,
        type: v.data_type,
        dim: Number(findKeyValue(v.type_params, "dim")),
        value: [] as number[],
      }));

    // the actual data we pass to milvus grpc
    const params: any = { ...data, num_rows: data.fields_data.length };

    // user pass data is row data, we need parse to column data for milvus
    data.fields_data.forEach((v, i) => {
      // the key need to be field name, so we get all names in a row.
      const fieldNames = Object.keys(v);

      fieldNames.forEach((name) => {
        const target = fieldsData.find((item) => item.name === name);
        if (!target) {
          throw new Error(`${ERROR_REASONS.INSERT_CHECK_WRONG_FIELD} ${i}`);
        }
        const isVector = this.vectorTypes.includes(
          DataTypeMap[target.type.toLowerCase()]
        );

        // Check dimension is match when is's BinaryVector
        if (
          DataTypeMap[target.type.toLowerCase()] === DataType.BinaryVector &&
          v[name].length !== target.dim / 8
        ) {
          throw new Error(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
        }

        // if is vector field, value should be array. so we need concat it.
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

    params.fields_data = fieldsData.map((v) => {
      // milvus return string for field type, so we define the DataTypeMap to the value we need.
      // but if milvus change the string, may casue we cant find value.
      const type = DataTypeMap[v.type.toLowerCase()];
      if (!type) {
      }
      const key = this.vectorTypes.includes(type) ? "vectors" : "scalars";
      let dataKey = "float_vector";
      switch (type) {
        case DataType.FloatVector:
          dataKey = "float_vector";
          break;
        case DataType.BinaryVector:
          dataKey = "binary_vector";
          break;
        case DataType.Double:
          dataKey = "double_data";
          break;
        case DataType.Float:
          dataKey = "float_data";
          break;
        case DataType.Int64:
          dataKey = "long_data";
          break;
        case DataType.Int32:
        case DataType.Int16:
        case DataType.Int8:
          dataKey = "int_data";
          break;
        default:
          break;
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

    const promise = await promisify(this.client, "Insert", params);

    return promise;
  }

  /**
   * We are not support dsl type in node sdk because milvus will no longer support it too.
   * @param data
   * @returns
   */
  async search(data: SearchReq): Promise<SearchResults> {
    const root = await protobuf.load(protoPath);
    if (!root) throw new Error("Missing milvus proto file");
    if (!this.vectorTypes.includes(data.vector_type))
      throw new Error(ERROR_REASONS.SEARCH_MISS_VECTOR_TYPE);

    const collectionInfo = await this.collectionManager.describeCollection({
      collection_name: data.collection_name,
    });

    // anns_field is the vector field column user want to compare.
    const vectorFieldName = findKeyValue(data.search_params, "anns_field");
    const targetField = collectionInfo.schema.fields.find(
      (v) => v.name === vectorFieldName
    );
    if (!targetField) {
      throw new Error(ERROR_REASONS.SEARCH_NOT_FIND_VECTOR_FIELD);
    }

    const dim = findKeyValue(targetField.type_params, "dim");
    const vectorType = DataTypeMap[targetField.data_type.toLowerCase()];
    const dimension =
      vectorType === DataType.BinaryVector ? Number(dim) / 8 : Number(dim);

    if (!data.vectors[0] || data.vectors[0].length !== dimension) {
      throw new Error(ERROR_REASONS.SEARCH_DIM_NOT_MATCH);
    }

    // when data type is bytes , we need use protobufjs to transform data to buffer bytes.
    const PlaceholderGroup = root.lookupType(
      "milvus.proto.milvus.PlaceholderGroup"
    );
    // tag $0 is hard code in milvus, when dsltype is expr
    const placeholderGroupParams = PlaceholderGroup.create({
      placeholders: [
        {
          tag: "$0",
          type: data.vector_type,
          values: data.vectors.map((v) =>
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

    const promise: SearchRes = await promisify(this.client, "Search", {
      ...data,
      dsl: data.expr || "",
      dsl_type: DslType.BoolExprV1,
      placeholder_group: placeholderGroupBytes,
    });
    const results: any[] = [];
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
          data: value ? value[value?.data].data : "",
        };
      });
      // verctor id support int / str id.
      const idData = ids[ids.id_field]?.data;
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
          const result: any = {
            score,
            id: idData ? idData[i] : "",
          };
          fieldsData.forEach((field) => {
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
   * After insert vector data, need flush .
   * @param data
   * @returns
   */
  async flush(data: FlushReq) {
    const res = await promisify(this.client, "Flush", data);
    return res;
  }

  /**
   * Get data by expr. Now we only support like: fieldname in [id1,id2,id3]
   * @param data
   * @returns
   */
  async getDataByExpr(data: QueryReq) {
    const promise = await promisify(this.client, "Query", data);
    return promise;
  }
}

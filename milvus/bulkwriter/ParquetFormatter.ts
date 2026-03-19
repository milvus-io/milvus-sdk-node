import * as path from 'path';
import * as fs from 'fs';
import { ParquetSchema, ParquetWriter } from '@dsnp/parquetjs';
import { DataType, convertToDataType, FieldType } from '../';
import { Formatter, BulkWriterSchema } from './Types';

const DYNAMIC_FIELD = '$meta';

/**
 * Maps a Milvus DataType to a @dsnp/parquetjs schema field definition.
 * Follows the same mapping as pymilvus ARROW_TYPE_CREATOR.
 */
function parquetFieldDef(dt: DataType): Record<string, any> {
  switch (dt) {
    case DataType.Bool:
      return { type: 'BOOLEAN' };
    case DataType.Int8:
      return { type: 'INT_8' };
    case DataType.Int16:
      return { type: 'INT_16' };
    case DataType.Int32:
      return { type: 'INT32' };
    case DataType.Int64:
      return { type: 'INT64' };
    case DataType.Float:
      return { type: 'FLOAT' };
    case DataType.Double:
      return { type: 'DOUBLE' };
    // VarChar, JSON, Geometry, Timestamptz, SparseFloatVector → UTF8 string
    case DataType.VarChar:
    case DataType.JSON:
    case DataType.Geometry:
    case DataType.Timestamptz:
    case DataType.SparseFloatVector:
      return { type: 'UTF8' };
    // Vectors → LIST of element type
    case DataType.FloatVector:
      return listOf('FLOAT');
    case DataType.BinaryVector:
    case DataType.Float16Vector:
    case DataType.BFloat16Vector:
      return listOf('UINT_8');
    case DataType.Int8Vector:
      return listOf('INT_8');
    default:
      return { type: 'UTF8' }; // fallback: JSON stringify
  }
}

/** Helper to create a LIST schema field. */
function listOf(elementType: string): Record<string, any> {
  return {
    type: 'LIST',
    fields: {
      list: {
        repeated: true,
        fields: {
          element: { type: elementType },
        },
      },
    },
  };
}

/** Create a LIST of struct schema for Array<Struct> fields. */
function listOfStruct(subFields: FieldType[]): Record<string, any> {
  const elementFields: Record<string, any> = {};
  for (const sf of subFields) {
    const sfDt = convertToDataType(sf.data_type);
    elementFields[sf.name] = parquetFieldDef(sfDt);
  }
  return {
    type: 'LIST',
    fields: {
      list: {
        repeated: true,
        fields: {
          element: {
            fields: elementFields,
          },
        },
      },
    },
  };
}

/**
 * Build a ParquetSchema from a BulkWriterSchema.
 * Matches pymilvus _deduce_arrow_schema behavior.
 */
function buildParquetSchema(schema: BulkWriterSchema): ParquetSchema {
  const schemaDef: Record<string, any> = {};
  const activeFields = schema.fields.filter(
    f => !f.autoID && !f.is_function_output
  );

  for (const field of activeFields) {
    const dt = convertToDataType(field.data_type);

    if (dt === DataType.Array) {
      const et = field.element_type
        ? convertToDataType(field.element_type)
        : null;
      if (et === DataType.Struct && field.fields) {
        // Array<Struct>
        schemaDef[field.name] = listOfStruct(field.fields);
      } else if (et !== null) {
        // Array<scalar>
        const elementDef = parquetFieldDef(et);
        schemaDef[field.name] = listOf(elementDef.type);
      } else {
        schemaDef[field.name] = { type: 'UTF8' }; // fallback
      }
    } else {
      schemaDef[field.name] = parquetFieldDef(dt);
    }
  }

  // Dynamic field column
  if (schema.enable_dynamic_field) {
    schemaDef[DYNAMIC_FIELD] = { type: 'UTF8' };
  }

  return new ParquetSchema(schemaDef);
}

/** Wrap an array as parquetjs LIST format: { list: [{ element: v }, ...] } */
function wrapList(arr: any[]): { list: { element: any }[] } {
  return { list: arr.map(v => ({ element: v })) };
}

/**
 * Normalize a value for Parquet serialization.
 * - JSON, Sparse, Timestamptz(Date) → string
 * - Vectors → LIST wrapped
 * - Float16/BFloat16 Uint8Array → LIST of uint8
 * - Int8Array → LIST of int8
 * - Array → LIST wrapped
 * - Array<Struct> → LIST of struct wrapped
 * - Int64 → BigInt
 */
function normalizeForParquet(val: any, field: FieldType, dt: DataType): any {
  if (val === null || val === undefined) return null;

  switch (dt) {
    case DataType.JSON:
      return JSON.stringify(val);

    case DataType.SparseFloatVector:
      return JSON.stringify(normalizeSparseForParquet(val));

    case DataType.Timestamptz:
      if (val instanceof Date) return val.toISOString();
      return val;

    case DataType.Geometry:
      return val;

    case DataType.Int64:
      return BigInt(val);

    case DataType.FloatVector:
      return wrapList(val);

    case DataType.BinaryVector:
      return wrapList(val);

    case DataType.Float16Vector:
    case DataType.BFloat16Vector:
      if (val instanceof Uint8Array) {
        return wrapList(Array.from(val));
      }
      // number[] → need to convert to bytes (uint8)
      // For Parquet, Float16/BFloat16 are stored as raw bytes
      return wrapList(val);

    case DataType.Int8Vector:
      if (val instanceof Int8Array) {
        return wrapList(Array.from(val));
      }
      return wrapList(val);

    case DataType.Array: {
      const et = field.element_type
        ? convertToDataType(field.element_type)
        : null;
      if (et === DataType.Struct && Array.isArray(val) && field.fields) {
        // Array<Struct> → normalize each struct's sub-field values
        const subFieldMap = new Map(field.fields.map(sf => [sf.name, sf]));
        return {
          list: val.map((item: any) => {
            const normalized: Record<string, any> = {};
            for (const [k, v] of Object.entries(item)) {
              const sf = subFieldMap.get(k);
              if (sf) {
                const sfDt = convertToDataType(sf.data_type);
                normalized[k] = normalizeForParquet(v, sf, sfDt);
              } else {
                normalized[k] = v;
              }
            }
            return { element: normalized };
          }),
        };
      }
      // Array<Int64> → elements need BigInt conversion
      if (et === DataType.Int64 && Array.isArray(val)) {
        return wrapList(val.map((v: any) => BigInt(v)));
      }
      // Array<scalar>
      if (Array.isArray(val)) {
        return wrapList(val);
      }
      return val;
    }

    // Struct as top-level field → JSON string (schema maps to UTF8)
    case DataType.Struct:
      return JSON.stringify(val);

    default:
      return val;
  }
}

/** Normalize sparse vector to dict format (same as JsonFormatter). */
function normalizeSparseForParquet(val: any): Record<string, number> {
  if (val === null || val === undefined) return val;

  if (
    !Array.isArray(val) &&
    typeof val === 'object' &&
    !('indices' in val && 'values' in val)
  ) {
    return val;
  }

  if (
    typeof val === 'object' &&
    !Array.isArray(val) &&
    'indices' in val &&
    'values' in val
  ) {
    const dict: Record<string, number> = {};
    for (let i = 0; i < val.indices.length; i++) {
      dict[String(val.indices[i])] = val.values[i];
    }
    return dict;
  }

  if (
    Array.isArray(val) &&
    val.length > 0 &&
    typeof val[0] === 'object' &&
    'index' in val[0]
  ) {
    const dict: Record<string, number> = {};
    for (const item of val) {
      dict[String(item.index)] = item.value;
    }
    return dict;
  }

  if (Array.isArray(val)) {
    const dict: Record<string, number> = {};
    for (let i = 0; i < val.length; i++) {
      if (val[i] !== undefined && val[i] !== null) {
        dict[String(i)] = val[i];
      }
    }
    return dict;
  }

  return val;
}

export class ParquetFormatter implements Formatter {
  readonly extension = '.parquet';

  async persist(
    columns: Map<string, any[]>,
    dynamicRows: Record<string, any>[],
    rowCount: number,
    dir: string,
    schema: BulkWriterSchema
  ): Promise<string[]> {
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `data${this.extension}`);

    const parquetSchema = buildParquetSchema(schema);

    // Pre-compute field metadata
    const activeFields = schema.fields.filter(
      f => !f.autoID && !f.is_function_output
    );
    const fieldMap = new Map<string, FieldType>(
      activeFields.map(f => [f.name, f])
    );
    const fieldDataTypes = new Map<string, DataType>(
      activeFields.map(f => [f.name, convertToDataType(f.data_type)])
    );

    const fieldNames = [...columns.keys()];
    const hasDynamic = schema.enable_dynamic_field && dynamicRows.length > 0;

    const writer = await ParquetWriter.openFile(parquetSchema, filePath);

    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, any> = {};
      for (const name of fieldNames) {
        const val = columns.get(name)![i];
        const field = fieldMap.get(name);
        if (field) {
          const dt = fieldDataTypes.get(name)!;
          row[name] = normalizeForParquet(val, field, dt);
        } else {
          row[name] = val;
        }
      }

      // Dynamic field → JSON string in $meta column
      if (hasDynamic && dynamicRows[i]) {
        const dyn = dynamicRows[i];
        row[DYNAMIC_FIELD] =
          Object.keys(dyn).length > 0 ? JSON.stringify(dyn) : '{}';
      } else if (schema.enable_dynamic_field) {
        row[DYNAMIC_FIELD] = '{}';
      }

      await writer.appendRow(row);
    }

    await writer.close();
    return [filePath];
  }
}

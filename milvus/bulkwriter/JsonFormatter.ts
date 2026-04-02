import * as fs from 'fs';
import * as path from 'path';
import { once } from 'events';
import { finished } from 'stream/promises';
import { DataType, convertToDataType, FieldType } from '../';
import { Formatter, BulkWriterSchema } from './Types';

// Marker for Int64 values to bypass JSON.stringify precision loss.
// JSON.stringify cannot output integers > Number.MAX_SAFE_INTEGER without
// losing precision. We wrap Int64 values in markers, stringify normally,
// then strip the quotes+markers to produce bare integer literals.
const INT64_PREFIX = '___INT64_';
const INT64_SUFFIX = '_INT64___';
const INT64_REGEX = new RegExp(`"${INT64_PREFIX}(-?\\d+)${INT64_SUFFIX}"`, 'g');

/**
 * Normalize a sparse vector (any SDK format) to dict format { "index": value }
 * which is what Milvus bulkInsert expects.
 */
function normalizeSparseVector(val: any): Record<string, number> {
  if (val === null || val === undefined) return val;

  // Already dict format: { "2": 0.5, "5": 0.3 }
  if (
    !Array.isArray(val) &&
    typeof val === 'object' &&
    !('indices' in val && 'values' in val)
  ) {
    return val;
  }

  // CSR format: { indices: [2, 5], values: [0.5, 0.3] }
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

  // COO format: [{ index: 2, value: 0.5 }, ...]
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

  // Array format: [undefined, 0.0, 0.5, 0.3, undefined, 0.2]
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

/**
 * Normalize a field value for JSON serialization.
 * Handles typed arrays, sparse vector format conversion, and Int64 precision.
 */
function normalizeValue(val: any, field: FieldType): any {
  if (val === null || val === undefined) return val;

  const dt = convertToDataType(field.data_type);

  switch (dt) {
    // Typed arrays → regular arrays
    case DataType.Float16Vector:
    case DataType.BFloat16Vector:
      if (val instanceof Uint8Array) {
        return Array.from(val);
      }
      return val;

    case DataType.Int8Vector:
      if (val instanceof Int8Array) {
        return Array.from(val);
      }
      return val;

    // Sparse vector → dict format
    case DataType.SparseFloatVector:
      return normalizeSparseVector(val);

    // Date object → ISO string
    case DataType.Timestamptz:
      if (val instanceof Date) {
        return val.toISOString();
      }
      return val;

    // Int64: wrap in marker to preserve precision through JSON.stringify
    // Handles: number, string (from gRPC query), BigInt, Long objects
    case DataType.Int64:
      return `${INT64_PREFIX}${String(val)}${INT64_SUFFIX}`;

    // Array: normalize elements based on element_type
    case DataType.Array: {
      if (!Array.isArray(val)) return val;
      const et = field.element_type
        ? convertToDataType(field.element_type)
        : null;
      if (et === DataType.Int64) {
        return val.map(
          (v: any) => `${INT64_PREFIX}${String(v)}${INT64_SUFFIX}`
        );
      }
      // Array<Struct>: recursively normalize sub-fields (Int64 inside structs)
      if (et === DataType.Struct && field.fields) {
        const subFields = new Map(field.fields.map(sf => [sf.name, sf]));
        return val.map((item: any) => {
          const normalized: Record<string, any> = {};
          for (const [k, v] of Object.entries(item)) {
            const sf = subFields.get(k);
            if (sf) {
              normalized[k] = normalizeValue(v, sf);
            } else {
              normalized[k] = v;
            }
          }
          return normalized;
        });
      }
      return val;
    }

    default:
      return val;
  }
}

/**
 * Serialize a row to JSON, then fix Int64 markers to bare integer literals.
 * "___INT64_1234567890123456789_INT64___" → 1234567890123456789
 */
function stringifyRow(row: Record<string, any>): string {
  const json = JSON.stringify(row);
  return json.replace(INT64_REGEX, '$1');
}

export class JsonFormatter implements Formatter {
  readonly extension = '.json';

  async persist(
    columns: Map<string, any[]>,
    dynamicRows: Record<string, any>[],
    rowCount: number,
    dir: string,
    schema: BulkWriterSchema
  ): Promise<string[]> {
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `data${this.extension}`);
    const ws = fs.createWriteStream(filePath, { encoding: 'utf8' });

    // Build field lookup for normalization (only active fields)
    const activeFields = schema.fields.filter(
      f => !f.autoID && !f.is_function_output
    );
    const fieldMap = new Map<string, FieldType>(
      activeFields.map(f => [f.name, f])
    );

    const fieldNames = [...columns.keys()];
    const hasDynamic = schema.enable_dynamic_field && dynamicRows.length > 0;

    ws.write('{"rows":[\n');

    for (let i = 0; i < rowCount; i++) {
      if (i > 0) ws.write(',\n');

      const row: Record<string, any> = {};
      for (const name of fieldNames) {
        const val = columns.get(name)![i];
        const field = fieldMap.get(name);
        row[name] = field ? normalizeValue(val, field) : val;
      }
      if (hasDynamic && dynamicRows[i]) {
        const dyn = dynamicRows[i];
        row['$meta'] = Object.keys(dyn).length > 0 ? dyn : {};
      } else if (schema.enable_dynamic_field) {
        row['$meta'] = {};
      }

      const ok = ws.write(stringifyRow(row));
      if (!ok) {
        await once(ws, 'drain');
      }
    }

    ws.write('\n]}');
    ws.end();
    await finished(ws);

    return [filePath];
  }
}

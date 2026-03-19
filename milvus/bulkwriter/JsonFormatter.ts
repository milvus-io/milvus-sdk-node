import * as fs from 'fs';
import * as path from 'path';
import { once } from 'events';
import { finished } from 'stream/promises';
import { DataType, convertToDataType, FieldType } from '../';
import { Formatter, BulkWriterSchema } from './Types';

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
 * Handles typed arrays and sparse vector format conversion.
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

    default:
      return val;
  }
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
        if (Object.keys(dyn).length > 0) {
          row['$meta'] = dyn;
        }
      }

      const ok = ws.write(JSON.stringify(row));
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

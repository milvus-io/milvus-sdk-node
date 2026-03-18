import { DataType, convertToDataType, FieldType } from '../';
import { BulkWriterSchema } from './Types';

const DYNAMIC_FIELD = '$meta';

const TYPE_SIZE: Partial<Record<DataType, number>> = {
  [DataType.Bool]: 1,
  [DataType.Int8]: 1,
  [DataType.Int16]: 2,
  [DataType.Int32]: 4,
  [DataType.Int64]: 8,
  [DataType.Float]: 4,
  [DataType.Double]: 8,
};

export class ColumnBuffer {
  private columns: Map<string, any[]> = new Map();
  private _dynamicRows: Record<string, any>[] = [];
  private _rowCount = 0;
  private activeFields: FieldType[];
  private fieldNames: Set<string>;
  private fieldDataTypes: Map<string, DataType>;

  constructor(private schema: BulkWriterSchema) {
    this.activeFields = schema.fields.filter(
      f => !f.autoID && !f.is_function_output
    );
    this.fieldNames = new Set(schema.fields.map(f => f.name));
    this.fieldDataTypes = new Map(
      this.activeFields.map(f => [f.name, convertToDataType(f.data_type)])
    );
    for (const field of this.activeFields) {
      this.columns.set(field.name, []);
    }
  }

  get rowCount(): number {
    return this._rowCount;
  }

  get dynamicRows(): Record<string, any>[] {
    return this._dynamicRows;
  }

  getColumn(name: string): any[] {
    return this.columns.get(name) ?? [];
  }

  getColumns(): Map<string, any[]> {
    return this.columns;
  }

  getRow(index: number): Record<string, any> {
    const row: Record<string, any> = {};
    for (const field of this.activeFields) {
      const col = this.columns.get(field.name);
      if (col && index < col.length) {
        row[field.name] = col[index];
      }
    }
    if (this.schema.enable_dynamic_field && this._dynamicRows[index]) {
      Object.assign(row, this._dynamicRows[index]);
    }
    return row;
  }

  append(row: Record<string, any>): number {
    let size = 0;
    for (const field of this.activeFields) {
      const val = row[field.name] ?? null;
      this.columns.get(field.name)!.push(val);
      size += this.estimateFieldSize(field, val);
    }
    if (this.schema.enable_dynamic_field) {
      let extra: Record<string, any> | null = null;
      for (const key of Object.keys(row)) {
        if (key === DYNAMIC_FIELD) {
          // User passed explicit $meta dict — merge it
          if (typeof row[key] === 'object' && row[key] !== null) {
            if (!extra) extra = {};
            Object.assign(extra, row[key]);
          }
        } else if (!this.fieldNames.has(key)) {
          if (!extra) extra = {};
          extra[key] = row[key];
        }
      }
      this._dynamicRows.push(extra ?? {});
      if (extra) {
        size += Buffer.byteLength(JSON.stringify(extra), 'utf8');
      }
    }
    this._rowCount++;
    return size;
  }

  private estimateFieldSize(field: FieldType, val: any): number {
    if (val === null || val === undefined) return 0;
    const dt = this.fieldDataTypes.get(field.name)!;
    const fixed = TYPE_SIZE[dt];
    if (fixed) return fixed;
    if (
      dt === DataType.VarChar ||
      dt === DataType.Geometry ||
      dt === DataType.Timestamptz
    ) {
      return typeof val === 'string' ? Buffer.byteLength(val, 'utf8') : 0;
    }
    if (dt === DataType.JSON) {
      return Buffer.byteLength(JSON.stringify(val), 'utf8');
    }
    if (dt === DataType.FloatVector) {
      return (val as number[]).length * 4;
    }
    if (dt === DataType.BinaryVector) {
      return (val as number[]).length;
    }
    if (dt === DataType.Float16Vector || dt === DataType.BFloat16Vector) {
      if (val instanceof Uint8Array) return val.byteLength;
      return (val as number[]).length * 2;
    }
    if (dt === DataType.Int8Vector) {
      if (val instanceof Int8Array) return val.byteLength;
      return (val as number[]).length;
    }
    if (dt === DataType.SparseFloatVector) {
      return Buffer.byteLength(JSON.stringify(val), 'utf8');
    }
    if (dt === DataType.Array) {
      return Buffer.byteLength(JSON.stringify(val), 'utf8');
    }
    if (dt === DataType.Struct) {
      return Buffer.byteLength(JSON.stringify(val), 'utf8');
    }
    return 64;
  }
}

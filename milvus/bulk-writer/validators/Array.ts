import { Int64Validator } from './Int64';

export class ArrayValidator {
  private int64Validator: Int64Validator;

  constructor(int64Strategy: 'auto' | 'string' | 'number' | 'bigint' = 'auto') {
    this.int64Validator = new Int64Validator(int64Strategy);
  }

  /**
   * Validate array field with proper element type handling
   */
  validateArrayField(
    value: any,
    field: any,
    config?: { int64Strategy?: 'auto' | 'string' | 'number' | 'bigint' }
  ): { value: any[]; size: number } {
    if (!Array.isArray(value)) {
      throw new Error(`Field '${field.name}' must be an array`);
    }

    const maxCapacity = Number(field.max_capacity) || 1000;
    const elementType = field.element_type;

    if (!elementType) {
      throw new Error(`Array field '${field.name}' must specify element_type`);
    }

    if (value.length > maxCapacity) {
      throw new Error(
        `Array field '${field.name}' exceeds max capacity: ${value.length} > ${maxCapacity}`
      );
    }

    // Special handling for int64 arrays to apply int64 strategy
    if (elementType === 'Int64') {
      const strategy = config?.int64Strategy || 'auto';
      const validator = new Int64Validator(strategy);
      return validator.validateInt64Array(value, field.name, maxCapacity);
    }

    // For other element types, return a copy to avoid reference issues
    return { value: [...value], size: value.length * 8 };
  }
}

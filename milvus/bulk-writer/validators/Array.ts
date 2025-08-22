import { validateInt64Field, validateInt64Array } from './Int64';

export class ArrayValidator {
  constructor() {
  }

  /**
   * Validate array field with proper element type handling
   */
  validateArrayField(
    value: any,
    field: any,
    config?: any
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

    // Special handling for int64 arrays
    if (elementType === 'Int64') {
      return validateInt64Array(value, field.name, maxCapacity);
    }

    // For other element types, return a copy to avoid reference issues
    return { value: [...value], size: value.length * 8 };
  }
}

// Int64 validation utilities as pure functions

function validateInt64Range(value: bigint, fieldName: string): void {
  if (
    value < BigInt('-9223372036854775808') ||
    value > BigInt('9223372036854775807')
  ) {
    throw new Error(
      `Int64 value out of range for field '${fieldName}': ${value}`
    );
  }
}

function validateStringFormat(value: string, fieldName: string): void {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(
      `Invalid int64 string format for field '${fieldName}': ${value}`
    );
  }
}

function isLong(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'low' in value &&
    'high' in value &&
    'unsigned' in value
  );
}

function handleLongObject(value: any): string {
  if (isLong(value)) {
    return value.toString();
  }
  throw new Error('Value is not a valid Long object');
}

export function validateInt64Field(
  value: any,
  fieldName: string
): { value: { type: 'int64'; value: string }; size: number } {
  if (
    value &&
    typeof value === 'object' &&
    value.type === 'int64' &&
    typeof value.value === 'string'
  ) {
    return { value, size: 8 };
  }
  if (typeof value === 'bigint') {
    validateInt64Range(value, fieldName);
    return { value: { type: 'int64', value: value.toString() }, size: 8 };
  }
  if (isLong(value)) {
    return {
      value: { type: 'int64', value: handleLongObject(value) },
      size: 8,
    };
  }
  if (typeof value === 'string') {
    validateStringFormat(value, fieldName);
    const bigIntValue = BigInt(value);
    validateInt64Range(bigIntValue, fieldName);
    return { value: { type: 'int64', value }, size: 8 };
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
      return { value: { type: 'int64', value: value.toString() }, size: 8 };
    }
    return { value: { type: 'int64', value: value.toString() }, size: 8 };
  }
  throw new Error(
    `Invalid int64 value for field '${fieldName}'. Expected BigInt, Long object, string, or safe integer`
  );
}

export function validateInt64Array(
  value: any[],
  fieldName: string,
  maxCapacity: number
): { value: { type: 'int64'; value: string }[]; size: number } {
  const validatedValues: { type: 'int64'; value: string }[] = [];
  let totalSize = 0;
  for (const item of value) {
    const validationResult = validateInt64Field(item, fieldName);
    validatedValues.push(validationResult.value);
    totalSize += validationResult.size;
  }
  return { value: validatedValues, size: totalSize };
}

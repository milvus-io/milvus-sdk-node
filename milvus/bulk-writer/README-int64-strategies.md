# Int64 Handling Strategies in BulkWriter

The BulkWriter now supports multiple strategies for handling int64 fields to address precision issues in Node.js and provide flexibility for different use cases.

## Problem Statement

In Node.js, JavaScript numbers are limited to 53 bits of precision (Number.MAX_SAFE_INTEGER = 2^53 - 1). When working with int64 fields that contain values beyond this range, precision loss can occur. This is particularly problematic for:

- Database IDs from external systems
- Timestamps in nanoseconds
- Large counters or sequence numbers
- Financial calculations requiring full precision

## Available Strategies

### 1. Auto Strategy (Default)

**Configuration:** `int64Strategy: 'auto'`

The auto strategy intelligently detects the input type and handles it appropriately:

- **BigInt**: Preserved as-is for full precision
- **Long objects**: Preserved as-is (from 'long' library)
- **Strings**: Validated and kept as strings if they represent valid int64 values
- **Numbers**:
  - Safe integers (±2^53-1): kept as numbers
  - Unsafe integers: automatically converted to strings to preserve precision

**Best for:** Mixed data sources, general-purpose use cases

**Example:**

```typescript
const writer = new LocalBulkWriter({
  schema,
  localPath: '/tmp/data',
  config: { int64Strategy: 'auto' },
});

// These will all work correctly
writer.appendRow({ id: 123, value: 456 }); // Safe integers
writer.appendRow({ id: '9007199254740992', value: '789' }); // String representation
writer.appendRow({ id: BigInt(1), value: BigInt(2) }); // BigInt
writer.appendRow({ id: new Long(1, 0, false), value: 3 }); // Long object
```

### 2. String Strategy

**Configuration:** `int64Strategy: 'string'`

Always converts int64 values to strings, ensuring full precision preservation:

- **Input types**: Numbers, BigInt, Long objects, strings
- **Output**: Always strings
- **Precision**: Full 64-bit precision guaranteed

**Best for:** Data preservation, JSON compatibility, external API integration

**Example:**

```typescript
const writer = new LocalBulkWriter({
  schema,
  localPath: '/tmp/data',
  config: { int64Strategy: 'string' },
});

writer.appendRow({ id: 123, value: BigInt('9223372036854775807') });
// Output: { id: '123', value: '9223372036854775807' }
```

### 3. Number Strategy

**Configuration:** `int64Strategy: 'number'`

Only accepts safe integers (±2^53-1) and rejects values that could lose precision:

- **Input types**: Safe numbers, BigInt/Long within safe range, valid integer strings
- **Output**: Always numbers
- **Validation**: Strict - rejects unsafe values

**Best for:** Performance-critical applications, when you know all values are safe

**Example:**

```typescript
const writer = new LocalBulkWriter({
  schema,
  localPath: '/tmp/data',
  config: { int64Strategy: 'number' },
});

writer.appendRow({ id: 123, value: 456 }); // ✅ Accepted
writer.appendRow({ id: 9007199254740991, value: -9007199254740991 }); // ✅ Accepted

// These will throw errors:
// writer.appendRow({ id: 9007199254740992, value: 1 });      // ❌ Rejected
// writer.appendRow({ id: '9223372036854775807', value: 1 }); // ❌ Rejected
```

### 4. BigInt Strategy

**Configuration:** `int64Strategy: 'bigint'`

Always converts int64 values to BigInt for mathematical operations:

- **Input types**: Numbers, strings, Long objects, BigInt
- **Output**: Always BigInt
- **Precision**: Full 64-bit precision

**Best for:** Mathematical operations, calculations requiring full precision

**Example:**

```typescript
const writer = new LocalBulkWriter({
  schema,
  localPath: '/tmp/data',
  config: { int64Strategy: 'bigint' },
});

writer.appendRow({ id: 123, value: '456' });
// Output: { id: BigInt(123), value: BigInt(456) }
```

## Configuration

Set the strategy when creating a BulkWriter:

```typescript
import { LocalBulkWriter } from './LocalBulkWriter';

const writer = new LocalBulkWriter({
  schema: mySchema,
  localPath: '/tmp/data',
  config: {
    int64Strategy: 'string', // 'auto' | 'string' | 'number' | 'bigint'
    cleanupOnExit: true,
  },
});
```

## Array Fields with Int64 Elements

When working with Array fields that have `element_type: 'Int64'`, the BulkWriter automatically applies the configured int64 strategy to each array element:

```typescript
const schema = {
  name: 'example_collection',
  fields: [
    {
      name: 'id',
      dataType: DataType.Int64,
      is_primary_key: true,
    },
    {
      name: 'int64_array',
      dataType: DataType.Array,
      element_type: 'Int64', // This field will use int64 strategies
      max_capacity: 100,
    },
  ],
};

const writer = new LocalBulkWriter({
  schema,
  localPath: '/tmp/data',
  config: { int64Strategy: 'string' },
});

// All array elements will be processed according to the int64 strategy
writer.appendRow({
  id: 1,
  int64_array: [123, '456', BigInt(789), new Long(101112, 0, false)],
});
```

**Supported input types for int64 array elements:**

- Numbers (within safe integer range)
- Strings (valid int64 format)
- BigInt objects
- Long objects (from 'long' library)

**Output behavior by strategy:**

- **Auto**: Mixed types, smart conversion
- **String**: All elements converted to strings
- **Number**: Only safe integers accepted
- **BigInt**: All elements converted to BigInt (then serialized to strings for JSON)

## Strategy Selection Guide

| Use Case                                 | Recommended Strategy | Reason                                |
| ---------------------------------------- | -------------------- | ------------------------------------- |
| General purpose, mixed data              | `auto`               | Smart detection, handles edge cases   |
| External APIs returning string IDs       | `string`             | Preserves exact format, no conversion |
| Performance-critical, safe integers only | `number`             | Fastest, strict validation            |
| Mathematical operations                  | `bigint`             | Full precision arithmetic             |
| Legacy system integration                | `string`             | Compatible with string-based systems  |

## Migration from Previous Versions

The default behavior has changed from strict number-only validation to intelligent auto-detection. If you need the previous strict behavior, use:

```typescript
config: {
  int64Strategy: 'number';
}
```

## Error Handling

Each strategy provides clear error messages for invalid values:

```typescript
try {
  writer.appendRow({ id: 'invalid', value: 1 });
} catch (error) {
  console.log(error.message);
  // "Invalid int64 string format for field 'id': invalid"
}

try {
  writer.appendRow({ id: 9007199254740992, value: 1 });
} catch (error) {
  console.log(error.message);
  // "Int64 field 'id' value 9007199254740992 is outside safe integer range..."
}
```

## Performance Considerations

- **String strategy**: Slight overhead from type conversion, but best for data preservation
- **Number strategy**: Fastest, no conversion overhead
- **BigInt strategy**: Moderate overhead from conversion, but enables mathematical operations
- **Auto strategy**: Minimal overhead from type checking, smart conversion

## Testing

Run the comprehensive test suite:

```bash
yarn test test/bulk-writer/int64-handling.spec.ts
```

## Examples

See `examples/int64-strategies-example.ts` for a complete demonstration of all strategies.

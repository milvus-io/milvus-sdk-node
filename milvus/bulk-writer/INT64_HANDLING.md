# Int64 Handling in BulkWriter

## Overview

JavaScript has limitations when dealing with 64-bit integers due to the `Number` type only supporting 53-bit precision safely. The BulkWriter handles this by supporting multiple representations for int64 values while ensuring data integrity.

## Supported Int64 Representations

### 1. BigInt (Recommended)
```typescript
import { LocalBulkWriter } from './LocalBulkWriter';

const writer = new LocalBulkWriter({ schema, localPath: './data' });

// Use BigInt for full 64-bit precision
writer.appendRow({
  id: BigInt('9223372036854775807'),  // Max int64
  value: BigInt('-9223372036854775808') // Min int64
});
```

### 2. Long Objects (from 'long' library)
```typescript
import Long from 'long';

const writer = new LocalBulkWriter({ schema, localPath: './data' });

// Long objects provide 64-bit precision
const longValue = Long.fromBits(1234567890, 0, false);
writer.appendRow({
  id: longValue,
  value: Long.fromBits(0, 1, false) // 2^32
});
```

### 3. Safe JavaScript Numbers
```typescript
const writer = new LocalBulkWriter({ schema, localPath: './data' });

// Regular numbers within safe range (±2^53-1)
writer.appendRow({
  id: 9007199254740991,  // Number.MAX_SAFE_INTEGER
  value: -9007199254740991 // -Number.MAX_SAFE_INTEGER
});
```

## Validation Rules

The BulkWriter enforces the following validation for int64 fields:

1. **BigInt values**: Always accepted (full precision)
2. **Long objects**: Must have `low`, `high`, and `unsigned` properties
3. **Regular numbers**: Must be integers within safe range (`Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`)
4. **Other types**: Rejected with descriptive error messages

## File Output

When writing to JSON files, int64 values are serialized as strings to preserve precision:

```json
{
  "rows": [
    {
      "id": "9223372036854775807",
      "value": "-9223372036854775808"
    }
  ]
}
```

## Error Handling

The BulkWriter provides clear error messages for invalid int64 values:

```typescript
// This will throw an error
writer.appendRow({
  id: 9007199254740992, // Beyond safe integer range
  value: 1
});
// Error: "Int64 field 'id' value 9007199254740992 is outside safe integer range. Use BigInt or Long for values beyond ±2^53-1"

// This will also throw an error
writer.appendRow({
  id: "invalid",
  value: 1
});
// Error: "Invalid int64 value for field 'id'. Expected BigInt, Long object, or safe integer"
```

## Best Practices

1. **Use BigInt for new code**: Provides the best precision and is native to modern JavaScript
2. **Use Long objects for compatibility**: If you're already using the 'long' library
3. **Avoid unsafe numbers**: Don't use regular numbers beyond ±2^53-1 for int64 fields
4. **Handle errors gracefully**: Always wrap bulk operations in try-catch blocks

## Example

```typescript
import { LocalBulkWriter } from './LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../types/Collection';
import { DataType } from '../const';

const schema: CollectionSchema = {
  name: 'example_collection',
  fields: [
    {
      name: 'id',
      dataType: DataType.Int64,
      is_primary_key: true,
      autoID: false,
    } as FieldSchema,
    {
      name: 'timestamp',
      dataType: DataType.Int64,
      is_primary_key: false,
      autoID: false,
    } as FieldSchema,
  ],
  enable_dynamic_field: false,
};

const writer = new LocalBulkWriter({
  schema,
  localPath: './data',
  fileType: BulkFileType.JSON,
});

try {
  // Add rows with different int64 representations
  writer.appendRow({
    id: BigInt(1),
    timestamp: BigInt(Date.now())
  });
  
  writer.appendRow({
    id: BigInt(2),
    timestamp: BigInt('9223372036854775807') // Max int64
  });
  
  await writer.commit();
} catch (error) {
  console.error('Bulk write failed:', error.message);
} finally {
  await writer.cleanup();
}
```

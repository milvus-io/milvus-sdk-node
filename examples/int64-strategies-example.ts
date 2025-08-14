import { LocalBulkWriter } from '../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../milvus/types/Collection';
import { DataType } from '../milvus/const';
import { BulkFileType } from '../milvus/bulk-writer/constants';
import Long from 'long';
import * as path from 'path';

/**
 * Example demonstrating different int64 handling strategies in BulkWriter
 */
async function demonstrateInt64Strategies() {
  const schema: CollectionSchema = {
    name: 'int64_example_collection',
    description: 'Example collection for int64 strategies',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'value',
        dataType: DataType.Int64,
        is_primary_key: false,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
    ],
    enable_dynamic_field: false,
    autoID: false,
    functions: [],
  };

  const tempDir = path.join(__dirname, 'temp_int64_examples');

  console.log('=== Int64 Handling Strategies Demo ===\n');

  // 1. Auto Strategy (Default) - Smart detection
  console.log('1. Auto Strategy (Default):');
  const autoWriter = new LocalBulkWriter({
    schema,
    localPath: path.join(tempDir, 'auto'),
    fileType: BulkFileType.JSON,
    config: { int64Strategy: 'auto' },
  });

  autoWriter.appendRow({
    id: 123,
    value: BigInt('9223372036854775807'), // Max int64
  });

  autoWriter.appendRow({
    id: '9007199254740992', // Beyond safe integer range
    value: new Long(456, 0, false),
  });

  await autoWriter.commit();
  console.log('   - Handles mixed types intelligently');
  console.log('   - Converts unsafe integers to strings automatically');
  console.log('   - Files created:', autoWriter.batchFiles.length);
  await autoWriter.cleanup();

  // 2. String Strategy - Always preserve as strings
  console.log('\n2. String Strategy:');
  const stringWriter = new LocalBulkWriter({
    schema,
    localPath: path.join(tempDir, 'string'),
    fileType: BulkFileType.JSON,
    config: { int64Strategy: 'string' },
  });

  stringWriter.appendRow({
    id: 123,
    value: BigInt('9223372036854775807'),
  });

  stringWriter.appendRow({
    id: new Long(456, 0, false),
    value: '789',
  });

  await stringWriter.commit();
  console.log('   - Always outputs strings for int64 fields');
  console.log('   - Best for preserving precision');
  console.log('   - Files created:', stringWriter.batchFiles.length);
  await stringWriter.cleanup();

  // 3. Number Strategy - Only safe integers
  console.log('\n3. Number Strategy:');
  const numberWriter = new LocalBulkWriter({
    schema,
    localPath: path.join(tempDir, 'number'),
    fileType: BulkFileType.JSON,
    config: { int64Strategy: 'number' },
  });

  numberWriter.appendRow({
    id: 123,
    value: 456,
  });

  numberWriter.appendRow({
    id: 9007199254740991, // Max safe integer
    value: -9007199254740991, // Min safe integer
  });

  await numberWriter.commit();
  console.log('   - Only accepts safe integers (±2^53-1)');
  console.log('   - Rejects values that could lose precision');
  console.log('   - Files created:', numberWriter.batchFiles.length);
  await numberWriter.cleanup();

  // 4. BigInt Strategy - Always BigInt
  console.log('\n4. BigInt Strategy:');
  const bigintWriter = new LocalBulkWriter({
    schema,
    localPath: path.join(tempDir, 'bigint'),
    fileType: BulkFileType.JSON,
    config: { int64Strategy: 'bigint' },
  });

  bigintWriter.appendRow({
    id: 123,
    value: '456',
  });

  bigintWriter.appendRow({
    id: new Long(789, 0, false),
    value: BigInt('9223372036854775807'),
  });

  await bigintWriter.commit();
  console.log('   - Always outputs BigInt for int64 fields');
  console.log('   - Best for mathematical operations');
  console.log('   - Files created:', bigintWriter.batchFiles.length);
  await bigintWriter.cleanup();

  console.log('\n=== Strategy Comparison ===');
  console.log('• Auto: Best for mixed data sources, smart conversion');
  console.log('• String: Best for data preservation and JSON compatibility');
  console.log('• Number: Best for performance with safe integers only');
  console.log('• BigInt: Best for mathematical operations and precision');

  console.log('\n=== Usage Tips ===');
  console.log('• Use "string" strategy when working with external APIs that return string IDs');
  console.log('• Use "number" strategy when you know all values are within safe range');
  console.log('• Use "bigint" strategy when you need to perform math operations');
  console.log('• Use "auto" strategy (default) for general-purpose use cases');
}

// Run the example
if (require.main === module) {
  demonstrateInt64Strategies().catch(console.error);
}

export { demonstrateInt64Strategies };

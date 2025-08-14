import { LocalBulkWriter } from '../milvus/bulk-writer/LocalBulkWriter';
import { CollectionSchema, FieldSchema } from '../milvus/types/Collection';
import { DataType } from '../milvus/const';
import { BulkFileType } from '../milvus/bulk-writer/constants';
import Long from 'long';
import * as path from 'path';

/**
 * Example demonstrating int64 array handling in BulkWriter
 */
async function demonstrateInt64Arrays() {
  const schema: CollectionSchema = {
    name: 'int64_array_example_collection',
    description: 'Example collection for int64 array handling',
    fields: [
      {
        name: 'id',
        dataType: DataType.Int64,
        is_primary_key: true,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
      {
        name: 'int64_array',
        dataType: DataType.Array,
        element_type: 'Int64',
        max_capacity: 100,
        is_primary_key: false,
        autoID: false,
        is_function_output: false,
      } as FieldSchema,
    ],
    enable_dynamic_field: false,
    autoID: false,
    functions: [],
  };

  const tempDir = path.join(__dirname, 'temp_int64_array_examples');

  console.log('=== Int64 Array Handling Demo ===\n');

  try {
    // 1. Auto Strategy with Int64 Arrays
    console.log('1. Auto Strategy with Int64 Arrays:');
    const autoWriter = new LocalBulkWriter({
      schema,
      localPath: path.join(tempDir, 'auto'),
      fileType: BulkFileType.JSON,
      config: { int64Strategy: 'auto' },
    });

    autoWriter.appendRow({
      id: 1,
      int64_array: [123, '456', BigInt(789), new Long(101112, 0, false)],
    });

    autoWriter.appendRow({
      id: 2,
      int64_array: ['9007199254740992', BigInt('9223372036854775807')],
    });

    await autoWriter.commit();
    console.log('   - Handles mixed types intelligently');
    console.log('   - Converts unsafe integers to strings automatically');
    console.log('   - Files created:', autoWriter.batchFiles.length);
    await autoWriter.cleanup();

    // 2. String Strategy with Int64 Arrays
    console.log('\n2. String Strategy with Int64 Arrays:');
    const stringWriter = new LocalBulkWriter({
      schema,
      localPath: path.join(tempDir, 'string'),
      fileType: BulkFileType.JSON,
      config: { int64Strategy: 'string' },
    });

    stringWriter.appendRow({
      id: 1,
      int64_array: [123, BigInt(456), new Long(789, 0, false)],
    });

    await stringWriter.commit();
    console.log('   - Always outputs strings for int64 array elements');
    console.log('   - Best for data preservation and JSON compatibility');
    console.log('   - Files created:', stringWriter.batchFiles.length);
    await stringWriter.cleanup();

    // 3. Number Strategy with Int64 Arrays
    console.log('\n3. Number Strategy with Int64 Arrays:');
    const numberWriter = new LocalBulkWriter({
      schema,
      localPath: path.join(tempDir, 'number'),
      fileType: BulkFileType.JSON,
      config: { int64Strategy: 'number' },
    });

    numberWriter.appendRow({
      id: 1,
      int64_array: [123, 456, 789],
    });

    numberWriter.appendRow({
      id: 2,
      int64_array: [9007199254740991, -9007199254740991], // Safe integers
    });

    await numberWriter.commit();
    console.log('   - Only accepts safe integers (±2^53-1)');
    console.log('   - Rejects values that could lose precision');
    console.log('   - Files created:', numberWriter.batchFiles.length);
    await numberWriter.cleanup();

    // 4. BigInt Strategy with Int64 Arrays
    console.log('\n4. BigInt Strategy with Int64 Arrays:');
    const bigintWriter = new LocalBulkWriter({
      schema,
      localPath: path.join(tempDir, 'bigint'),
      fileType: BulkFileType.JSON,
      config: { int64Strategy: 'bigint' },
    });

    bigintWriter.appendRow({
      id: 1,
      int64_array: [123, '456', new Long(789, 0, false)],
    });

    bigintWriter.appendRow({
      id: 2,
      int64_array: [BigInt('9223372036854775807'), BigInt('-9223372036854775808')],
    });

    await bigintWriter.commit();
    console.log('   - Always outputs BigInt for int64 array elements');
    console.log('   - Best for mathematical operations and precision');
    console.log('   - Files created:', bigintWriter.batchFiles.length);
    await bigintWriter.cleanup();

    console.log('\n=== Int64 Array Strategy Comparison ===');
    console.log('• Auto: Best for mixed data sources, smart conversion per element');
    console.log('• String: Best for data preservation, all elements as strings');
    console.log('• Number: Best for performance, only safe integers');
    console.log('• BigInt: Best for math operations, full precision');

    console.log('\n=== Use Cases for Int64 Arrays ===');
    console.log('• User ID lists from external systems');
    console.log('• Timestamp arrays (nanoseconds)');
    console.log('• Large counter sequences');
    console.log('• Financial calculation results');
    console.log('• Batch operation IDs');

    console.log('\n=== Best Practices ===');
    console.log('• Use "string" strategy when working with external APIs');
    console.log('• Use "number" strategy when you know all values are safe');
    console.log('• Use "bigint" strategy for mathematical operations');
    console.log('• Use "auto" strategy for general-purpose use cases');
    console.log('• Consider array size limits (max_capacity)');

  } catch (error) {
    console.error('Error during demonstration:', error.message);
  } finally {
    // Cleanup temp directory
    try {
      await import('fs').then(fs => fs.promises.rm(tempDir, { recursive: true, force: true }));
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run the example
if (require.main === module) {
  demonstrateInt64Arrays().catch(console.error);
}

export { demonstrateInt64Arrays };

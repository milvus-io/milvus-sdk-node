const { BulkWriter } = require('./milvus/bulk-writer/BulkWriter');
const { LocalBulkWriter } = require('./milvus/bulk-writer/LocalBulkWriter');
const { DataType } = require('./milvus/const');

// Mock schema for testing
const mockSchema = {
  fields: [
    {
      name: 'id',
      dataType: DataType.Int64,
      is_primary_key: true,
      autoID: false,
      is_function_output: false,
    },
    {
      name: 'vector',
      dataType: DataType.FloatVector,
      dim: 4,
      is_primary_key: false,
      autoID: false,
      is_function_output: false,
    }
  ],
  enable_dynamic_field: false
};

// Test data
const testRow = {
  id: 1,
  vector: [1, 2, 3, 4]
};

console.log('Original test row:', JSON.stringify(testRow, null, 2));

// Create a test instance
const writer = new LocalBulkWriter({
  schema: mockSchema,
  localPath: './test-output',
  chunkSize: 1024 * 1024, // 1MB
  config: { cleanupOnExit: false }
});

// Test appendRow
writer.appendRow(testRow);

console.log('After appendRow - currentBufferRowCount:', writer.currentBufferRowCount);
console.log('After appendRow - currentBufferSize:', writer.currentBufferSize);

// Test commit
writer.commit({ async: false }).then(() => {
  console.log('After commit - totalRows:', writer.totalRows);
  console.log('After commit - batchFiles:', writer.batchFiles);
  
  // Clean up
  writer.cleanup();
}).catch(error => {
  console.error('Error during commit:', error);
});

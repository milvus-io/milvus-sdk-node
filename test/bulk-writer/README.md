# Bulk Writer Test Suite

This directory contains comprehensive tests for the LocalBulkWriter functionality in the Milvus Node.js SDK.

## Overview

The test suite covers:
- LocalBulkWriter functionality with all supported data types
- JSON and CSV file format handling
- Data validation and error handling
- Chunking and file management
- Edge cases and error scenarios

## Test Files

### LocalBulkWriter.spec.ts
Main test file that tests the LocalBulkWriter class with comprehensive coverage of:
- Basic functionality (creation, properties, cleanup)
- Data appending and auto-flushing
- JSON and CSV file type handling
- Async commit operations
- Callback handling
- Data validation
- Large dataset chunking
- All supported Milvus data types

### test-data-generator.ts
Utility class for generating test data files:
- Comprehensive test data with all data types
- CSV and JSON file generation
- Data type specific test files
- Edge case test data
- CLI interface for standalone usage

## Supported Data Types

The test suite covers all Milvus data types:
- **Numeric**: Int8, Int16, Int32, Int64, Float, Double
- **Vectors**: FloatVector, BinaryVector, SparseFloatVector, Float16Vector, BFloat16Vector, Int8Vector
- **Arrays**: Int32Array, FloatArray, VarCharArray
- **Other**: Bool, VarChar, JSON

## Running Tests

### Prerequisites
- Node.js and npm/yarn installed
- Milvus server running (for collection operations)
- Dependencies installed (`npm install`)

### Quick Test Run
```bash
# From milvus-sdk-node root directory
npm test -- test/bulk-writer/LocalBulkWriter.spec.ts
```

### Using the Test Runner Script
```bash
# From milvus-sdk-node root directory
./test/bulk-writer/run-tests.sh
```

### Generate Test Data Only
```bash
# Generate test data files
npx ts-node test/bulk-writer/test-data-generator.ts

# Generate to custom directory
npx ts-node test/bulk-writer/test-data-generator.ts /path/to/output
```

## Test Data Files

The test suite generates several types of test data files:

### Comprehensive Test Data
- `comprehensive_test_data.json` - Full dataset with all data types (200 records)
- `comprehensive_test_data.csv` - CSV version of comprehensive data
- `small_test_data.json` - Small sample (10 records) for quick tests
- `small_test_data.csv` - CSV version of small sample

### Data Type Specific Files
- `numeric_types.json/csv` - Numeric data types only
- `vector_types.json/csv` - Vector data types only
- `array_types.json/csv` - Array data types only

### Edge Case Files
- `edge_case_null_values.json/csv` - Data with null values
- `edge_case_empty_arrays.json/csv` - Data with empty arrays
- `edge_case_special_characters.json/csv` - Data with special characters

## Test Configuration

The tests use the following configuration:
- **Chunk Size**: 1MB (for testing purposes)
- **File Types**: JSON and CSV
- **Data Count**: 100-1000 records per test
- **Vector Dimensions**: 128 dimensions
- **Database**: Creates temporary 'BulkWriterTest' database

## Test Structure

### Setup
- Creates test database and collection
- Sets up comprehensive schema with all data types
- Creates indexes for vector fields
- Loads collection for operations

### Test Cases
1. **Basic Functionality**: Creation, properties, cleanup
2. **Data Operations**: Appending, committing, auto-flushing
3. **File Formats**: JSON and CSV handling
4. **Async Operations**: Async commit and callbacks
5. **Validation**: Schema validation and error handling
6. **Performance**: Large dataset chunking
7. **Data Types**: All supported Milvus data types
8. **Edge Cases**: Empty data, single rows, null values

### Cleanup
- Removes test files and directories
- Drops test collection and database
- Cleans up bulk writer instances

## Troubleshooting

### Common Issues
1. **Milvus Connection**: Ensure Milvus server is running and accessible
2. **Dependencies**: Run `npm install` to install required packages
3. **Permissions**: Ensure write permissions for test data directory
4. **Memory**: Large tests may require sufficient memory

### Debug Mode
Enable debug logging by setting log level in the test:
```typescript
const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'debug', // Change from 'info' to 'debug'
  logPrefix: 'LocalBulkWriter Test',
});
```

## Contributing

When adding new tests:
1. Follow the existing test structure and naming conventions
2. Add comprehensive test data generation if testing new data types
3. Include both positive and negative test cases
4. Ensure proper cleanup in afterAll/afterEach blocks
5. Add documentation for new test scenarios

## Related Documentation

- [Milvus Node.js SDK Documentation](../../README.md)
- [Bulk Writer API Documentation](../../milvus/bulk-writer/README.md)
- [Collection Schema Reference](../../milvus/types/Collection.ts)

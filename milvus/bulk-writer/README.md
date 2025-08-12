# Bulk Writer for Milvus Node.js SDK

The bulk writer provides high-performance data ingestion capabilities for large-scale data import into Milvus collections.

## Features

- **Memory-efficient buffering**: Automatically manages memory usage with configurable chunk sizes
- **Data validation**: Validates data against collection schema before buffering
- **Multiple storage backends**: Support for local file system (with cloud storage planned)
- **Asynchronous processing**: Non-blocking data flushing for better performance
- **HTTP-based import**: Uses Milvus HTTP API for bulk import operations
- **Progress tracking**: Monitor import job progress and completion

## Quick Start

```typescript
import { MilvusClient, DataType, LocalBulkWriter, BulkImportClient } from '@zilliz/milvus2-sdk-node';

// Create collection and get schema
const client = new MilvusClient({ address: 'localhost:19530' });
const describeResponse = await client.describeCollection({ collection_name: 'my_collection' });

// Create bulk writer
const writer = new LocalBulkWriter({
  schema: describeResponse.schema,
  localPath: '/tmp/bulk_data',
  chunkSize: 128 * 1024 * 1024 // 128MB chunks
});

// Add data rows
for (const row of dataRows) {
  writer.appendRow(row);
}

// Commit and get file paths
await writer.commit();
const files = writer.batchFiles;

// Import using HTTP API
const importClient = new BulkImportClient({
  endpoint: 'http://localhost:9091',
  username: 'root',
  password: 'Milvus'
});

const job = await importClient.createImportJob({
  collectionName: 'my_collection',
  dataPaths: [files]
});

// Wait for completion
const result = await importClient.waitForImportCompletion(job.jobId);
console.log('Import completed:', result);
```

## Architecture

### Core Components

1. **BulkWriter**: Abstract base class providing data validation and buffering
2. **LocalBulkWriter**: Concrete implementation for local file system storage
3. **Buffer**: In-memory columnar buffer with automatic persistence
4. **BulkImportClient**: HTTP client for bulk import operations

### Data Flow

```
Data Input → Validation → Buffer → Chunk Management → File Writing → HTTP Import
```

## Configuration

### LocalBulkWriter Options

```typescript
interface LocalBulkWriterConfig {
  chunkSize?: number;        // Default: 128MB
  fileType?: BulkFileType;   // Default: JSON
  localPath?: string;        // Local storage path
  cleanupOnExit?: boolean;   // Default: true
}
```

### Supported File Types

- `BulkFileType.JSON`: Human-readable JSON format (default)
- `BulkFileType.PARQUET`: Efficient columnar format (planned)
- `BulkFileType.CSV`: Comma-separated values (planned)

## Error Handling

The bulk writer provides comprehensive error handling:

- **Validation errors**: Data type and constraint validation
- **Storage errors**: File system and I/O error handling
- **Import errors**: HTTP API error handling with retry logic

## Performance Considerations

- **Chunk size**: Larger chunks reduce I/O overhead but increase memory usage
- **Async flushing**: Use `commit({ async: true })` for non-blocking operations
- **Batch processing**: Process data in batches to optimize memory usage

## Limitations

- Currently only supports JSON file format
- Local storage only (cloud storage support planned)
- Requires HTTP API access for import operations

## Examples

See `examples/bulk-writer-example.ts` for a complete working example.

# Bulk Writer for Milvus Node.js SDK

The bulk writer provides high-performance data ingestion capabilities for large-scale data import into Milvus collections.

## Features

- **Memory-efficient buffering**: Automatically manages memory usage with configurable chunk sizes
- **Data validation**: Validates data against collection schema before buffering
- **Multiple storage backends**: Support for local file system and S3/MinIO object storage
- **Asynchronous processing**: Non-blocking data flushing for better performance
- **HTTP-based import**: Uses Milvus HTTP API for bulk import operations
- **Progress tracking**: Monitor import job progress and completion

## Quick Start

### Local Storage (Default)

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

### MinIO/S3 Storage (New!)

```typescript
import { MilvusClient, DataType, RemoteBulkWriter, BulkImportClient } from '@zilliz/milvus2-sdk-node';

// Create collection and get schema
const client = new MilvusClient({ address: 'localhost:19530' });
const describeResponse = await client.describeCollection({ collection_name: 'my_collection' });

// Create remote bulk writer with MinIO
const writer = new RemoteBulkWriter({
  schema: describeResponse.schema,
  remotePath: 'bulk-data',
  connectParam: {
    endpoint: '127.0.0.1:9000', // MinIO endpoint
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    secure: false, // Set to true for HTTPS
  },
  bucketName: 'milvus-bulk-data',
  chunkSize: 128 * 1024 * 1024 // 128MB chunks
});

// Add data rows
for (const row of dataRows) {
  writer.appendRow(row);
}

// Commit and get S3/MinIO file paths
await writer.commit();
const files = writer.batchFiles; // Returns s3://bucket/path/file.json

// Import using HTTP API with S3 paths
const importClient = new BulkImportClient({
  endpoint: 'http://localhost:9091',
});

const job = await importClient.createImportJob({
  collectionName: 'my_collection',
  files: files.map(file => [file]) // S3 paths are directly usable
});

// Wait for completion
const result = await importClient.waitForImportCompletion(job.jobId);
console.log('Import completed:', result);
```

## Architecture

### Core Components

1. **BulkWriter**: Abstract base class providing data validation and buffering
2. **LocalBulkWriter**: Concrete implementation for local file system storage
3. **RemoteBulkWriter**: Concrete implementation for S3/MinIO object storage
4. **Buffer**: In-memory columnar buffer with automatic persistence
5. **BulkImportClient**: HTTP client for bulk import operations

### Data Flow

```
Data Input → Validation → Buffer → Chunk Management → File Writing → Upload to S3/MinIO → HTTP Import
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

### RemoteBulkWriter Options

```typescript
interface RemoteBulkWriterConfig {
  chunkSize?: number;        // Default: 128MB
  fileType?: BulkFileType;   // Default: JSON
  remotePath?: string;       // Remote storage path prefix
  connectParam: S3ConnectParam; // S3/MinIO connection parameters
  bucketName?: string;       // S3 bucket name (default: 'milvus-bulk-data')
  cleanupOnExit?: boolean;   // Default: true
}

interface S3ConnectParam {
  endpoint: string;          // S3/MinIO endpoint URL
  accessKey: string;         // Access key for authentication
  secretKey: string;         // Secret key for authentication
  secure?: boolean;          // Use HTTPS (default: false for MinIO)
  region?: string;           // AWS region (optional for MinIO)
  sessionToken?: string;     // Session token (optional)
}
```

### Supported File Types

- `BulkFileType.JSON`: Human-readable JSON format (default)
- `BulkFileType.PARQUET`: Efficient columnar format (planned)
- `BulkFileType.CSV`: Comma-separated values (planned)

## MinIO Setup

To use MinIO with the bulk writer, you need to:

1. **Start MinIO service** (using Docker Compose example):
```yaml
version: '3.5'
services:
  minio:
    container_name: milvus-minio
    image: minio/minio:RELEASE.2024-12-18T13-15-44Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    ports:
      - "9001:9001"
      - "9000:9000"
    volumes:
      - ./volumes/minio:/minio_data
    command: minio server /minio_data --console-address ":9001"
```

2. **Install AWS SDK dependency**:
```bash
yarn add @aws-sdk/client-s3
```

3. **Configure connection parameters**:
```typescript
const writer = new RemoteBulkWriter({
  schema: collectionSchema,
  remotePath: 'bulk-data',
  connectParam: {
    endpoint: '127.0.0.1:9000',
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    secure: false,
  },
  bucketName: 'milvus-bulk-data',
});
```

## Error Handling

The bulk writer provides comprehensive error handling:

- **Validation errors**: Data type and constraint validation
- **Storage errors**: File system, S3/MinIO, and I/O error handling
- **Import errors**: HTTP API error handling with retry logic

## Performance Considerations

- **Chunk size**: Larger chunks reduce I/O overhead but increase memory usage
- **Async flushing**: Use `commit({ async: true })` for non-blocking operations
- **Batch processing**: Process data in batches to optimize memory usage
- **S3/MinIO**: Use appropriate chunk sizes for your network bandwidth

## Limitations

- Currently only supports JSON file format
- Requires AWS SDK for S3/MinIO support
- Requires HTTP API access for import operations

## Examples

See `examples/bulk-writer-minio-example.ts` for a complete working example with MinIO.

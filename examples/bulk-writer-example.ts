import { MilvusClient, DataType, LocalBulkWriter, BulkImportClient } from '../milvus';

async function bulkWriterExample() {
  // Create Milvus client
  const client = new MilvusClient({
    address: 'localhost:19530',
    username: 'root',
    password: 'Milvus',
  });

  const collectionName = 'bulk_writer_example';

  try {
    // Create collection
    await client.createCollection({
      collection_name: collectionName,
      fields: [
        {
          name: 'id',
          description: 'ID field',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'vector',
          description: 'Vector field',
          data_type: DataType.FloatVector,
          dim: 128,
        },
        {
          name: 'text',
          description: 'Text field',
          data_type: DataType.VarChar,
          max_length: 256,
        },
        {
          name: 'metadata',
          description: 'JSON metadata',
          data_type: DataType.JSON,
        },
      ],
    });

    // Get collection schema
    const describeResponse = await client.describeCollection({
      collection_name: collectionName,
    });

    // Create bulk writer
    const writer = new LocalBulkWriter({
      schema: describeResponse.schema,
      localPath: '/tmp/bulk_data',
      chunkSize: 64 * 1024 * 1024, // 64MB chunks
    });

    // Add data rows
    for (let i = 0; i < 1000; i++) {
      writer.appendRow({
        vector: Array.from({ length: 128 }, () => Math.random()),
        text: `Sample text ${i}`,
        metadata: {
          index: i,
          timestamp: Date.now(),
          category: i % 5,
        },
      });
    }

    // Commit and get file paths
    await writer.commit();
    console.log('Data files:', writer.batchFiles);

    // Create bulk import client
    const importClient = new BulkImportClient({
      endpoint: 'http://localhost:9091',
      username: 'root',
      password: 'Milvus',
    });

    // Import data
    const importJob = await importClient.createImportJob({
      collectionName,
      dataPaths: [writer.batchFiles],
    });

    console.log('Import job created:', importJob.jobId);

    // Wait for completion
    const result = await importClient.waitForImportCompletion({
      jobId: importJob.jobId,
      timeout: 600000 // 10 minutes
    });
    console.log('Import completed:', result);

    // Clean up
    await writer.cleanup();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.closeConnection();
  }
}

// Run example
bulkWriterExample().catch(console.error);

import { MilvusClient, DataType, LocalBulkWriter, BulkImportClient } from '../milvus';

async function simpleBulkWriterExample() {
  const client = new MilvusClient({ address: 'localhost:19530' });
  const collectionName = 'simple_example';

  try {
    // Create collection
    await client.createCollection({
      collection_name: collectionName,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: 64,
        },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 100,
        },
      ],
    });

    const schema = await client.describeCollection({ collection_name: collectionName });

    // Create bulk writer with options object
    const writer = new LocalBulkWriter({
      schema: schema.schema,
      localPath: '/tmp/simple_data',
      chunkSize: 32 * 1024 * 1024, // 32MB
      config: {
        cleanupOnExit: true,
      },
    });

    // Add some data
    for (let i = 0; i < 100; i++) {
      writer.appendRow({
        vector: Array.from({ length: 64 }, () => Math.random()),
        text: `Sample ${i}`,
      });
    }

    // Commit and get files
    await writer.commit();
    console.log('Files created:', writer.batchFiles);

    // Import using HTTP client
    const importClient = new BulkImportClient({
      endpoint: 'http://localhost:9091',
      username: 'root',
      password: 'Milvus',
    });

    const job = await importClient.createImportJob({
      collectionName,
      dataPaths: [writer.batchFiles],
    });

    console.log('Import job created:', job.jobId);

    // Wait for completion with options
    const result = await importClient.waitForImportCompletion({
      jobId: job.jobId,
      timeout: 300000, // 5 minutes
    });

    console.log('Import completed:', result.state);

    // Cleanup
    await writer.cleanup();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.closeConnection();
  }
}

// Run example
simpleBulkWriterExample().catch(console.error);

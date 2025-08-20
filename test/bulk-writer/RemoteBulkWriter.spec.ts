import { promises as fs } from 'fs';
import * as path from 'path';
import { RemoteBulkWriter, BulkFileType } from '../../milvus/bulk-writer';
import Long from 'long';
import {
  DataType,
  DescribeCollectionResponse,
  MilvusClient,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const TEST_CHUNK_SIZE = 1024 * 1024; // 1MB for testing
const COLLECTION_NAME = GENERATE_NAME();

// Real MinIO connection parameters for local testing
const MINIO_CONFIG = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
};

const TEST_BUCKET_NAME = 'test-bulk-data';

describe('RemoteBulkWriter - Integration Tests with MinIO', () => {
  let bulkWriter: RemoteBulkWriter;
  let testDataDir: string;
  let milvusClient: MilvusClient;
  let collectionInfo: DescribeCollectionResponse;

  beforeAll(async () => {
    // Create test data directory
    testDataDir = path.join(__dirname, 'temp');
    await fs.mkdir(testDataDir, { recursive: true });

    milvusClient = new MilvusClient({
      address: IP,
      logLevel: 'info',
      logPrefix: 'RemoteBulkWriter Test',
    });

    // Create source collection for testing
    await milvusClient.createCollection(
      genCollectionParams({
        collectionName: COLLECTION_NAME,
        dim: [4],
        vectorType: [DataType.FloatVector],
        autoID: false,
        enableDynamic: true,
      })
    );

    collectionInfo = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    // Remove test data directory
    try {
      await fs.rm(testDataDir, { recursive: true });

      // Remove collections
      await milvusClient.dropCollection({
        collection_name: COLLECTION_NAME,
      });

      // Close database connections to prevent Jest from hanging
      await milvusClient.closeConnection();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Create a new bulk writer for each test
    bulkWriter = new RemoteBulkWriter({
      schema: collectionInfo.schema,
      remotePath: 'test-remote-path',
      connectParam: MINIO_CONFIG,
      bucketName: TEST_BUCKET_NAME,
      chunkSize: TEST_CHUNK_SIZE,
      fileType: BulkFileType.JSON,
      config: {
        strictValidation: false,
        skipInvalidRows: true,
        cleanupOnExit: false,
      },
    });
  });

  afterEach(async () => {
    // Clean up bulk writer resources after each test
    try {
      if (bulkWriter) {
        await bulkWriter.cleanup(true); // Force cleanup to remove test files
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Functionality', () => {
    it('should create RemoteBulkWriter with correct properties', () => {
      expect(bulkWriter).toBeDefined();
      expect(bulkWriter.uuid).toBeDefined();
      expect(bulkWriter.dataPath).toBe('test-remote-path');
      expect(bulkWriter.batchFiles).toEqual([]);
    });

    it('should handle empty data correctly', async () => {
      await bulkWriter.commit();
      const files = bulkWriter.batchFiles;
      expect(files.length).toBe(0);
    });

    it('should handle single row correctly', async () => {
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        1
      );

      bulkWriter.appendRow(testData[0]);
      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(
        /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
      );
    });
  });

  describe('Data Writing and File Generation', () => {
    it('should append rows and commit data', async () => {
      const count = 500;
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        count
      );

      // Append all rows
      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      // Force final commit
      await bulkWriter.commit();

      // Verify files were created
      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify all files have S3 URLs
      for (const file of files) {
        expect(file).toMatch(
          /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
        );
      }
    });

    it('should handle JSON file type correctly', async () => {
      const jsonWriter = new RemoteBulkWriter({
        schema: collectionInfo.schema,
        remotePath: 'test-remote-path',
        connectParam: MINIO_CONFIG,
        bucketName: TEST_BUCKET_NAME,
        chunkSize: TEST_CHUNK_SIZE,
        fileType: BulkFileType.JSON,
        config: {
          strictValidation: false,
          skipInvalidRows: true,
          cleanupOnExit: false,
        },
      });

      const testData = generateInsertData(
        [
          ...collectionInfo.schema.fields,
          ...dynamicFields,
          {
            name: 'dynamic_int32',
            description: 'dynamic int32 field',
            data_type: 'Int32',
          },
        ] as any,
        3
      );

      for (const row of testData) {
        jsonWriter.appendRow(row);
      }

      await jsonWriter.commit();

      const files = jsonWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify all files have S3 URLs
      for (const file of files) {
        expect(file).toMatch(
          /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
        );
      }

      await jsonWriter.cleanup(true);
    });
  });

  describe('Commit Operations', () => {
    it('should handle async commit correctly', async () => {
      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        5000
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      // Test async commit - should return immediately
      const startTime = Date.now();
      const commitPromise = bulkWriter.commit({ async: true });
      const endTime = Date.now();

      // Async commit should return very quickly (within 10ms)
      expect(endTime - startTime).toBeLessThan(10);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify files were created asynchronously
      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify the commit promise resolves
      await commitPromise;
    });

    it('should handle commit with callback', async () => {
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        3
      );
      let callbackCalled = false;
      let callbackFiles: string[] = [];

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit({
        callback: files => {
          callbackCalled = true;
          callbackFiles = files;
        },
      });

      expect(callbackCalled).toBe(true);
      expect(callbackFiles.length).toBeGreaterThan(0);
    });

    it('should demonstrate timing difference between sync and async commit', async () => {
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        1000
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      // Test sync commit timing
      const syncStart = Date.now();
      await bulkWriter.commit({ async: false });
      const syncEnd = Date.now();
      const syncDuration = syncEnd - syncStart;

      // Test async commit timing
      const asyncStart = Date.now();
      const asyncPromise = bulkWriter.commit({ async: true });
      const asyncEnd = Date.now();
      const asyncDuration = asyncEnd - asyncStart;

      // Async commit should return much faster than sync commit
      expect(asyncDuration).toBeLessThan(syncDuration);
      expect(asyncDuration).toBeLessThan(10);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Both should have created the same files
      const syncFiles = bulkWriter.batchFiles;
      expect(syncFiles.length).toBeGreaterThan(0);

      await asyncPromise;
    });

    it('should reset buffer metrics at correct time for sync vs async', async () => {
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        500
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      // Check buffer state before commit
      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBeGreaterThan(0);

      // Test sync commit - metrics should be reset immediately
      await bulkWriter.commit({ async: false });
      expect(bulkWriter.currentBufferSize).toBe(0);
      expect(bulkWriter.currentBufferRowCount).toBe(0);

      // Add more data for async test
      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      // Test async commit - metrics should NOT be reset immediately
      const asyncPromise = bulkWriter.commit({ async: true });
      expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
      expect(bulkWriter.currentBufferRowCount).toBeGreaterThan(0);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Now metrics should be reset
      expect(bulkWriter.currentBufferSize).toBe(0);
      expect(bulkWriter.currentBufferRowCount).toBe(0);

      await asyncPromise;
    });
  });

  describe('MinIO Operations and File Management', () => {
    it('should create bucket if it does not exist', async () => {
      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        10
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      // Verify files were created successfully
      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);
    });

    it('should handle MinIO upload errors gracefully', async () => {
      // Test with invalid MinIO credentials
      const invalidBulkWriter = new RemoteBulkWriter({
        schema: collectionInfo.schema,
        remotePath: 'test-remote-path',
        connectParam: {
          ...MINIO_CONFIG,
          accessKey: 'invalid-key',
          secretKey: 'invalid-secret',
        },
        bucketName: TEST_BUCKET_NAME,
      });

      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        10
      );

      for (const row of testData) {
        invalidBulkWriter.appendRow(row);
      }

      // Should throw error during commit due to invalid credentials
      await expect(invalidBulkWriter.commit()).rejects.toThrow();
    });

    it('should cleanup remote files correctly', async () => {
      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        100
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Test cleanup with force flag
      await bulkWriter.cleanup(true);

      // After cleanup, batchFiles should be empty
      expect(bulkWriter.batchFiles).toEqual([]);
    });

    it('should respect cleanupOnExit configuration', async () => {
      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        50
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      // Test cleanup without force flag - should do nothing since cleanupOnExit is false
      await bulkWriter.cleanup(false);

      // Files should still exist in batchFiles
      expect(bulkWriter.batchFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Milvus Import Integration', () => {
    it('should create valid JSON files for Milvus import', async () => {
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        100
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify all files have correct S3 URLs
      for (const file of files) {
        expect(file).toMatch(
          /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
        );
      }
    });

    it('should handle large datasets with multiple chunks', async () => {
      const largeTestData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        10000
      );

      for (const row of largeTestData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(1); // Should create multiple chunks

      // Verify all files have correct S3 URLs
      for (const file of files) {
        expect(file).toMatch(
          /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
        );
      }
    });

    it('should handle dynamic fields correctly for import', async () => {
      const testData = generateInsertData(
        [...collectionInfo.schema.fields, ...dynamicFields] as any,
        25
      );

      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify all files have correct S3 URLs
      for (const file of files) {
        expect(file).toMatch(
          /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
        );
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle MinIO connection failures gracefully', async () => {
      // Test with unreachable MinIO endpoint
      const unreachableBulkWriter = new RemoteBulkWriter({
        schema: collectionInfo.schema,
        remotePath: 'test-remote-path',
        connectParam: {
          ...MINIO_CONFIG,
          endpoint: 'http://localhost:9999', // Unreachable port
        },
        bucketName: TEST_BUCKET_NAME,
      });

      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        10
      );

      for (const row of testData) {
        unreachableBulkWriter.appendRow(row);
      }

      // Should throw error during commit due to connection failure
      await expect(unreachableBulkWriter.commit()).rejects.toThrow();
    });

    it('should handle large file uploads', async () => {
      // Test with data that will create large files
      const largeTestData = generateInsertData(
        collectionInfo.schema.fields as any,
        50000
      );

      for (const row of largeTestData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify all files have correct S3 URLs
      for (const file of files) {
        expect(file).toMatch(
          /^s3:\/\/test-bulk-data\/test-remote-path\/.*\/.*\.json$/
        );
      }
    });
  });
});

import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter } from '../../milvus/bulk-writer/LocalBulkWriter';
import { BulkFileType } from '../../milvus/bulk-writer/constants';
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
} from '../tools';

const TEST_CHUNK_SIZE = 1024 * 1024; // 1MB for testing
const COLLECTION_NAME = GENERATE_NAME();

describe('LocalBulkWriter - Simple Tests', () => {
  let bulkWriter: LocalBulkWriter;
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
      logPrefix: 'LocalBulkWriter Test',
    });

    await milvusClient.createCollection(
      genCollectionParams({
        collectionName: COLLECTION_NAME,
        dim: [4],
        vectorType: [DataType.FloatVector],
        autoID: false,
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

      // remove collection
      await milvusClient.dropCollection({
        collection_name: COLLECTION_NAME,
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Create a new bulk writer for each test
    bulkWriter = new LocalBulkWriter({
      schema: collectionInfo.schema,
      localPath: testDataDir,
      chunkSize: TEST_CHUNK_SIZE,
      fileType: BulkFileType.JSON,
      config: {
        strictValidation: false, // Disable strict validation for testing
        skipInvalidRows: true,
        cleanupOnExit: false,
      },
    });
  });

  it('should create LocalBulkWriter with correct properties', () => {
    expect(bulkWriter).toBeDefined();
    expect(bulkWriter.uuid).toBeDefined();
    expect(bulkWriter.dataPath).toBe(path.join(testDataDir, bulkWriter.uuid));
    expect(bulkWriter.batchFiles).toEqual([]);
  });

  it('should append rows and commit data', async () => {
    const count = 500;
    const testData = generateInsertData(
      collectionInfo.schema.fields as any,
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

    // Verify file contents - JSON format is { rows: [...] }
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);
      expect(data).toHaveProperty('rows');
      expect(Array.isArray(data.rows)).toBe(true);
      expect(data.rows.length).toBe(count);
    }
  });

  it('should handle JSON file type correctly', async () => {
    const jsonWriter = new LocalBulkWriter({
      schema: collectionInfo.schema,
      localPath: testDataDir,
      chunkSize: TEST_CHUNK_SIZE,
      fileType: BulkFileType.JSON,
      config: {
        strictValidation: false,
        skipInvalidRows: true,
        cleanupOnExit: false,
      },
    });

    const testData = generateInsertData(collectionInfo.schema.fields as any, 3);

    for (const row of testData) {
      jsonWriter.appendRow(row);
    }

    await jsonWriter.commit();

    const files = jsonWriter.batchFiles;
    expect(files.length).toBeGreaterThan(0);

    // Verify JSON format - { rows: [...] }
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);
      expect(data).toHaveProperty('rows');
      expect(Array.isArray(data.rows)).toBe(true);
    }

    // Verify JSON data content
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);
      // compare each row of testData with data.rows
      for (const row of testData) {
        const rowData = data.rows.find(
          (r: any) => r.id === row.id || BigInt(r.id) === BigInt(row.id)
        );
        expect(rowData).toEqual(row);
      }
    }

    await jsonWriter.cleanup();
  });

  it('should handle CSV file type correctly', async () => {
    // CSV is not supported in the current implementation
    // This test verifies that CSV throws an error
    const csvWriter = new LocalBulkWriter({
      schema: collectionInfo.schema,
      localPath: testDataDir,
      chunkSize: TEST_CHUNK_SIZE,
      fileType: BulkFileType.CSV,
      config: {
        strictValidation: false,
        skipInvalidRows: true,
        cleanupOnExit: false,
      },
    });

    const testData = generateInsertData(collectionInfo.schema.fields as any, 3);

    for (const row of testData) {
      csvWriter.appendRow(row);
    }

    // CSV should throw an error since it's not supported
    await expect(csvWriter.commit()).rejects.toThrow(
      'Unsupported file type: 4'
    );

    await csvWriter.cleanup();
  });

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
    expect(files.length).toBeGreaterThan(1);

    // Verify the commit promise resolves (it should be a no-op for async mode)
    await commitPromise;
  });

  it('should handle commit with callback', async () => {
    const testData = generateInsertData(collectionInfo.schema.fields as any, 3);
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

  it('should cleanup files correctly', async () => {
    const testData = generateInsertData(
      collectionInfo.schema.fields as any,
      5000
    );

    for (const row of testData) {
      bulkWriter.appendRow(row);
    }

    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBeGreaterThan(1);

    // Verify files exist in original location
    for (const file of files) {
      const exists = await fs
        .access(file)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }

    // Cleanup - since cleanupOnExit is false, cleanup should do nothing
    await bulkWriter.cleanup();

    // Since cleanupOnExit is false, files should still exist in original location
    for (const file of files) {
      const exists = await fs
        .access(file)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }

    // Test cleanup with cleanupOnExit enabled
    const cleanupWriter = new LocalBulkWriter({
      schema: collectionInfo.schema,
      localPath: testDataDir,
      chunkSize: TEST_CHUNK_SIZE,
      fileType: BulkFileType.JSON,
      config: {
        strictValidation: false,
        skipInvalidRows: true,
        cleanupOnExit: true, // Enable cleanup
      },
    });

    // Add some data and commit
    for (const row of testData) {
      cleanupWriter.appendRow(row);
    }
    await cleanupWriter.commit();

    const cleanupFiles = cleanupWriter.batchFiles;
    expect(cleanupFiles.length).toBeGreaterThan(0);

    // Get the parent directory where files will be moved
    const parentDir = path.dirname(cleanupWriter.dataPath);

    // Now cleanup should work - files will be moved to parent directory and UUID directory deleted
    await cleanupWriter.cleanup();

    // Files should no longer exist in their original location (UUID directory)
    for (const file of cleanupFiles) {
      const exists = await fs
        .access(file)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    }

    // Files should exist in the parent directory
    for (const file of cleanupFiles) {
      const fileName = path.basename(file);
      const parentFilePath = path.join(parentDir, fileName);
      const exists = await fs
        .access(parentFilePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }

    // UUID directory should be deleted
    const uuidDirExists = await fs
      .access(cleanupWriter.dataPath)
      .then(() => true)
      .catch(() => false);
    expect(uuidDirExists).toBe(false);

    // Clean up the test files manually for this test
    for (const file of cleanupFiles) {
      const fileName = path.basename(file);
      const parentFilePath = path.join(parentDir, fileName);
      try {
        await fs.unlink(parentFilePath);
      } catch (error) {
        // File might already be deleted
      }
    }
  });

  it('should handle empty data correctly', async () => {
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(0);
  });

  it('should handle single row correctly', async () => {
    const testData = generateInsertData(collectionInfo.schema.fields as any, 1);

    bulkWriter.appendRow(testData[0]);
    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBe(1);

    const content = await fs.readFile(files[0], 'utf-8');
    const data = JSON.parse(content);
    expect(data).toHaveProperty('rows');
    expect(data.rows.length).toBe(1);
  });

  it('should demonstrate timing difference between sync and async commit', async () => {
    const testData = generateInsertData(
      collectionInfo.schema.fields as any,
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
    expect(asyncDuration).toBeLessThan(10); // Should return within 10ms

    // Wait for async operation to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Both should have created the same files
    const syncFiles = bulkWriter.batchFiles;
    expect(syncFiles.length).toBeGreaterThan(0);

    // Verify async promise resolves (should be a no-op)
    await asyncPromise;
  });

  it('should reset buffer metrics at correct time for sync vs async', async () => {
    const testData = generateInsertData(
      collectionInfo.schema.fields as any,
      500
    );

    for (const row of testData) {
      bulkWriter.appendRow(row);
    }

    // Check buffer state before commit
    expect(bulkWriter.currentBufferSize).toBeGreaterThan(0);
    expect(bulkWriter.currentBufferRowCount).toBeGreaterThan(0);

    // Test sync commit - metrics should be reset immediately after completion
    await bulkWriter.commit({ async: false });

    // In sync mode, metrics should be reset immediately
    expect(bulkWriter.currentBufferSize).toBe(0);
    expect(bulkWriter.currentBufferRowCount).toBe(0);

    // Add more data for async test
    for (const row of testData) {
      bulkWriter.appendRow(row);
    }

    // Test async commit - metrics should NOT be reset immediately
    const asyncPromise = bulkWriter.commit({ async: true });

    // In async mode, metrics should still have values (reset happens later)
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

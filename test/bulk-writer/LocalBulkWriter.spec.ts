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
    testDataDir = path.join(__dirname, 'test-data');
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

  afterEach(async () => {
    if (bulkWriter) {
      await bulkWriter.cleanup();
    }
  });

  it('should create LocalBulkWriter with correct properties', () => {
    expect(bulkWriter).toBeDefined();
    expect(bulkWriter.uuid).toBeDefined();
    expect(bulkWriter.dataPath).toBe(testDataDir);
    expect(bulkWriter.batchFiles).toEqual([]);
  });

  it('should append rows and commit data', async () => {
    const testData = generateInsertData(collectionInfo.schema.fields as any, 5);

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
      expect(data.rows.length).toBeGreaterThan(0);
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

    console.dir(testData, { depth: null });

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
      console.dir(data, { depth: null });
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
    const testData = generateInsertData(collectionInfo.schema.fields as any, 3);

    for (const row of testData) {
      bulkWriter.appendRow(row);
    }

    // Test async commit
    await bulkWriter.commit({ async: true });

    // Wait a bit for async operation
    await new Promise(resolve => setTimeout(resolve, 100));

    const files = bulkWriter.batchFiles;
    expect(files.length).toBeGreaterThan(0);
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
    const testData = generateInsertData(collectionInfo.schema.fields as any, 3);

    for (const row of testData) {
      bulkWriter.appendRow(row);
    }

    await bulkWriter.commit();

    const files = bulkWriter.batchFiles;
    expect(files.length).toBeGreaterThan(0);

    // Verify files exist
    for (const file of files) {
      const exists = await fs
        .access(file)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }

    // Cleanup - since cleanupOnExit is false, we need to manually remove files
    // or test that cleanup does nothing when cleanupOnExit is false
    await bulkWriter.cleanup();

    // Since cleanupOnExit is false, files should still exist
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

    // Now cleanup should work, but it only removes empty directories, not files
    await cleanupWriter.cleanup();

    // The cleanup method only removes empty directories, not the actual data files
    // So files should still exist
    for (const file of cleanupFiles) {
      const exists = await fs
        .access(file)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }

    // Clean up the test files manually for this test
    for (const file of cleanupFiles) {
      await fs.unlink(file);
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
});

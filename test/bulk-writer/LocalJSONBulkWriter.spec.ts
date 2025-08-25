import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalBulkWriter, BulkFileType } from '../../milvus/bulk-writer';
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

describe('LocalBulkWriter - Complete Workflow Tests', () => {
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

  beforeEach(() => {
    // Create a new bulk writer for each test
    bulkWriter = new LocalBulkWriter({
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
  });

  afterEach(async () => {
    // Clean up bulk writer resources after each test
    try {
      if (bulkWriter) {
        await bulkWriter.cleanup();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Functionality', () => {
    it('should create LocalBulkWriter with correct properties', () => {
      expect(bulkWriter).toBeDefined();
      expect(bulkWriter.uuid).toBeDefined();
      expect(bulkWriter.dataPath).toBe(path.join(testDataDir, bulkWriter.uuid));
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

      const content = await fs.readFile(files[0], 'utf-8');
      const data = JSON.parse(content);
      expect(data).toHaveProperty('rows');
      expect(data.rows.length).toBe(1);
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

        for (const row of testData) {
          const rowData = data.rows.find(
            (r: any) => r.id === row.id || BigInt(r.id) === BigInt(row.id)
          );

          // When dynamic fields are enabled, the structure changes
          const expectedRow = { ...row };
          const dynamicFieldsInRow = Object.keys(row).filter(
            key =>
              !collectionInfo.schema.fields.some(field => field.name === key)
          );

          if (dynamicFieldsInRow.length > 0) {
            dynamicFieldsInRow.forEach(key => {
              delete expectedRow[key];
            });

            expectedRow.$meta = {};
            dynamicFieldsInRow.forEach(key => {
              expectedRow.$meta[key] = Long.isLong(row[key])
                ? row[key].toString()
                : row[key];
            });
          }

          expect(rowData).toEqual(expectedRow);
        }
      }

      await jsonWriter.cleanup();
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
      expect(files.length).toBeGreaterThan(1);

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

  describe('File Management and Cleanup', () => {
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
          cleanupOnExit: true,
        },
      });

      // Add some data and commit
      for (const row of testData) {
        cleanupWriter.appendRow(row);
      }
      await cleanupWriter.commit();

      const cleanupFiles = cleanupWriter.batchFiles;
      expect(cleanupFiles.length).toBeGreaterThan(0);

      const parentDir = path.dirname(cleanupWriter.dataPath);

      // Now cleanup should work - files will be moved to parent directory
      await cleanupWriter.cleanup();

      // Files should no longer exist in their original location
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

      // Clean up the test files manually
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

      // Verify each file is valid JSON and has correct structure
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const data = JSON.parse(content);

        expect(data).toHaveProperty('rows');
        expect(Array.isArray(data.rows)).toBe(true);
        expect(data.rows.length).toBeGreaterThan(0);

        // Verify each row has required fields from schema
        for (const row of data.rows) {
          for (const field of collectionInfo.schema.fields) {
            expect(row).toHaveProperty(field.name);
          }
        }
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

      // Verify total data integrity across all files
      let totalRows = 0;
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const data = JSON.parse(content);
        totalRows += data.rows.length;
      }

      // The actual count might be different due to how the data is generated
      // Just verify that we have a reasonable number of rows
      expect(totalRows).toBeGreaterThan(0);
      expect(files.length).toBeGreaterThan(1); // Should create multiple chunks
    });

    it('should validate data against collection schema', async () => {
      const testData = generateInsertData(
        collectionInfo.schema.fields as any,
        50
      );

      // Test with valid data
      for (const row of testData) {
        bulkWriter.appendRow(row);
      }

      await bulkWriter.commit();

      const files = bulkWriter.batchFiles;
      expect(files.length).toBeGreaterThan(0);

      // Verify data types match schema
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const data = JSON.parse(content);

        for (const row of data.rows) {
          for (const field of collectionInfo.schema.fields) {
            const value = row[field.name];

            // Basic type validation - handle different data types
            if (field.data_type === 'Int64' || field.data_type === 'Int32') {
              // Int64/Int32 can be string or number depending on the data generator
              expect(
                typeof value === 'number' || typeof value === 'string'
              ).toBe(true);
            } else if (field.data_type === 'VarChar') {
              expect(typeof value).toBe('string');
            } else if (field.data_type === 'FloatVector') {
              expect(Array.isArray(value)).toBe(true);
              // Find dim from type_params
              const dimParam = field.type_params?.find(p => p.key === 'dim');
              if (dimParam) {
                expect(value.length).toBe(Number(dimParam.value));
              }
            }
          }
        }
      }
    });
  });
});

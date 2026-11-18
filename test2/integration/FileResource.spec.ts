import { createClient } from '../support/client';
import { expectHttpSuccess, expectSuccess } from '../support/assertions';
import { TestS3Client as MinioClient } from '../fixtures/s3';
import { execSync } from 'child_process';
import { ErrorCode, HttpClient, MilvusClient } from '../../milvus';
import { GENERATE_NAME, IP } from '../fixtures';

const milvusClient = createClient({ address: IP, logLevel: 'info' });
let minioClient: MinioClient;

const BUCKET_NAME = 'a-bucket';
const RESOURCE_NAME = GENERATE_NAME('file_resource');
const MISSING_RESOURCE_NAME = GENERATE_NAME('missing_file_resource');
const OBJECT_NAME = `node-sdk-file-resource/${RESOURCE_NAME}.txt`;
const MISSING_OBJECT_NAME = `node-sdk-file-resource/${MISSING_RESOURCE_NAME}.txt`;

const createMinioClient = (endPoint: string) =>
  new MinioClient({
    endPoint,
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });

const getMilvusMinioContainerIP = () =>
  execSync(
    `docker inspect milvus-minio --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`,
    { encoding: 'utf8' }
  ).trim();

const putTestObject = async () => {
  const candidates = [
    () => process.env.FILE_RESOURCE_MINIO_ENDPOINT || '127.0.0.1',
    getMilvusMinioContainerIP,
  ];

  let lastError: unknown;
  for (const getEndPoint of candidates) {
    try {
      const endPoint = getEndPoint();
      minioClient = createMinioClient(endPoint);
      await minioClient.putObject(
        BUCKET_NAME,
        OBJECT_NAME,
        Buffer.from('node sdk file resource test\n')
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

describe('FileResource API', () => {
  beforeAll(async () => {
    await putTestObject();
  });

  afterAll(async () => {
    try {
      await milvusClient.removeFileResource({ name: RESOURCE_NAME });
    } catch {
      // best-effort cleanup
    }

    try {
      await minioClient.removeObject(BUCKET_NAME, OBJECT_NAME);
    } catch {
      // best-effort cleanup
    }
  });

  it('should list file resources', async () => {
    const res = await milvusClient.listFileResources();

    expectSuccess(res.status);
    expect(Array.isArray(res.resources)).toEqual(true);
  });

  it('should reject add file resource with missing object path', async () => {
    const res = await milvusClient.addFileResource({
      name: MISSING_RESOURCE_NAME,
      path: MISSING_OBJECT_NAME,
    });

    expect(res.error_code).not.toEqual(ErrorCode.SUCCESS);
  });

  it('registers and lists file resources over REST with exact IDs', async () => {
    const client = new HttpClient({
      endpoint: `http://${IP}`,
      acceptInt64: true,
    });
    const name = RESOURCE_NAME;
    expectHttpSuccess(
      await client.addFileResource({ name, path: OBJECT_NAME })
    );

    try {
      const grpc = await milvusClient.listFileResources();
      expectSuccess(grpc.status);
      const resources = await client.listFileResources();
      expectHttpSuccess(resources);
      expect(resources.data.find(resource => resource.name === name)).toEqual({
        id: grpc.resources.find(resource => resource.name === name)?.id,
        name,
        path: OBJECT_NAME,
      });
    } finally {
      expectHttpSuccess(await client.removeFileResource({ name }));
    }

    const remaining = await client.listFileResources();
    expectHttpSuccess(remaining);
    expect(remaining.data.some(resource => resource.name === name)).toBe(false);
  });

  it('should add, list, and remove file resource', async () => {
    const add = await milvusClient.addFileResource({
      name: RESOURCE_NAME,
      path: OBJECT_NAME,
      timeout: 10000,
    });
    expectSuccess(add);

    const list = await milvusClient.listFileResources({ timeout: 10000 });
    expectSuccess(list.status);

    const resource = list.resources.find(item => item.name === RESOURCE_NAME);
    expect(resource).toBeDefined();
    expect(resource!.path).toEqual(OBJECT_NAME);

    const remove = await milvusClient.removeFileResource({
      name: RESOURCE_NAME,
      timeout: 10000,
    });
    expectSuccess(remove);

    const listAfterRemove = await milvusClient.listFileResources();
    expect(
      listAfterRemove.resources.some(item => item.name === RESOURCE_NAME)
    ).toEqual(false);
  });
});

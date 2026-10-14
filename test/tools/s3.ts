import {
  BucketLocationConstraint,
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

/** S3 fixture operations used by local MinIO integration tests. */
export class TestS3Client {
  private readonly client: S3Client;

  constructor(options: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  }) {
    this.client = new S3Client({
      endpoint: `${options.useSSL ? 'https' : 'http'}://${options.endPoint}:${options.port}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
      // Older MinIO fixtures do not support optional streaming checksums.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: {
        httpAgent: { keepAlive: false },
        httpsAgent: { keepAlive: false },
      },
    });
  }

  async putObject(bucket: string, key: string, body: string | Buffer) {
    return this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body })
    );
  }

  async fPutObject(bucket: string, key: string, filePath: string) {
    const { size } = await stat(filePath);
    const body = createReadStream(filePath);
    try {
      return await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: size,
        })
      );
    } finally {
      body.destroy();
    }
  }

  async removeObject(bucket: string, key: string) {
    return this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  }

  async bucketExists(bucket: string) {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async makeBucket(
    bucket: string,
    region: BucketLocationConstraint | 'us-east-1'
  ) {
    return this.client.send(
      new CreateBucketCommand({
        Bucket: bucket,
        ...(region !== 'us-east-1' && {
          CreateBucketConfiguration: { LocationConstraint: region },
        }),
      })
    );
  }
}

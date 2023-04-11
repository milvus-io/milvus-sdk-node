import path from 'path';
import protobuf, { Root } from 'protobufjs';
import { credentials, Client, InterceptingCall } from '@grpc/grpc-js';
import { ERROR_REASONS } from './const/ErrorReason';
import { getService, formatAddress } from '../utils';

// pathes
const protoPath = path.resolve(__dirname, '../proto/proto/milvus.proto');
const schemaProtoPath = path.resolve(__dirname, '../proto/proto/schema.proto');

// Base Client
export class BaseClient {
  // schema proto
  schemaProto: Root;
  // milvus proto
  milvusProto: Root;
  // client
  grpcClient: Client;

  /**
   * Connect to milvus grpc client.
   * CollectionManager: control collection crud api
   * PartitionManager: control partition crud api
   * IndexManager: control index crud api
   * DataManager: Search | Query | Insert | Flush
   * UserManager: control user crud api
   *
   * @param address milvus address like: 127.0.0.1:19530
   * @param ssl ssl connect or not, default is false
   * @param username After created user in Milvus, username is required
   * @param password After created user in Milvus, password is required
   *
   */
  constructor(
    address: string,
    ssl?: boolean,
    username?: string,
    password?: string
  ) {
    // check address set
    if (!address) {
      throw new Error(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
    let authInterceptor = null;
    // authorization if needed, following pymilvus
    if (username !== undefined && password !== undefined) {
      authInterceptor = function (options: any, nextCall: any) {
        return new InterceptingCall(nextCall(options), {
          start: function (metadata, listener, next) {
            const auth = Buffer.from(
              `${username}:${password}`,
              'utf-8'
            ).toString('base64');
            metadata.add('authorization', auth);

            next(metadata, listener);
          },
        });
      };
    }

    // get Milvus service
    const MilvusService = getService({
      protoPath,
      serviceName: 'milvus.proto.milvus.MilvusService',
    });

    // load proto
    this.schemaProto = protobuf.loadSync(schemaProtoPath);
    this.milvusProto = protobuf.loadSync(protoPath);

    // create grpc client
    this.grpcClient = new MilvusService(
      formatAddress(address),
      ssl ? credentials.createSsl() : credentials.createInsecure(),
      {
        interceptors: [authInterceptor],
        // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
        // So SDK should support max_receive_message_length unlimited.
        'grpc.max_receive_message_length': -1,
      }
    );
  }
}

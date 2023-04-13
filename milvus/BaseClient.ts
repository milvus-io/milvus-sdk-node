import path from 'path';
import protobuf, { Root } from 'protobufjs';
import { credentials, Client } from '@grpc/grpc-js';
import { ERROR_REASONS } from '.';
import { getGRPCService, formatAddress, getAuthInterceptor } from '../utils';

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
    // check if address is set
    if (!address) {
      throw new Error(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }

    // if we need to create auth interceptors
    const needAuth = username !== undefined && password !== undefined;

    // get Milvus GRPC service
    const MilvusService = getGRPCService({
      protoPath,
      serviceName: 'milvus.proto.milvus.MilvusService', // the name of the Milvus service
    });

    // create interceptors
    const interceptors = needAuth
      ? getAuthInterceptor(username, password)
      : null;

    // load proto
    this.schemaProto = protobuf.loadSync(schemaProtoPath);
    this.milvusProto = protobuf.loadSync(protoPath);

    // create grpc client
    this.grpcClient = new MilvusService(
      formatAddress(address), // format the address
      ssl ? credentials.createSsl() : credentials.createInsecure(), // create SSL or insecure credentials
      {
        interceptors: [interceptors],
        // Milvus default max_receive_message_length is 100MB, but Milvus support change max_receive_message_length .
        // So SDK should support max_receive_message_length unlimited.
        'grpc.max_receive_message_length': -1, // set max_receive_message_length to unlimited
      }
    );
  }
}

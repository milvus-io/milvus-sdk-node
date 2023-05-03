import { GRPCClient, ClientConfig, CreateCollectionReq, ResStatus } from '.';
import { ChannelOptions } from '@grpc/grpc-js';

export class MilvusClient extends GRPCClient {
  constructor(
    configOrAddress: ClientConfig | string,
    ssl?: boolean,
    username?: string,
    password?: string,
    channelOptions?: ChannelOptions
  ) {
    super(configOrAddress, ssl, username, password, channelOptions);

    // connect
    this.connect();
  }

  // overload
  connect() {
    super.connect();
  }

  async create(data: CreateCollectionReq): Promise<ResStatus> {
    // create collection
    const createP = await super.createCollection(data);

    // create index
    const createIndexP = await super.createIndex({
      collection_name: data.collection_name,
      field_name: 'abc',
      index_type: 'HNSW',
      metric_type: 'L2',
      params: { nlist: 10 },
    });

    // load index
    const loadP = await this.loadCollection({
      collection_name: data.collection_name,
    });


    return createP;
  }
}

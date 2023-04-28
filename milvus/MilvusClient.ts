import { GRPCClient, MilvusClientConfig } from '.';

export class MilvusClient {
  constructor(...args: ConstructorParameters<typeof GRPCClient>) {
    return new GRPCClient(...args);
  }
}

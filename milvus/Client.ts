import { ERROR_REASONS } from "./const/ErrorReason";

export class Client {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  checkCollectionName(data: any) {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  }

  checkCollectionAndPartitionName(data: any) {
    if (!data || !data.collection_name || !data.partition_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  }
}

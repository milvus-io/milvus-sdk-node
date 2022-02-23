import { ERROR_REASONS } from "./const/ErrorReason";

export class Client {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  /**
   * @ignore
   */
  checkCollectionName(data: any) {
    if (!data || !data.collection_name) {
      throw new Error(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  }
  /**
   * @ignore
   */
  checkCollectionAndPartitionName(data: any) {
    if (!data || !data.collection_name || !data.partition_name) {
      throw new Error(ERROR_REASONS.COLLECTION_PARTITION_NAME_ARE_REQUIRED);
    }
  }
}

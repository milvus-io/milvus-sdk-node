import {
  MilvusClient,
  InsertReq,
  SearchSimpleReq,
  DeleteEntitiesReq,
  QueryReq,
  GetCollectionStatisticsReq,
  DescribeCollectionResponse,
  cloneObj,
} from '../';

interface collectionProps {
  data: DescribeCollectionResponse;
  client: MilvusClient;
}
/**
 * Represents a collection in Milvus.
 */
export class Collection {
  /**
   * The Milvus client used to interact with the collection.
   */
  #client: MilvusClient;

  readonly data: any;

  /**
   * Creates a new collection.
   * @param {Object} props - The properties of the collection.
   * @param {string} props.name - The name of the collection.
   * @param {MilvusClient} props.client - The Milvus client used to interact with the collection.
   */
  constructor({ data, client }: collectionProps) {
    this.data = data;

    // assign private client
    this.#client = client;
  }

  /**
   * Returns the number of entities in the collection.
   */
  async getCount(data: Exclude<GetCollectionStatisticsReq, 'collection_name'>) {
    const getCollectionStatisticsReq = cloneObj(data);
    getCollectionStatisticsReq.collection_name = this.data.collection_name;

    return await this.#client.getCollectionStatistics(
      getCollectionStatisticsReq
    );
  }

  /**
   * Searches for entities in the collection.
   */
  async search(data: Exclude<SearchSimpleReq, 'collection_name'>) {
    const searchSimpleReq = cloneObj(data);
    searchSimpleReq.collection_name = this.data.collection_name;

    return await this.#client.search(searchSimpleReq);
  }

  /**
   * Returns the entities that match the query.
   */
  async get(data: Exclude<QueryReq, 'collection_name'>) {
    const queryReq = cloneObj(data);
    queryReq.collection_name = this.data.collection_name;

    return await this.#client.query(queryReq);
  }

  /**
   * Inserts or upserts entities into the collection.
   */
  async insert(data: Exclude<InsertReq, 'collection_name'>) {
    const insertReq = cloneObj(data);
    insertReq.collection_name = this.data.collection_name;

    return await this.#client.insert(insertReq);
  }

  /**
   * Deletes entities from the collection.
   */
  async delete(data: Exclude<DeleteEntitiesReq, 'collection_name'>) {
    const deleteEntitiesReq = cloneObj(data);
    deleteEntitiesReq.collection_name = this.data.collection_name;

    return await this.#client.deleteEntities(deleteEntitiesReq);
  }

  /**
   * destroy the collection.
   */
  async destroy() {
    return 'delete self';
  }
}

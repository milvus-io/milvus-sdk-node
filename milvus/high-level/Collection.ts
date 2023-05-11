import {
  MilvusClient,
  InsertReq,
  SearchSimpleReq,
  DeleteEntitiesReq,
  QueryReq,
  CreateIndexSimpleReq,
  LoadCollectionReq,
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

  readonly data: DescribeCollectionResponse;

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
  async get() {
    const getCollectionStatisticsReq = {
      collection_name: this.data.collection_name,
    };

    return await this.#client.getCollectionStatistics(
      getCollectionStatisticsReq
    );
  }

  async load(data: Omit<LoadCollectionReq, 'collection_name'> = {}) {
    const loadCollectionReq = cloneObj(data) as LoadCollectionReq;

    loadCollectionReq.collection_name = this.data.collection_name;

    return await this.#client.loadCollectionSync(loadCollectionReq);
  }

  async createIndex(data: Omit<CreateIndexSimpleReq, 'collection_name'>) {
    const createIndexReq = cloneObj(data) as CreateIndexSimpleReq;

    createIndexReq.collection_name = this.data.collection_name;
    // console.log('createIndexReq', createIndexReq);
    return await this.#client.createIndex(createIndexReq);
  }

  /**
   * Searches for entities in the collection.
   */
  async search(data: Omit<SearchSimpleReq, 'collection_name'>) {
    const searchSimpleReq = cloneObj(data) as SearchSimpleReq;
    searchSimpleReq.collection_name = this.data.collection_name;

    return await this.#client.search(searchSimpleReq);
  }

  /**
   * Returns the entities that match the query.
   */
  async query(data: Omit<QueryReq, 'collection_name'>) {
    const queryReq = cloneObj(data) as QueryReq;
    queryReq.collection_name = this.data.collection_name;

    return await this.#client.query(queryReq);
  }

  /**
   * Inserts or upserts entities into the collection.
   */
  async insert(data: Omit<InsertReq, 'collection_name'>) {
    const insertReq = cloneObj(data) as InsertReq;
    insertReq.collection_name = this.data.collection_name;

    return await this.#client.insert(insertReq);
  }

  /**
   * Deletes entities from the collection.
   */
  async delete(data: Omit<DeleteEntitiesReq, 'collection_name'>) {
    const deleteEntitiesReq = cloneObj(data) as DeleteEntitiesReq;
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

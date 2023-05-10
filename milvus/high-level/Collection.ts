import { MilvusClient, DescribeCollectionResponse } from '../';

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
  async getCount() {
    return 'num of entities';
  }

  /**
   * Searches for entities in the collection.
   */
  async search() {
    return 'search result';
  }

  /**
   * Returns the entities that match the query.
   */
  async get() {
    return 'query result';
  }

  /**
   * Inserts or upserts entities into the collection.
   */
  async insert() {
    return 'insert or upsert entities';
  }

  /**
   * Deletes entities from the collection.
   */
  async delete() {
    return 'delete entities';
  }

  /**
   * destroy the collection.
   */
  async destroy() {
    return 'delete self';
  }
}

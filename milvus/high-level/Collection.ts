import { MilvusClient, DataType } from '../';

interface collectionProps {
  name: string;
  client: MilvusClient;
}
/**
 * Represents a collection in Milvus.
 */
export class Collection {
  /**
   * The name of the collection.
   */
  name: string;
  /**
   * The Milvus client used to interact with the collection.
   */
  client: MilvusClient;

  /**
   * Creates a new collection.
   * @param {Object} props - The properties of the collection.
   * @param {string} props.name - The name of the collection.
   * @param {MilvusClient} props.client - The Milvus client used to interact with the collection.
   */
  constructor({ name, client }: collectionProps) {
    // assign value
    this.name = name;
    this.client = client;

    // create collection
    this.client.createCollection({
      collection_name: this.name,
      description: '',
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: 128,
        },
      ],
    });
  }

  /**
   * Returns the number of entities in the collection.
   */
  get count() {
    return 'num of entities';
  }

  /**
   * Returns information about the collection.
   */
  get info() {
    return 'collection info';
  }

  /**
   * Returns the schema of the collection.
   */
  get schema() {
    return 'schema';
  }

  /**
   * Searches for entities in the collection.
   */
  search() {
    return 'search result';
  }

  /**
   * Returns the entities that match the query.
   */
  get() {
    return 'query result';
  }

  /**
   * Inserts or upserts entities into the collection.
   */
  insert() {
    return 'insert or upsert entities';
  }

  /**
   * Deletes entities from the collection.
   */
  delete() {
    return 'delete entities';
  }

  /**
   * destroy the collection.
   */
  destroy() {
    return 'delete self';
  }
}

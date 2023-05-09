import { MilvusClient, DataType, MetricType, FieldType } from '../';

interface collectionProps {
  data: {
    name: string;
    dimension: number;
    description?: string;
    metric?: MetricType;
    fields?: FieldType[];
  };
  client: MilvusClient;
}
/**
 * Represents a collection in Milvus.
 */
export class Collection {
  /**
   * The name of the collection.
   */
  readonly name: string;
  /**
   * The Milvus client used to interact with the collection.
   */
  #client: MilvusClient;

  readonly dimension: number;
  readonly metric: MetricType;
  readonly fields: FieldType[];
  readonly description: string;

  /**
   * Creates a new collection.
   * @param {Object} props - The properties of the collection.
   * @param {string} props.name - The name of the collection.
   * @param {MilvusClient} props.client - The Milvus client used to interact with the collection.
   */
  constructor({ data, client }: collectionProps) {
    const {
      name,
      dimension,
      fields,
      metric = MetricType.L2,
      description = '',
    } = data;

    // assign private client
    this.#client = client;

    // assign public values
    this.name = name;
    this.dimension = dimension;
    this.metric = metric;
    this.fields = fields ?? [
      {
        name: 'id',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      {
        name: 'vector',
        data_type: DataType.FloatVector,
        dim: this.dimension,
      },
    ];
    this.description = description;
  }

  // create collection here
  async init() {
    await this.#client.createCollection({
      collection_name: this.name,
      description: this.description,
      fields: this.fields,
    });
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

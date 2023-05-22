import {
  MilvusClient,
  InsertReq,
  SearchSimpleReq,
  DeleteEntitiesReq,
  QueryReq,
  CreateIndexSimpleReq,
  LoadCollectionReq,
  cloneObj,
} from '../';

interface collectionProps {
  name: string;
  client: MilvusClient;
}

// This class represents a collection in Milvus.
export class Collection {
  // The private client that is used to communicate with Milvus.
  #client: MilvusClient;

  // The name of the collection.
  readonly name: string;

  // Creates a new `Collection` instance.
  constructor({ name, client }: collectionProps) {
    // Set the name of the collection.
    this.name = name;
    // Assign the private client.
    this.#client = client;
  }

  // Returns the number of entities in the collection.
  async count() {
    // Create a request object to get the collection statistics.
    const getCollectionStatisticsReq = {
      collection_name: this.name,
    };

    // Get the collection statistics from Milvus.
    const stats = await this.#client.getCollectionStatistics(
      getCollectionStatisticsReq
    );

    // Return the number of entities in the collection.
    return Number(stats.data.row_count);
  }

  // Returns information about the collection, such as its schema.
  async info() {
    // Get the information about the collection from Milvus.
    return await this.#client.describeCollection({
      collection_name: this.name,
    });
  }

  // Loads the collection from disk.
  async load(data: Omit<LoadCollectionReq, 'collection_name'> = {}) {
    // Create a request object to load the collection.
    const loadCollectionReq = cloneObj(data) as LoadCollectionReq;

    // Load the collection from disk.
    loadCollectionReq.collection_name = this.name;

    return await this.#client.loadCollectionSync(loadCollectionReq);
  }

  // Creates an index for the collection.
  async createIndex(data: Omit<CreateIndexSimpleReq, 'collection_name'>) {
    // Create a request object to create the index.
    const createIndexReq = cloneObj(data) as CreateIndexSimpleReq;

    createIndexReq.collection_name = this.name;
    // console.log('createIndexReq', createIndexReq);
    return await this.#client.createIndex(createIndexReq);
  }

  // Searches the collection for entities that match a given query.
  async search(data: Omit<SearchSimpleReq, 'collection_name'>) {
    // Create a request object to search the collection.
    const searchSimpleReq = cloneObj(data) as SearchSimpleReq;

    searchSimpleReq.collection_name = this.name;

    return await this.#client.search(searchSimpleReq);
  }

  // Queries the collection for entities that match a given query.
  async query(data: Omit<QueryReq, 'collection_name'>) {
    // Create a request object to query the collection.
    const queryReq = cloneObj(data) as QueryReq;

    queryReq.collection_name = this.name;

    return await this.#client.query(queryReq);
  }
  // alias
  get = this.query;

  // Inserts an entity into the collection.
  async insert(data: Omit<InsertReq, 'collection_name'>) {
    // Create a request object to insert the entity.
    const insertReq = cloneObj(data) as InsertReq;

    insertReq.collection_name = this.name;

    return await this.#client.insert(insertReq);
  }

  // Deletes an entity from the collection.
  async delete(data: Omit<DeleteEntitiesReq, 'collection_name'>) {
    // Create a request object to delete the entity.
    const deleteEntitiesReq = cloneObj(data) as DeleteEntitiesReq;

    deleteEntitiesReq.collection_name = this.name;

    return await this.#client.deleteEntities(deleteEntitiesReq);
  }
}

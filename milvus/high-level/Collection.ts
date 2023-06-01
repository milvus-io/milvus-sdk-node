import {
  MilvusClient,
  InsertReq,
  SearchSimpleReq,
  DeleteEntitiesReq,
  QueryReq,
  CreateIndexSimpleReq,
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

  // param
  private get param() {
    return { collection_name: this.name };
  }

  // Creates a new `Collection` instance.
  constructor({ name, client }: collectionProps) {
    // Set the name of the collection.
    this.name = name;
    // Assign the private client.
    this.#client = client;
  }

  // Returns the number of entities in the collection.
  async count() {
    // Get the collection statistics from Milvus.
    const stats = await this.#client.getCollectionStatistics(this.param);

    // Return the number of entities in the collection.
    return Number(stats.data.row_count);
  }

  // Returns information about the collection, such as its schema.
  async info() {
    // Get collection info
    const collectionInfo = await this.#client.describeCollection(this.param);
    // get Index info
    const indexInfo = await this.#client.describeIndex(this.param);

    // combine information and return
    return { ...collectionInfo, ...indexInfo };
  }

  // Loads the collection from disk.
  async load() {
    return await this.#client.loadCollectionSync(this.param);
  }

  // release the collection from memory.
  async release() {
    return await this.#client.releaseCollection(this.param);
  }

  // Creates an index for the collection.
  async createIndex(
    data: Omit<CreateIndexSimpleReq, 'collection_name'> = {
      field_name: 'vector',
      index_type: 'HNSW',
      metric_type: 'L2',
      params: { efConstruction: 10, M: 4 },
    }
  ) {
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

  // alias
  get = this.query;
  index = this.createIndex;
}

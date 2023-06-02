import {
  MilvusClient,
  InsertReq,
  SearchSimpleReq,
  DeleteEntitiesReq,
  QueryReq,
  CreateIndexSimpleReq,
  cloneObj,
  DataTypeMap,
  DataType,
  findKeyValue,
} from '..';
import { getDefaultIndexParams } from '.';

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

  // pk field name
  pkFieldName: string = '';
  // vector filed name
  vectorFieldName: string = '';
  // vector type
  vectorType: DataType = DataType.FloatVector;
  // vector dimension
  dim: number = 0;

  // Creates a new `Collection` instance.
  constructor({ name, client }: collectionProps) {
    // Set the name of the collection.
    this.name = name;
    // Assign the private client.
    this.#client = client;
  }

  // init collection, get key informations from server
  async init(loadOnInit: boolean) {
    // update information
    await this.update();
    // load
    if (loadOnInit) {
      await this.index();
      await this.load();
    }
  }

  // update key information
  async update() {
    // Get collection info
    const collectionInfo = await this.#client.describeCollection(this.param);

    // extract key information
    for (let i = 0; i < collectionInfo.schema.fields.length; i++) {
      const f = collectionInfo.schema.fields[i];
      const type = DataTypeMap[f.data_type];

      // get pk field info
      if (f.is_primary_key) {
        this.pkFieldName = f.name;
      }

      // get vector field info
      if (type === DataType.FloatVector || type === DataType.BinaryVector) {
        // vector field
        this.vectorFieldName = f.name;
        // vector type
        this.vectorType = type;
        // get dimension
        this.dim = Number(findKeyValue(f.type_params, 'dim') as number);
      }
    }
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
    data: Omit<
      CreateIndexSimpleReq,
      'collection_name' | 'field_name'
    > = getDefaultIndexParams()
  ) {
    // Create a request object to create the index.
    const createIndexReq = cloneObj(data) as CreateIndexSimpleReq;

    // build index req parameters
    createIndexReq.collection_name = this.name;
    createIndexReq.field_name = this.vectorFieldName;
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

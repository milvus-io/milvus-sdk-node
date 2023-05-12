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

export class Collection {
  #client: MilvusClient;

  readonly name: string;

  constructor({ name, client }: collectionProps) {
    // set name
    this.name = name;
    // assign private client
    this.#client = client;
  }

  async count() {
    const getCollectionStatisticsReq = {
      collection_name: this.name,
    };

    const stats = await this.#client.getCollectionStatistics(
      getCollectionStatisticsReq
    );

    return Number(stats.data.row_count);
  }

  async info() {
    // return this.data && this.data.schema;
    return await this.#client.describeCollection({
      collection_name: this.name,
    });
  }

  async load(data: Omit<LoadCollectionReq, 'collection_name'> = {}) {
    const loadCollectionReq = cloneObj(data) as LoadCollectionReq;

    loadCollectionReq.collection_name = this.name;

    return await this.#client.loadCollectionSync(loadCollectionReq);
  }

  async createIndex(data: Omit<CreateIndexSimpleReq, 'collection_name'>) {
    const createIndexReq = cloneObj(data) as CreateIndexSimpleReq;

    createIndexReq.collection_name = this.name;
    // console.log('createIndexReq', createIndexReq);
    return await this.#client.createIndex(createIndexReq);
  }

  async search(data: Omit<SearchSimpleReq, 'collection_name'>) {
    const searchSimpleReq = cloneObj(data) as SearchSimpleReq;
    searchSimpleReq.collection_name = this.name;

    return await this.#client.search(searchSimpleReq);
  }

  async query(data: Omit<QueryReq, 'collection_name'>) {
    const queryReq = cloneObj(data) as QueryReq;
    queryReq.collection_name = this.name;

    return await this.#client.query(queryReq);
  }
  // alias
  get = this.query;

  async insert(data: Omit<InsertReq, 'collection_name'>) {
    const insertReq = cloneObj(data) as InsertReq;
    insertReq.collection_name = this.name;

    return await this.#client.insert(insertReq);
  }

  async delete(data: Omit<DeleteEntitiesReq, 'collection_name'>) {
    const deleteEntitiesReq = cloneObj(data) as DeleteEntitiesReq;
    deleteEntitiesReq.collection_name = this.name;

    return await this.#client.deleteEntities(deleteEntitiesReq);
  }
}

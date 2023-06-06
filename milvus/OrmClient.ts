import { ShowCollectionsReq, CreateColReq, MilvusClient } from './';
import { Collection } from './orm';

/**
 * ORM client that extends Milvus client
 */
export class OrmClient extends MilvusClient {
  // ORM-like APIs
  /**
   * Creates a new collection with the given name and schema, or returns an existing one with the same name.
   * @param data An object containing the collection name, dimension, schema (optional), enable_dynamic_field (optional), and description (optional).
   * @returns A Collection object representing the newly created or existing collection, and it is indexed and loaded
   */
  async collection(data: CreateColReq): Promise<Collection> {
    // create collection using high-level API
    await this.createCollection(data);
    // return collection object
    const col = new Collection({ name: data.collection_name, client: this });
    // init 
    await col.init();
    return col;
  }

  /**
   * Retrieves a list of collections from the Milvus server.
   * @param data An optional object containing parameters for filtering the list of collections.
   * @returns An array of Collection objects representing the collections returned by the server.
   */
  async collections(data?: ShowCollectionsReq) {
    const cols = await this.showCollections(data);

    return cols.data.map(col => {
      return new Collection({ name: col.name, client: this });
    });
  }
}

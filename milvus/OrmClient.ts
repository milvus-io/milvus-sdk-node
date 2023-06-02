import { ShowCollectionsReq, DataType, CreateColReq, MilvusClient } from './';
import { Collection, buildSchema } from './orm';

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
    // get params
    const {
      collection_name,
      dimension,
      primary_field_name = 'id',
      id_type = DataType.Int64,
      vector_field_name = 'vector',
      enableDynamicField = true,
      loadOnInit = true,
    } = data;

    // check exist
    const exist = await this.hasCollection({ collection_name });

    // build schema
    const schema = buildSchema({
      primary_field_name,
      id_type,
      vector_field_name,
      dimension,
    });

    // not exist, create a new one
    if (!exist.value) {
      // create a new collection with fixed schema
      await this.createCollection({
        collection_name,
        enable_dynamic_field: enableDynamicField,
        fields: schema,
      });
    }

    // return collection object
    const col = new Collection({
      name: collection_name,
      client: this,
    });

    try {
      // init
      await col.init(loadOnInit);
    } catch (error) {
      console.log('creation error ', error);
    }

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

/**
 * This is only for typedoc documentation.
 * We write all method comments here.
 *
 */
import { Collection } from "./Collection";
import { Data } from "./Data";
import { Index } from "./MilvusIndex";
import { Partition } from "./Partition";

const CollectionInstance = new Collection("");

/**
 * This method is used to create collection in milvus
 * @param data
 * @return
 */
export const createCollection = CollectionInstance.createCollection;

/**
 * Check collection exist or not
 * @param data
 * @returns
 */
export const hasCollection = CollectionInstance.hasCollection;

/**
 * List all collections with their names and ids
 *
 * @returns
 */
export const showCollections = CollectionInstance.showCollections;

/**
 * Get collection detail, like name ,schema
 * @param data
 * @returns DescribeCollectionResponse
 */
export const describeCollection = CollectionInstance.describeCollection;

/**
 * Will return collection statistics.
 * Only row_count for now.
 * @param data
 * @returns
 */
export const getCollectionStatistics =
  CollectionInstance.getCollectionStatistics;

/**
 * Befor search need load collection to cache.
 * It's async method
 * @param data collection name
 * @returns
 */
export const loadCollection = CollectionInstance.loadCollection;

/**
 * If you want to reduce your cache usage, you can release some collections.
 * You cant search in unload collections.
 * It's async method
 * @param data
 * @returns
 */
export const releaseCollection = CollectionInstance.releaseCollection;

/**
 * Drop collection, also will drop all datas in this collection.
 * @param data collection name
 * @returns
 */
export const dropCollection = CollectionInstance.dropCollection;

const PartitionInstance = new Partition("");

/**
 * Create partition in one collection
 * @param data
 * @returns
 */
export const createPartition = PartitionInstance.createPartition;

/**
 * Check partition exist or not in one collection
 * @param data
 * @returns
 */
export const hasPartition = PartitionInstance.hasPartition;

/**
 * Show all partitions in one collection with their names and ids.
 * @param data
 * @returns
 */
export const showPartitions = PartitionInstance.showPartitions;

/**
 * Get partition statistics like row_count for one partition.
 * @param data
 * @returns
 */
export const getPartitionStatistics = PartitionInstance.getPartitionStatistics;

/**
 * Load partition data into cache
 * @param data
 * @returns
 */
export const loadPartitions = PartitionInstance.loadPartitions;

/**
 * Release some partitions data from cache, then you can not search these data
 * @param data
 * @returns
 */
export const releasePartitions = PartitionInstance.releasePartitions;

/**
 * Drop partition will drop all data in this partition.
 * Default partition can not droped.
 * @param data
 * @returns
 */
export const dropPartition = PartitionInstance.dropPartition;

const IndexInstance = new Index("");

/**
 * Creat index on vector field, it will be async progress.
 * Binary field support index: https://milvus.io/docs/v2.0.0/metric.md#binary
 * Float field support index: https://milvus.io/docs/v2.0.0/metric.md#floating
 * @param data
 * @returns
 */
export const createIndex = IndexInstance.createIndex;

/**
 * Get index infos.
 * @param data
 * @returns
 */
export const describeIndex = IndexInstance.describeIndex;

/**
 * Get index build state, it will be async progress
 * @param data
 * @returns
 */
export const getIndexState = IndexInstance.getIndexState;

/**
 * Get index building progress.
 * You can get indexed rows and total rows here
 * @param data
 * @returns
 */
export const getIndexBuildProgress = IndexInstance.getIndexBuildProgress;

/**
 * Drop index, it will be async progress.
 * @param data
 * @returns
 */
export const dropIndex = IndexInstance.dropIndex;

const DataInstance = new Data("", CollectionInstance);

/**
 * if field type is binary, the vector data length need to be dimension / 8 query
 * fields_data: [{id:1,age:2,time:3,face:[1,2,3,4]}]
 *
 * hash_keys: need transfer primary key value to hash, then pass to milvus
 * num_rows: The row length you want to insert.
 *
 * After insert data you may need flush this collection.
 */
export const insert = DataInstance.insert;

/**
 * vector similarity search
 * @param data
 * @returns
 */
export const search = DataInstance.search;

/**
 * After insert vector data, need flush .
 * @param data
 * @returns
 */
export const flush = DataInstance.flush;

/**
 * Get data by expr.
 * Now we only support expr like: fieldname in [id1,id2,id3]
 * @param data
 * @returns
 */
export const query = DataInstance.getDataByExpr;

import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';

/**
 * hybridSearchIterator: stream a hybrid search as RRF-fused batches.
 *
 * Each request in `data` is iterated as its own stateless single-modality
 * search_iterator; the score-descending streams are fused client-side with
 * Reciprocal Rank Fusion. `searchIterator` likewise accepts an emb_list
 * (array-of-vector) query -- pass that query's multiple vectors as `data`
 * against an emb_list `anns_field` (see the commented call below).
 */

const COLLECTION_NAME = 'hybrid_search_iterator_demo';

(async () => {
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    logLevel: 'info',
  });

  const dim = 8;

  await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: 'id',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: true,
      },
      { name: 'title', data_type: DataType.VarChar, max_length: 128 },
      { name: 'dense_a', data_type: DataType.FloatVector, dim },
      { name: 'dense_b', data_type: DataType.FloatVector, dim },
    ],
  });

  const rows = 5000;
  const data = [];
  for (let i = 0; i < rows; i++) {
    data.push({
      title: `doc_${i}`,
      dense_a: new Array(dim).fill(0).map(() => Math.random()),
      dense_b: new Array(dim).fill(0).map(() => Math.random()),
    });
  }
  await milvusClient.insert({ collection_name: COLLECTION_NAME, data });
  await milvusClient.flush({ collection_names: [COLLECTION_NAME] });

  for (const field of ['dense_a', 'dense_b']) {
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: field,
      metric_type: 'COSINE',
    });
  }
  await milvusClient.loadCollectionSync({ collection_name: COLLECTION_NAME });

  // --- hybrid search_iterator: RRF fusion of two modalities, streamed ---------
  const hybrid = await milvusClient.hybridSearchIterator({
    collection_name: COLLECTION_NAME,
    data: [
      { anns_field: 'dense_a', data: new Array(dim).fill(0).map(Math.random) },
      { anns_field: 'dense_b', data: new Array(dim).fill(0).map(Math.random) },
    ],
    batchSize: 200,
    rrf_k: 60,
    output_fields: ['title'],
  });

  let page = 0;
  for await (const batch of hybrid) {
    page += 1;
    // each batch is RRF-descending; `score` is the NRA lower bound on the RRF score
    console.log(`hybrid page ${page}: ${batch.length} fused hits`, batch[0]);
  }

  // --- emb_list search_iterator (shape reference) ----------------------------
  // For an emb_list (array-of-vector) field, pass one query's multiple vectors
  // as `data` against the emb_list `anns_field`:
  //
  //   const it = await milvusClient.searchIterator({
  //     collection_name: COLLECTION_NAME,
  //     anns_field: 'paragraph_vectors',          // an emb_list field
  //     data: [[/* vec1 */], [/* vec2 */], [/* vec3 */]],
  //     batchSize: 200,
  //   });
  //   for await (const batch of it) { console.log(batch); }

  await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
})();

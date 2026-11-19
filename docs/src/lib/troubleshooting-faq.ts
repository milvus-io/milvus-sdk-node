export const troubleshootingFaq = [
  {
    id: 'npm-package-milvus-3',
    question: 'Which npm package should I use with Milvus 3.0?',
    answer:
      'Install @zilliz/milvus2-sdk-node@3. The official Milvus Node.js SDK kept its package name for Milvus 3.0. SDK 3.x also supports core operations on compatible Milvus 2.x deployments and Zilliz Cloud.',
  },
  {
    id: 'search-returns-no-results',
    question: 'Why does my Milvus search return no results?',
    answer:
      'Make sure the collection has an index and is loaded on query nodes. In the gRPC SDK, call loadCollection with the collection name and await it so loading can finish before you search. Then check that your filter matches rows, your vector targets the right field, and your consistency level makes recent inserts visible.',
  },
  {
    id: 'snake-case-vs-camelcase',
    question: 'Should SDK request fields use snake_case or camelCase?',
    answer:
      'Use snake_case for gRPC MilvusClient request fields such as collection_name and output_fields. Use camelCase for the equivalent REST HttpClient fields, collectionName and outputFields.',
  },
  {
    id: 'int64-primary-key-precision',
    question: 'How do I preserve Int64 primary key precision in JavaScript?',
    answer:
      'Use decimal strings for Int64 primary keys that may exceed Number.MAX_SAFE_INTEGER. Keep large IDs as strings end to end. The REST HttpClient defaults to acceptInt64: false, which requests precision-preserving string IDs from Milvus.',
  },
  {
    id: 'serverless-endpoint-vs-baseurl',
    question: 'Should I set endpoint or baseURL in a serverless HttpClient?',
    answer:
      'Set endpoint to the cluster origin, for example https://your-cluster.example.com. HttpClient appends /v2 automatically. If you override baseURL, supply the complete versioned URL ending in /v2 or Milvus REST calls can return 404.',
  },
];

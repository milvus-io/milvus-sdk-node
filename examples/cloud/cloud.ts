import pQueue from 'p-queue';
import { MilvusClient, DataType, ConsistencyLevelEnum } from '../../milvus';

export async function main() {
  console.log('Starting test');

  // Create a single client with proper connection pool settings
  const client = new MilvusClient({
    address: '127.0.0.1:19530',
    logLevel: 'info',
    username: process.env.MILVUS_USERNAME!,
    password: process.env.MILVUS_PASSWORD!,
    pool: {
      max: 200, // Maximum number of connections
      min: 50, // Minimum number of connections
      idleTimeoutMillis: 30000, // How long a connection can be idle before being removed
      evictionRunIntervalMillis: 10000, // How often to check for idle connections
      numTestsPerEvictionRun: 3, // Number of connections to test per eviction run
    },
  });

  console.log('Milvus client created with connection pool');

  const useTurbopuffer = false;
  const tenant_id: string = 'TENANT_ID';

  const queryResults: Array<any> = [];
  const randomVector = Array.from({ length: 768 }, () => Math.random());

  const totalQueries = 1000;
  // Test different concurrency levels to see how connection pool handles load
  const parallelQueriesArr = [1, 5, 10, 20, 50, 100, 250, 500];

  let errorCount = 0;
  for (const parallelQueries of parallelQueriesArr) {
    console.log(`Running with ${parallelQueries} parallel queries`);

    const startTimeGlobal = Date.now();
    let timeSum = 0;
    await mapAsync(
      Array.from({ length: totalQueries }),
      async (i, idx) => {
        const startTime = Date.now();

        let success = false;
        while (!success) {
          try {
            let search;
            if (useTurbopuffer) {
              console.log('exit');
            } else {
              search = await client.search({
                collection_name: tenant_id,
                vector: randomVector,
                limit: 100,
                vector_type: DataType.FloatVector,
                output_fields: ['id', 'base_jsonData'],
                consistency_level: ConsistencyLevelEnum.Eventually,
              });
            }
            success = true;
          } catch (e) {
            console.error(e);
            errorCount++;

            if (errorCount > 100) {
              // Something is wrong
              throw e;
            }
          }
        }

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        timeSum += responseTime;

        queryResults.push({ latency: responseTime });
      },
      { concurrency: parallelQueries }
    );

    const durationGlobal = Date.now() - startTimeGlobal;
    console.log(`Time taken: ${durationGlobal} milliseconds`);

    const averageLatency =
      queryResults.reduce((acc, curr) => acc + curr.latency, 0) /
      queryResults.length;

    const p99Latency = queryResults.sort((a, b) => a.latency - b.latency)[
      Math.floor(queryResults.length * 0.99)
    ].latency;

    const report = {
      parallelQueries,
      totalTime: durationGlobal,
      qps: (totalQueries / durationGlobal) * 1000,
      totalQueries,
      averageLatency,
      p99Latency,
      db: useTurbopuffer ? 'turbopuffer' : 'milvus',
      errorCount,
    };

    console.log(report);
  }
}

async function mapAsync<T, Y>(
  arr: ReadonlyArray<T>,
  delegate: (value: T, index: number) => Promise<Y>,
  opts: { concurrency: number }
): Promise<Array<Y>> {
  const queue = new pQueue(opts);

  const promises = arr.map(
    (value, index) => queue.add(() => delegate(value, index)) as Promise<Y>
  );

  return Promise.all(promises);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));

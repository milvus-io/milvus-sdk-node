import { httpLifecycle } from './httpLifecycle';

/** External suites require explicit endpoint/token configuration, never placeholder credentials. */
export function cloudHttpCase(kind: 'dedicated' | 'serverless') {
  const prefix = `MILVUS_${kind.toUpperCase()}`;
  const endpoint = process.env[`${prefix}_ENDPOINT`];
  const token = process.env[`${prefix}_TOKEN`];
  describe(`${kind} HTTP cloud contract`, () => {
    if (!endpoint || !token) {
      it.skip(`requires ${prefix}_ENDPOINT and ${prefix}_TOKEN`, () => {});
      return;
    }
    it(
      'completes the shared collection/data lifecycle',
      () =>
        httpLifecycle({
          endpoint,
          token,
          database: process.env[`${prefix}_DATABASE`],
        }),
      120_000
    );
  });
}

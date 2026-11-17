import { inspect } from 'util';
import { ErrorCode } from '../../milvus';

/** Keep the complete server status (especially reason) in CLI and CI failures. */
export function expectSuccess(result: unknown) {
  const response = result as { status?: unknown };
  const status = (response.status || response) as { error_code?: unknown };
  if (status.error_code !== ErrorCode.SUCCESS) {
    throw new Error(`Milvus returned ${inspect(status, { depth: 5 })}`);
  }
}

/** HTTP APIs use numeric codes and put diagnostics alongside the code. */
export function expectHttpSuccess(result: unknown) {
  if ((result as { code?: number }).code !== 0) {
    throw new Error(`Milvus HTTP returned ${inspect(result, { depth: 5 })}`);
  }
}

/** Server validation is a failed status, distinct from SDK/transport rejection. */
export function expectFailureStatus(result: unknown, reason: RegExp) {
  const response = result as { status?: unknown };
  const status = (response.status || response) as {
    error_code?: string;
    reason?: string;
  };
  expect(status).toMatchObject({
    error_code: expect.any(String),
    reason: expect.stringMatching(reason),
  });
  expect(status.error_code).not.toBe(ErrorCode.SUCCESS);
}

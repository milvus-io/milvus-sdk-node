import { expectHttpSuccess } from '../support/assertions';
import { timeoutTest } from '../fixtures/utils';
import { expectSuccess, step } from '../support/scenario';
import { mixedRows, mixedSchema } from '../fixtures/schemas';

describe('Test infrastructure regression guards', () => {
  it('fails when a timeout operation unexpectedly resolves', async () => {
    await expect(timeoutTest(async () => undefined)()).rejects.toThrow();
  });
  it('fails for the wrong error and accepts a real deadline failure', async () => {
    await expect(
      timeoutTest(async () => {
        throw new Error('wrong');
      })()
    ).rejects.toThrow();
    await timeoutTest(async () => {
      throw new Error('DEADLINE_EXCEEDED');
    })();
  });
  it('preserves server reason and scenario phase in failures', async () => {
    await expect(
      step('insert boundary rows', async () => {
        expectSuccess({
          status: {
            error_code: 'IllegalArgument',
            reason: 'invalid vector dimension',
          },
        });
      })
    ).rejects.toThrow(/insert boundary rows/);
    try {
      expectSuccess({
        error_code: 'IllegalArgument',
        reason: 'invalid vector dimension',
      });
      throw new Error('unexpected success');
    } catch (error) {
      expect(error.message).toContain('invalid vector dimension');
    }
  });
  it('returns independent schemas and deterministic boundary rows', () => {
    const schema = mixedSchema();
    schema.fields[0].name = 'changed';
    expect(mixedSchema().fields[0].name).toBe('id');
    expect(mixedRows()).toEqual(mixedRows());
    expect(mixedRows()[0]).not.toHaveProperty('optional');
    expect(mixedRows()[1].optional).toBeNull();
    expect(mixedRows()[2].optional).toBe('');
  });
});

describe('HTTP diagnostics', () => {
  it('retains numeric error codes and server messages and rejects missing codes', () => {
    expect(() =>
      expectHttpSuccess({ code: 1100, message: 'invalid dimension' })
    ).toThrow('invalid dimension');
    expect(() => expectHttpSuccess({})).toThrow('Milvus HTTP returned');
    expectHttpSuccess({ code: 0, data: [] });
  });
});

describe('state polling diagnostics', () => {
  it('reports the last state and the operation name when polling expires', async () => {
    jest.useFakeTimers();
    try {
      const { waitFor } = await import('../support/wait');
      const pending = expect(
        waitFor(
          'index ready',
          async () => ({ state: 'Building', progress: 30 }),
          () => false,
          { timeout: 5, interval: 1 }
        )
      ).rejects.toThrow(/index ready[\s\S]*Building[\s\S]*30/);
      await jest.advanceTimersByTimeAsync(6);
      await pending;
    } finally {
      jest.useRealTimers();
    }
  });
});

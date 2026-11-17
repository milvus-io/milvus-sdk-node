import { inspect } from 'util';
import { randomBytes } from 'crypto';
import { MilvusClient } from '../../milvus';
import { IP } from '../fixtures/ip';

export { expectSuccess } from './assertions';
import { expectSuccess } from './assertions';

/** Preserve Jest's original diff and stack while identifying the failed lifecycle phase. */
export async function step<T>(
  name: string,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Error) {
      error.message = `[scenario step: ${name}] ${error.message}`;
      throw error;
    }
    throw new Error(`[scenario step: ${name}] ${inspect(error)}`);
  }
}

/** Isolate each scenario and clean up even when setup or an assertion fails. */
export async function withCollection(
  action: (client: MilvusClient, collection: string) => Promise<void>
) {
  const client = new MilvusClient({ address: IP });
  const collection = `scenario_${randomBytes(8).toString('hex')}`;
  let primaryError: unknown;
  try {
    await action(client, collection);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await step(`cleanup ${collection}`, async () => {
        const exists = await client.hasCollection({
          collection_name: collection,
        });
        expectSuccess(exists);
        if (exists.value) {
          expectSuccess(
            await client.dropCollection({ collection_name: collection })
          );
        }
      });
    } catch (cleanupError) {
      if (primaryError) {
        console.error('Cleanup also failed:', cleanupError);
      } else {
        throw cleanupError;
      }
    } finally {
      await client.closeConnection();
    }
  }
}

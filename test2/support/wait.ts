import { inspect } from 'util';

/** Poll observable state; preserve RPC failures and include the last state on timeout. */
export async function waitFor<T>(
  name: string,
  read: () => Promise<T>,
  ready: (value: T) => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const deadline = Date.now() + (options.timeout ?? 10_000);
  let last: T | undefined;
  do {
    last = await read();
    if (ready(last)) return last;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise(resolve =>
      setTimeout(resolve, Math.min(options.interval ?? 100, remaining))
    );
  } while (Date.now() <= deadline);
  throw new Error(
    `Timed out waiting for ${name}; last state: ${inspect(last, { depth: 5 })}`
  );
}

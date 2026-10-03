import http2 from 'http2';
import { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import path from 'path';
import { MilvusClient } from '../../milvus';

const certDir = path.join(__dirname, '../cert');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('utils/ChannelPool', () => {
  it('leaves no connection open once the pool destroys its clients', async () => {
    const server = http2.createSecureServer({
      key: readFileSync(path.join(certDir, 'server.key')),
      cert: readFileSync(path.join(certDir, 'server.pem')),
    });
    const sessions = new Set<http2.ServerHttp2Session>();
    server.on('session', session => {
      sessions.add(session);
      session.on('close', () => sessions.delete(session));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const milvusClient = new MilvusClient({
      address: `localhost:${port}`,
      tls: { skipCertCheck: true },
      __SKIP_CONNECT__: true,
    });
    const pool = (milvusClient as any).createChannelPool();

    try {
      const client = await pool.acquire();
      await new Promise(resolve =>
        client.waitForReady(Date.now() + 5000, resolve)
      );
      await pool.release(client);
      await pool.drain();
      await pool.clear();

      // a destroyed client must not dial again
      await sleep(1000);
      expect(sessions.size).toBe(0);
    } finally {
      sessions.forEach(session => session.destroy());
      server.close();
    }
  });
});

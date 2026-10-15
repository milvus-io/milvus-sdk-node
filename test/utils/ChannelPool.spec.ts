import http2 from 'http2';
import { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import path from 'path';
import { MilvusClient } from '../../milvus';

const certDir = path.join(__dirname, '../cert');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('utils/ChannelPool', () => {
  it.each(['pool destruction', 'closeConnection'])(
    'leaves no connection open after %s',
    async shutdown => {
      const server = http2.createSecureServer({
        key: readFileSync(path.join(certDir, 'server.key')),
        cert: readFileSync(path.join(certDir, 'server.pem')),
      });
      const sessions = new Set<http2.ServerHttp2Session>();
      server.on('session', session => {
        sessions.add(session);
        session.on('close', () => sessions.delete(session));
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as AddressInfo;

      const milvusClient = new MilvusClient({
        address: `localhost:${port}`,
        tls: { skipCertCheck: true },
        __SKIP_CONNECT__: true,
      });
      const pool = milvusClient.channelPool;

      try {
        const client = await pool.acquire();
        try {
          await new Promise<void>((resolve, reject) =>
            client.waitForReady(
              Date.now() + 5000,
              error => (error ? reject(error) : resolve())
            )
          );
          expect(sessions.size).toBeGreaterThan(0);
        } finally {
          await pool.release(client);
        }
        if (shutdown === 'closeConnection') {
          await milvusClient.closeConnection();
        } else {
          await pool.drain();
          await pool.clear();
        }

        // a destroyed client must not dial again
        await sleep(1000);
        expect(sessions.size).toBe(0);
      } finally {
        await milvusClient.closeConnection();
        sessions.forEach(session => session.destroy());
        await new Promise<void>((resolve, reject) =>
          server.close(error => (error ? reject(error) : resolve()))
        );
      }
    }
  );
});

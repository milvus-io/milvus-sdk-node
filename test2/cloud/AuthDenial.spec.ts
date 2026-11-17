import { MilvusClient } from '../../milvus';
import { randomBytes } from 'crypto';
import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';

const address = process.env.MILVUS_AUTH_ADDRESS;
const token = process.env.MILVUS_AUTH_TOKEN;
const run = address && token ? describe : describe.skip;

run(
  'authorization-enabled deployment (requires MILVUS_AUTH_ADDRESS / MILVUS_AUTH_TOKEN)',
  () => {
    let admin: MilvusClient;
    beforeAll(async () => {
      admin = createClient({ address: address!, token });
      await admin.connectPromise;
    });
    it('denies anonymous access', async () => {
      const anonymous = createClient({ address: address! });
      await expect(
        anonymous.connectPromise.then(() => anonymous.getVersion())
      ).rejects.toMatchObject({ code: 16 });
    });
    it('invalidates the old password while accepting the new one', async () => {
      const username = `auth_${randomBytes(6).toString('hex')}`;
      const oldPassword = 'test-password-1';
      const newPassword = 'test-password-2';
      expectSuccess(
        await admin.createUser({ username, password: oldPassword })
      );
      try {
        expectSuccess(
          await admin.updateUser({ username, oldPassword, newPassword })
        );
        const outdated = createClient({
          address: address!,
          username,
          password: oldPassword,
        });
        await expect(
          outdated.connectPromise.then(() => outdated.getVersion())
        ).rejects.toMatchObject({ code: 16 });
        const updated = createClient({
          address: address!,
          username,
          password: newPassword,
        });
        await updated.connectPromise;
        const version = await updated.getVersion();
        expect(version.version).toBeTruthy();
      } finally {
        expectSuccess(await admin.deleteUser({ username }));
      }
    });
  }
);

import { VolumeManager, VolumeRequestOptions } from '../../milvus';
import { createFetchFixture } from '../support/http';

const methods = [
  {
    name: 'list',
    call: (manager: VolumeManager, options?: VolumeRequestOptions) =>
      manager.listVolumes({ projectId: 'p' }, options),
  },
  {
    name: 'create',
    call: (manager: VolumeManager, options?: VolumeRequestOptions) =>
      manager.createVolume(
        { projectId: 'p', regionId: 'r', volumeName: 'v' },
        options
      ),
  },
  {
    name: 'delete',
    call: (manager: VolumeManager, options?: VolumeRequestOptions) =>
      manager.deleteVolume({ volumeName: 'v' }, options),
  },
];
describe.each(methods)('volume $name transport', method => {
  afterEach(() => jest.useRealTimers());
  it('aborts at the requested deadline and releases its timer', async () => {
    jest.useFakeTimers();
    const { fetch } = createFetchFixture();
    fetch.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('volume deadline exceeded'))
          )
        )
    );
    const manager = new VolumeManager({
      cloudEndpoint: 'https://fixture.invalid',
      apiKey: 'test-key',
      fetch,
    });
    const pending = expect(
      method.call(manager, { timeout: 5 })
    ).rejects.toThrow('volume deadline exceeded');
    await jest.advanceTimersByTimeAsync(5);
    await pending;
    expect(jest.getTimerCount()).toBe(0);
  });
  it.each([true, false])(
    'keeps status and URL when decoding error-body works=%s',
    async bodyWorks => {
      const { fetch } = createFetchFixture();
      fetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        text: bodyWorks
          ? async () => 'backend reason'
          : async () => {
              throw new Error('decode failed');
            },
      } as Response);
      const manager = new VolumeManager({
        cloudEndpoint: 'https://fixture.invalid/',
        apiKey: 'test-key',
        fetch,
      });
      await expect(method.call(manager)).rejects.toThrow(
        'HTTP 503 Unavailable: https://fixture.invalid/v2/volumes'
      );
    }
  );
});

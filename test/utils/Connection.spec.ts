import { getAuthString } from '../../milvus';

describe('utils/Connection', () => {
  it('should return an empty string if no credentials are provided', () => {
    const authString = getAuthString({});
    expect(authString).toEqual('');
  });

  it('should return a token if a token is provided', () => {
    const authString = getAuthString({ token: 'mytoken' });
    expect(authString).toEqual('bXl0b2tlbg==');
  });

  it('should return a base64-encoded string if a username and password are provided', () => {
    const authString = getAuthString({
      username: 'myusername',
      password: 'mypassword',
    });
    expect(authString).toEqual('bXl1c2VybmFtZTpteXBhc3N3b3Jk');
  });
});

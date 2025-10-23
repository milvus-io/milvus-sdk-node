/**
 * Generates an authentication string based on the provided credentials.
 *
 * @param {Object} data - An object containing the authentication credentials.
 * @param {string} [data.username] - The username to use for authentication.
 * @param {string} [data.password] - The password to use for authentication.
 * @param {string} [data.token] - The token to use for authentication.
 * @returns {string} The authentication string.
 */
export const getAuthString = (data: {
  username?: string;
  password?: string;
  token?: string;
}) => {
  const { username, password, token } = data;
  // build auth string
  const authString = token ? token : `${username}:${password}`;
  // Encode the username and password as a base64 string.
  let auth = Buffer.from(authString, 'utf-8').toString('base64');

  // if we need to create auth interceptors
  const needAuth = (!!username && !!password) || !!token;
  return needAuth ? auth : '';
};

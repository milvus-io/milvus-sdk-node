import {VECTOR_FIELD_NAME} from './'
/**
 * Generates a random collection name with a prefix and a random string appended to it.
 * @param {string} [pre='collection'] - The prefix to use for the collection name.
 * @returns {string} The generated collection name.
 */
export const GENERATE_NAME = (pre = 'collection') =>
  `${pre}_${Math.random().toString(36).substr(2, 8)}`;

/**
 * Executes a function with a timeout and expects it to throw a 'DEADLINE_EXCEEDED' error if it exceeds the timeout.
 * @param {Function} func - The function to be executed.
 * @param {Object} [args] - Additional arguments for the function.
 * @returns {Promise<void>} A promise that resolves when the function completes or rejects if it exceeds the timeout.
 */
export const timeoutTest = (func: Function, args?: { [x: string]: any }) => {
  return async () => {
    try {
      await func({ ...(args || {}), timeout: 1 });
    } catch (error) {
      expect(error.toString()).toContain('DEADLINE_EXCEEDED');
    }
  };
};

export const GENERATE_VECTOR_NAME = (i = 0) => {
  return i === 0 ? VECTOR_FIELD_NAME : `${VECTOR_FIELD_NAME}${i}`
}
 
export const timeoutTest = (func: Function, args?: { [x: string]: any }) => {
  return async () => {
    try {
      await func({ ...(args || {}), timeout: 1 });
    } catch (error) {
      expect(error.toString()).toContain('DEADLINE_EXCEEDED');
    }
  };
};

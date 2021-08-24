import { findKeyValue } from ".";
import { KeyValuePair } from "../types/Common";

/**
 *  parse [{key:"row_count",value:4}] to {row_count:4}
 * @param data key value pair array
 * @param keys all keys in data
 * @returns {key:value}
 */
export const formatKeyValueData = (data: KeyValuePair[], keys: string[]) => {
  const result: { [x: string]: any } = {};
  keys.forEach((k) => {
    const value = findKeyValue(data, k);
    result[k] = value;
  });

  return result;
};

/**
 * parse {row_count:4} to [{key:"row_count",value:"4"}]
 * @param data Object
 * @return {KeyValuePair[]}
 */
export const parseToKeyValue = (data?: {
  [x: string]: any;
}): KeyValuePair[] => {
  return data
    ? Object.keys(data).reduce(
        (pre: any[], cur: string) => [...pre, { key: cur, value: data[cur] }],
        []
      )
    : [];
};

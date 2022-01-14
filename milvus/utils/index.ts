import { KeyValuePair } from "../types/Common";

export const findKeyValue = (obj: KeyValuePair[], key: string) =>
  obj.find((v) => v.key === key)?.value;

export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

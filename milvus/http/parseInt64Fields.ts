// Match whole JSON string tokens so an integer-shaped fragment inside a string
// value is never treated as an object member.
const jsonStringOrInt64Member =
  /("(?:\\[\s\S]|[^"\\])*")(\s*:\s*)(-?(?:0|[1-9]\d*)|\[\s*(?:-?\d+(?:\s*,\s*-?\d+)*\s*)?\])(?=\s*[,}])|"(?:\\[\s\S]|[^"\\])*"/g;

/** Preserve selected JSON integers and integer arrays before native parsing rounds them. */
export function parseInt64Fields<T>(
  body: string,
  fields: ReadonlySet<string>
): T {
  return JSON.parse(
    body.replace(
      jsonStringOrInt64Member,
      (token, key: string | undefined, separator: string, value: string) =>
        key && fields.has(JSON.parse(key))
          ? key + separator + value.replace(/-?\d+/g, '"$&"')
          : token
    )
  ) as T;
}

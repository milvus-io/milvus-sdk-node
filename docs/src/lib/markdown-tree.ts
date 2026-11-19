// The renderer uses the same HTML tree shape for parse5 output and browser DOM.
export type HtmlNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: readonly { name: string; value: string }[];
  childNodes?: readonly HtmlNode[];
};

export function attribute(node: HtmlNode, name: string): string | undefined {
  return node.attrs?.find((attr) => attr.name === name)?.value;
}

export function hasClass(node: HtmlNode, name: string): boolean {
  return attribute(node, 'class')?.split(/\s+/).includes(name) ?? false;
}

export function htmlText(node: HtmlNode): string {
  if (node.nodeName === '#text') return node.value ?? '';
  return node.childNodes?.map(htmlText).join('') ?? '';
}

export function* descendants(node: HtmlNode): Generator<HtmlNode> {
  for (const child of node.childNodes ?? []) {
    yield child;
    yield* descendants(child);
  }
}

export function findNode(node: HtmlNode, match: (node: HtmlNode) => boolean) {
  for (const child of descendants(node)) {
    if (match(child)) return child;
  }
  return undefined;
}

export function fromDom(node: Node): HtmlNode {
  if (node instanceof Element) {
    return {
      nodeName: node.localName,
      tagName: node.localName,
      attrs: Array.from(node.attributes, ({ name, value }) => ({
        name,
        value,
      })),
      childNodes: Array.from(node.childNodes, fromDom),
    };
  }
  return { nodeName: node.nodeName, value: node.nodeValue ?? undefined };
}

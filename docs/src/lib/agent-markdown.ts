import {
  attribute,
  descendants,
  findNode,
  hasClass,
  htmlText,
  type HtmlNode,
} from './markdown-tree';

function backticks(value: string, minimum: number) {
  return '`'.repeat(
    Math.max(
      minimum,
      ...(value.match(/`+/g) ?? []).map((run) => run.length + 1)
    )
  );
}

function fenced(value: string, language: string) {
  const fence = backticks(value, 3);
  return `${fence}${language}\n${value}\n${fence}`;
}

function documentationMarkdown(content: HtmlNode, canonical: URL) {
  const sections: string[] = [];
  let description = '';
  const destination = (href: string) =>
    new URL(href, canonical).href.replace(/\(/g, '%28').replace(/\)/g, '%29');

  function children(element: HtmlNode, parents: HtmlNode[] = []) {
    let value = '';
    for (const child of element.childNodes ?? []) {
      const part = render(child, [element, ...parents]);
      if (/^\n\n/.test(part) && /\n\n *$/.test(value)) {
        value = value.trimEnd();
      }
      value += part;
    }
    return value;
  }

  function render(node: HtmlNode, parents: HtmlNode[]): string {
    if (node.nodeName === '#text') return htmlText(node).replace(/\s+/g, ' ');
    const tag = node.tagName;
    if (
      !tag ||
      hasClass(node, 'sl-anchor-link') ||
      attribute(node, 'aria-hidden') === 'true' ||
      attribute(node, 'data-agent-ignore') !== undefined ||
      [
        'script',
        'style',
        'button',
        'svg',
        'noscript',
        'template',
        'textarea',
      ].includes(tag)
    )
      return '';

    if (tag === 'pre') {
      const lines = [...descendants(node)].filter((child) =>
        hasClass(child, 'ec-line')
      );
      const source = lines.length
        ? lines
            .map((line) => {
              const code = findNode(line, (child) => hasClass(child, 'code'));
              // Expressive Code inserts a newline placeholder for an empty line.
              return code ? htmlText(code).replace(/\n$/, '') : '';
            })
            .join('\n')
        : htmlText(node).replace(/\n$/, '');
      return (
        '\n\n' + fenced(source, attribute(node, 'data-language') ?? '') + '\n\n'
      );
    }
    if (tag === 'table') {
      const rows = [...descendants(node)]
        .filter((row) => row.tagName === 'tr')
        .map((row) =>
          (row.childNodes ?? [])
            .filter((cell) => cell.tagName === 'th' || cell.tagName === 'td')
            .map((cell) =>
              children(cell)
                .trim()
                .replace(/(?<!\\)\|/g, '\\|')
                .replace(/\n+/g, '<br>')
            )
        );
      if (!rows.length) return '';
      rows.splice(
        1,
        0,
        rows[0].map(() => '---')
      );
      return (
        '\n\n' +
        rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n') +
        '\n\n'
      );
    }
    if (tag === 'dl') {
      const entries = (node.childNodes ?? [])
        .filter((entry) => entry.tagName === 'dt' || entry.tagName === 'dd')
        .map((entry) => {
          const value = children(entry).trim();
          return entry.tagName === 'dt' ? '- ' + value : '  ' + value;
        });
      return '\n\n' + entries.join('\n') + '\n\n';
    }
    if (tag === 'ol' || tag === 'ul') {
      const start = Number(attribute(node, 'start') ?? 1);
      const items = (node.childNodes ?? [])
        .filter((item) => item.tagName === 'li')
        .map((item, index) => {
          const marker = tag === 'ol' ? `${start + index}. ` : '- ';
          const indent = ' '.repeat(marker.length);
          return (
            marker +
            children(item)
              .trim()
              .replace(/\n(?=\n*\S| +\S)/g, '\n' + indent)
          );
        });
      return '\n\n' + items.join('\n') + '\n\n';
    }

    if (
      tag === 'figure' &&
      parents.some((parent) => hasClass(parent, 'expressive-code'))
    ) {
      const pre = findNode(node, (child) => child.tagName === 'pre');
      return pre ? render(pre, [node, ...parents]) : '';
    }
    if (tag === 'code') {
      const code = htmlText(node);
      const fence = backticks(code, 1);
      const padding = /^`|`$|^ | $/.test(code) ? ' ' : '';
      return fence + padding + code + padding + fence;
    }

    const value = children(node, parents);
    if (
      tag === 'p' &&
      !description &&
      !parents.some((parent) =>
        ['li', 'blockquote', 'table'].includes(parent.tagName ?? '')
      )
    ) {
      description = value.trim();
    }
    if (
      tag === 'summary' &&
      parents[0] &&
      attribute(parents[0], 'data-rest-group') !== undefined
    ) {
      const heading = value.trim();
      const id = attribute(parents[0], 'id');
      sections.push(`- [${heading}](${destination('#' + id)})`);
      return `\n\n## ${heading}\n\n`;
    }
    if (/^h[1-6]$/.test(tag)) {
      const id = attribute(node, 'id');
      if (id) sections.push(`- [${value.trim()}](${destination('#' + id)})`);
      return `\n\n${'#'.repeat(Number(tag[1]))} ${value.trim()}\n\n`;
    }
    const href = attribute(node, 'href');
    if (tag === 'a' && href) return `[${value}](${destination(href)})`;
    if (tag === 'strong' || tag === 'b') return `**${value}**`;
    if (tag === 'em' || tag === 'i') return `*${value}*`;
    if (tag === 'del') return `~~${value}~~`;
    const src = attribute(node, 'src');
    if (tag === 'img' && src)
      return `![${attribute(node, 'alt') ?? ''}](${destination(src)})`;
    if (tag === 'blockquote')
      return (
        '\n\n' +
        value
          .trim()
          .split('\n')
          .map((line) => '> ' + line)
          .join('\n') +
        '\n\n'
      );
    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (['p', 'div', 'section', 'aside', 'details'].includes(tag))
      return '\n\n' + value.trim() + '\n\n';
    return value;
  }

  // Keep code blocks intact, including consecutive blank lines and indentation.
  const body = children(content).trim();
  return { body, sections, description };
}

function restMarkdown(content: HtmlNode, canonical: URL) {
  const example = findNode(
    content,
    (node) => attribute(node, 'data-agent-rest') !== undefined
  );
  const panel = findNode(content, (node) => hasClass(node, 'rest-docs'));
  if (!example || !panel) return undefined;

  const route = attribute(example, 'data-route');
  const request = attribute(example, 'data-example-request')!;
  const response = attribute(example, 'data-example-response')!;
  const command = attribute(example, 'data-example-command')!;
  const notes = documentationMarkdown(panel, canonical);
  const details = notes.body.startsWith(notes.description)
    ? notes.body.slice(notes.description.length).trimStart()
    : notes.body;
  return {
    sections: [
      `- [cURL command](${new URL('#curl-command', canonical)})`,
      `- [Default request](${new URL('#default-request', canonical)})`,
      `- [Sample response](${new URL('#sample-response', canonical)})`,
      ...notes.sections,
    ],
    description: notes.description,
    body: [
      `\`POST ${route}\``,
      'Replace \`https://your-cluster.example.com\` with your Milvus endpoint. Set \`MILVUS_TOKEN\` for authentication or omit the Authorization header on an unauthenticated cluster.',
      '## cURL command\n\n' + fenced(command, 'bash'),
      '## Default request\n\n' + fenced(request, 'json'),
      '## Sample response\n\n' + fenced(response, 'json'),
      details,
    ].join('\n\n'),
  };
}

export function pageMarkdown(
  content: HtmlNode,
  canonical: URL,
  title: string,
  description: string,
  compatibility: string
) {
  const rest = restMarkdown(content, canonical);
  const page = rest ?? documentationMarkdown(content, canonical);
  const summary = description || page.description;
  const body =
    !rest && summary && page.body.startsWith(summary + '\n')
      ? page.body.slice(summary.length).trimStart()
      : page.body;

  return (
    [
      `# ${title}`,
      summary,
      compatibility,
      `Canonical documentation: ${canonical.href}`,
      page.sections.length
        ? '## Section links\n\n' + page.sections.join('\n')
        : '',
      body,
    ]
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}

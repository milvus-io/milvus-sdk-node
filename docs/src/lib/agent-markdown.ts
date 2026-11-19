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

export function documentationMarkdown(content: Element, canonical: URL) {
  const sections: string[] = [];
  let description = '';
  const destination = (href: string) =>
    new URL(href, canonical).href.replace(/\(/g, '%28').replace(/\)/g, '%29');

  function children(element: Element) {
    let value = '';
    for (const child of element.childNodes) {
      const part = render(child);
      if (/^\n\n/.test(part) && /\n\n *$/.test(value)) {
        value = value.trimEnd();
      }
      value += part;
    }
    return value;
  }

  function render(node: Node): string {
    if (node.nodeType === 3)
      return (node.textContent ?? '').replace(/\s+/g, ' ');
    if (!(node instanceof Element)) return '';
    if (
      node.matches(
        '.sl-anchor-link, [aria-hidden="true"], [data-agent-ignore], script, style, button, svg'
      )
    )
      return '';

    const tag = node.localName;
    if (tag === 'pre') {
      const lines = node.querySelectorAll('.ec-line .code');
      const source = lines.length
        ? Array.from(lines, (line) => line.textContent).join('\n')
        : (node.textContent ?? '').replace(/\n$/, '');
      return (
        '\n\n' +
        fenced(source, node.getAttribute('data-language') ?? '') +
        '\n\n'
      );
    }
    if (tag === 'table') {
      const rows = Array.from(node.querySelectorAll('tr'), (row) =>
        Array.from(row.children, (cell) =>
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
      const entries = Array.from(node.children, (entry) => {
        const value = children(entry).trim();
        return entry.localName === 'dt' ? '- ' + value : '  ' + value;
      });
      return '\n\n' + entries.join('\n') + '\n\n';
    }
    if (tag === 'ol' || tag === 'ul') {
      const start = Number(node.getAttribute('start') ?? 1);
      const items = Array.from(node.children, (item, index) => {
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

    if (tag === 'figure' && node.closest('.expressive-code')) {
      const pre = node.querySelector('pre');
      return pre ? render(pre) : '';
    }
    if (tag === 'code') {
      const code = node.textContent ?? '';
      const fence = backticks(code, 1);
      const padding = /^`|`$|^ | $/.test(code) ? ' ' : '';
      return fence + padding + code + padding + fence;
    }

    const value = children(node);
    if (tag === 'p' && !description && !node.closest('li, blockquote, table')) {
      description = value.trim();
    }
    if (tag === 'summary' && node.parentElement?.matches('[data-rest-group]')) {
      const heading = value.trim();
      const id = node.parentElement.id;
      sections.push(`- [${heading}](${destination('#' + id)})`);
      return `\n\n## ${heading}\n\n`;
    }
    if (/^h[1-6]$/.test(tag)) {
      if (node.id)
        sections.push(`- [${value.trim()}](${destination('#' + node.id)})`);
      return `\n\n${'#'.repeat(Number(tag[1]))} ${value.trim()}\n\n`;
    }
    if (tag === 'a' && node.hasAttribute('href'))
      return `[${value}](${destination(node.getAttribute('href')!)})`;
    if (tag === 'strong' || tag === 'b') return `**${value}**`;
    if (tag === 'em' || tag === 'i') return `*${value}*`;
    if (tag === 'del') return `~~${value}~~`;
    if (tag === 'img' && node.hasAttribute('src'))
      return `![${node.getAttribute('alt') ?? ''}](${destination(node.getAttribute('src')!)})`;
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

export function restMarkdown(content: Element, canonical: URL) {
  const example = content.querySelector<HTMLTemplateElement>(
    'template[data-agent-rest]'
  );
  const panel = content.querySelector('.rest-docs');
  if (!example || !panel) return undefined;

  const { route, exampleRequest, exampleResponse } = example.dataset;
  const notes = documentationMarkdown(panel, canonical);
  const details = notes.body.startsWith(notes.description)
    ? notes.body.slice(notes.description.length).trimStart()
    : notes.body;
  return {
    sections: notes.sections,
    description: notes.description,
    body: [
      `\`POST ${route}\``,
      'Replace \`https://your-cluster.example.com\` with your Milvus endpoint. If authentication is enabled, send \`Authorization: Bearer <MILVUS_TOKEN>\`.',
      '### Default request\n\n' + fenced(exampleRequest!, 'json'),
      exampleResponse &&
        '### Sample response\n\n' + fenced(exampleResponse, 'json'),
      details,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

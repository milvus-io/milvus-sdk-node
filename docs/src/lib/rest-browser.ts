import {
  curlCommand,
  denseVector,
  isObject,
  requestBody,
  requestUrl,
  schemaFields,
} from './rest-explorer';

const drafts = new Map<string, string>();
let clusterEndpoint = '';
let bearerToken = '';
let listDatabase: unknown;
let collectionNames: string[] | undefined;
let selectedCollection = '';
let described:
  | {
      collection: unknown;
      database: unknown;
      fields: ReturnType<typeof schemaFields>;
    }
  | undefined;
let connectionRevision = 0;
let selectionRevision = 0;
let selectionMessage = '';
let pageRequests = new AbortController();

// Only visited operation pages can have drafts. Remember which of them accept a database.
const collectionOperations = new Map<string, boolean>();

function applyCollection(json: string, slug: string) {
  try {
    const body = requestBody(json);
    body.collectionName = selectedCollection;
    if (collectionOperations.get(slug)) body.dbName = listDatabase;
    return JSON.stringify(body, null, 2);
  } catch {
    // Preserve invalid drafts for the user to correct.
    return json;
  }
}

function initializeExplorer() {
  const explorer = document.querySelector<HTMLElement>('.rest-explorer');
  if (!explorer || explorer.dataset.ready !== undefined) return;
  explorer.dataset.ready = '';

  const current = document.querySelector<HTMLAnchorElement>(
    '#starlight__sidebar [aria-current="page"]'
  );
  const group = current?.closest('details');
  if (group) group.open = true;
  if (matchMedia('(min-width: 50rem)').matches)
    current?.scrollIntoView({ block: 'nearest' });

  const filter = explorer.querySelector<HTMLInputElement>('[data-rest-filter]');
  if (filter) {
    filter.parentElement!.hidden = false;
    const filterStatus = explorer.querySelector<HTMLElement>(
      '[data-filter-status]'
    )!;
    const groups = Array.from(
      explorer.querySelectorAll<HTMLDetailsElement>('[data-rest-group]')
    );
    function openLinkedGroup() {
      const linkedGroup = groups.find(
        (group) => '#' + group.id === location.hash
      );
      if (linkedGroup) linkedGroup.open = true;
    }
    openLinkedGroup();
    const navigationSignal = pageRequests.signal;
    window.addEventListener('hashchange', openLinkedGroup, {
      signal: navigationSignal,
    });

    let previouslyOpen: Set<HTMLDetailsElement> | undefined;
    filter.addEventListener('input', () => {
      const query = filter.value.toLowerCase().trim();
      if (query && !previouslyOpen)
        previouslyOpen = new Set(groups.filter((group) => group.open));
      let matches = 0;
      for (const group of groups) {
        let groupMatches = 0;
        for (const item of group.querySelectorAll<HTMLElement>(
          '[data-rest-item]'
        )) {
          item.hidden = !item.dataset.restItem!.toLowerCase().includes(query);
          if (!item.hidden) groupMatches++;
        }
        group.hidden = groupMatches === 0;
        if (query) group.open = !group.hidden;
        else if (previouslyOpen) group.open = previouslyOpen.has(group);
        matches += groupMatches;
      }
      if (!query) previouslyOpen = undefined;
      filterStatus.hidden = !query;
      filterStatus.textContent = query
        ? `${matches} matching ${matches === 1 ? 'operation' : 'operations'}`
        : '';
    });
    return;
  }

  const endpoint = document.querySelector<HTMLInputElement>('#rest-endpoint')!;
  const token = document.querySelector<HTMLInputElement>('#rest-token')!;
  const collections =
    document.querySelector<HTMLSelectElement>('#rest-collection')!;
  const selectionStatus = document.querySelector<HTMLElement>(
    '#rest-selection-status'
  )!;

  function renderSelection() {
    collections.replaceChildren(
      new Option(
        !collectionNames
          ? 'Run List collections'
          : collectionNames.length
            ? 'Choose a collection'
            : 'No collections returned',
        ''
      ),
      ...(collectionNames ?? []).map((name) => new Option(name, name))
    );
    collections.value = selectedCollection;
    collections.disabled = !collectionNames?.length;
    selectionStatus.textContent = selectionMessage;
  }

  const panel = explorer.querySelector<HTMLElement>('[data-operation]');
  const operation = panel?.dataset.operation;
  const body = panel?.querySelector<HTMLTextAreaElement>('[data-body]');

  if (
    operation &&
    operation !== 'collections/list' &&
    !collections.closest('label')!.hidden
  ) {
    collectionOperations.set(
      operation,
      collections.dataset.usesDatabase === 'true'
    );
  }

  let renderFields = () => {};
  function clearSchema() {
    selectionRevision++;
    described = undefined;
    selectionMessage = '';
    selectionStatus.textContent = '';
    renderFields();
  }

  function resetSelection() {
    collectionNames = undefined;
    selectedCollection = '';
    clearSchema();
    renderSelection();
  }

  function resetConnection() {
    connectionRevision++;
    resetSelection();
  }

  endpoint.value = clusterEndpoint;
  token.value = bearerToken;
  renderSelection();

  collections.addEventListener('change', () => {
    selectedCollection = collections.value;
    clearSchema();
    if (!selectedCollection) return;
    for (const [slug, draft] of drafts) {
      if (collectionOperations.has(slug))
        drafts.set(slug, applyCollection(draft, slug));
    }
    if (body && operation && collectionOperations.has(operation)) {
      body.value = applyCollection(body.value, operation);
      drafts.set(operation, body.value);
    }
    selectionMessage = `Selected ${selectedCollection}. Send Describe collection to load its schema.`;
    selectionStatus.textContent = selectionMessage;
  });
  endpoint.addEventListener('input', () => {
    clusterEndpoint = endpoint.value;
    resetConnection();
  });
  token.addEventListener('input', () => {
    bearerToken = token.value;
    resetConnection();
  });

  if (!panel || !operation || !body) return;
  const path = panel.dataset.route!;
  const status = panel.querySelector<HTMLElement>('[data-status]')!;
  const output = panel.querySelector<HTMLElement>('[data-response]')!;
  const command = panel.querySelector<HTMLElement>('[data-command]')!;
  const curlExample = panel.querySelector<HTMLDetailsElement>(
    '[data-curl-example]'
  )!;
  const send = panel.querySelector<HTMLButtonElement>('[data-run]')!;
  const copyResponse = panel.querySelector<HTMLButtonElement>(
    '[data-copy-response]'
  )!;

  curlExample.open = location.hash === '#curl-command';
  body.hidden = false;
  panel.querySelector<HTMLElement>('[data-static-request]')!.hidden = true;
  panel.querySelector<HTMLElement>('[data-request-actions]')!.hidden = false;
  copyResponse.hidden = false;
  body.value =
    drafts.get(operation) ??
    (selectedCollection && collectionOperations.has(operation)
      ? applyCollection(body.value, operation)
      : body.value);

  const feedback = panel.querySelector<HTMLElement>('[data-feedback]')!;
  function showFeedback(message: string) {
    feedback.hidden = false;
    feedback.textContent = message;
  }

  const syncCurlPreview = () => {
    if (!curlExample.open) return;
    try {
      requestBody(body.value);
      const url = requestUrl(
        endpoint.value.trim() || 'https://your-cluster.example.com',
        path
      );
      command.textContent = curlCommand(
        url,
        body.value,
        Boolean(token.value.trim())
      );
    } catch {
      // Keep the last valid cURL preview while the draft or endpoint is incomplete.
    }
  };
  curlExample.addEventListener('toggle', syncCurlPreview);
  endpoint.addEventListener('input', syncCurlPreview);
  token.addEventListener('input', syncCurlPreview);
  collections.addEventListener('change', syncCurlPreview);
  syncCurlPreview();

  panel.querySelector('[data-copy]')!.addEventListener('click', async () => {
    try {
      requestBody(body.value);
      const url = requestUrl(
        endpoint.value.trim() || 'https://your-cluster.example.com',
        path
      );
      command.textContent = curlCommand(
        url,
        body.value,
        Boolean(token.value.trim())
      );
      curlExample.open = true;
      try {
        await navigator.clipboard.writeText(command.textContent);
        showFeedback('cURL copied.');
      } catch {
        showFeedback('Select and copy the cURL command below.');
      }
    } catch (error) {
      showFeedback(`Input error. ${(error as Error).message}`);
    }
  });

  copyResponse.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.textContent ?? '');
      showFeedback('Response copied.');
    } catch {
      output.focus();
      showFeedback('Select and copy the response below.');
    }
  });

  const schemaPanel = panel.querySelector<HTMLElement>('[data-schema]');
  if (schemaPanel) {
    const select =
      schemaPanel.querySelector<HTMLSelectElement>('[data-field]')!;
    let fields: ReturnType<typeof schemaFields> = [];
    renderFields = () => {
      fields = (described?.fields ?? []).filter((field) =>
        operation === 'entities/query'
          ? !field.type.includes('Vector')
          : /^(Float|Float16|BFloat16)Vector$/.test(field.type) &&
            field.dimension > 0
      );
      select.replaceChildren(
        ...fields.map(
          (field) =>
            new Option(
              operation === 'entities/search'
                ? `${field.name} · ${field.type} (${field.dimension})`
                : `${field.name} · ${field.type}`,
              field.name
            )
        )
      );
      schemaPanel.hidden = fields.length === 0;
    };
    renderFields();
    schemaPanel
      .querySelector('[data-generate]')!
      .addEventListener('click', () => {
        try {
          const request = requestBody(body.value);
          if (
            !described ||
            described.collection !== request.collectionName ||
            described.database !== (request.dbName ?? 'default')
          ) {
            throw new Error(
              'Use the collection and database from the Describe collection response.'
            );
          }
          const field = fields.find(({ name }) => name === select.value)!;
          if (operation === 'entities/query') {
            request.outputFields = [field.name];
          } else {
            request.annsField = field.name;
            request.data = [denseVector(field.dimension)];
            delete request.ids;
          }
          body.value = JSON.stringify(request, null, 2);
          drafts.set(operation, body.value);
          syncCurlPreview();
          showFeedback(`Applied ${field.name} to request JSON.`);
        } catch (error) {
          showFeedback(`Input error. ${(error as Error).message}`);
        }
      });
  }
  body.addEventListener('input', () => {
    drafts.set(operation, body.value);
    syncCurlPreview();
    if (operation === 'collections/describe') clearSchema();
  });

  send.addEventListener('click', async () => {
    feedback.hidden = true;
    let url: string;
    const json = body.value;
    let request;
    try {
      request = requestBody(json);
      url = requestUrl(endpoint.value.trim(), path);
    } catch (error) {
      showFeedback(`Input error. ${(error as Error).message}`);
      return;
    }

    const revision = connectionRevision;
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    if (token.value.trim()) {
      try {
        headers.set('Authorization', `Bearer ${token.value.trim()}`);
      } catch {
        showFeedback(
          'Input error. The token contains invalid header characters.'
        );
        return;
      }
    }
    const started = performance.now();
    const navigationSignal = pageRequests.signal;
    const signal = AbortSignal.any([
      navigationSignal,
      AbortSignal.timeout(30_000),
    ]);
    send.disabled = true;
    output.textContent = '';
    output.hidden = true;
    copyResponse.disabled = true;
    status.textContent = 'Sending live request…';
    if (operation === 'collections/list') resetSelection();
    if (operation === 'collections/describe') clearSchema();
    const schemaRevision = selectionRevision;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: json,
        credentials:
          new URL(url).origin === location.origin ? 'same-origin' : 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal,
      });
      const raw = await response.text();
      if (navigationSignal.aborted) return;
      let result: unknown;
      try {
        result = JSON.parse(raw);
      } catch {
        // Preserve non-JSON bodies for inspection.
      }
      const envelope = isObject(result) ? result : {};
      const { code, data } = envelope;
      const elapsed = Math.round(performance.now() - started);
      const resourceGroupSuccess =
        code === undefined &&
        path.endsWith('/resource_groups/describe') &&
        isObject(envelope.resource_group);
      const success = response.ok && (code === 0 || resourceGroupSuccess);
      status.textContent = `${success ? 'Live response' : 'Live response error'} · HTTP ${response.status} · Milvus code ${typeof code === 'number' ? code : 'unavailable'} · ${elapsed} ms`;
      output.textContent = raw;
      output.hidden = raw.length === 0;
      copyResponse.disabled = raw.length === 0;

      if (!success || revision !== connectionRevision) return;
      if (operation === 'collections/list' && Array.isArray(data)) {
        collectionNames = data.filter(
          (value): value is string => typeof value === 'string'
        );
        listDatabase = request.dbName ?? 'default';
        renderSelection();
      }
      if (
        operation === 'collections/describe' &&
        body.value === json &&
        schemaRevision === selectionRevision
      ) {
        const fields = schemaFields(data);
        described = {
          collection: request.collectionName,
          database: request.dbName ?? 'default',
          fields,
        };
        renderFields();
        selectionMessage = fields.length
          ? `Schema loaded for ${String(request.collectionName)}. Use the field controls in Query or Search.`
          : 'No usable fields were returned in the schema.';
        selectionStatus.textContent = selectionMessage;
      }
    } catch {
      if (navigationSignal.aborted) return;
      const elapsed = Math.round(performance.now() - started);
      status.textContent = signal.aborted
        ? `Request timed out · ${elapsed} ms`
        : `Network error · ${elapsed} ms. The browser could not read a response. Check reachability, TLS, redirects, and the CORS preflight.`;
    } finally {
      send.disabled = false;
    }
  });
}

document.addEventListener('astro:before-swap', () => {
  pageRequests.abort();
  pageRequests = new AbortController();
});

window.addEventListener('pagehide', () => {
  pageRequests.abort();
  pageRequests = new AbortController();
  bearerToken = '';
  collectionNames = undefined;
  selectedCollection = '';
  described = undefined;
  selectionMessage = '';
  drafts.clear();
  const token = document.querySelector<HTMLInputElement>('#rest-token');
  if (token) token.value = '';
  const collections =
    document.querySelector<HTMLSelectElement>('#rest-collection');
  if (collections) {
    collections.replaceChildren(new Option('Run List collections', ''));
    collections.disabled = true;
  }
  const selectionStatus = document.getElementById('rest-selection-status');
  if (selectionStatus) selectionStatus.textContent = '';
  const schemaPanel = document.querySelector<HTMLElement>('[data-schema]');
  if (schemaPanel) schemaPanel.hidden = true;
});

initializeExplorer();
document.addEventListener('astro:page-load', initializeExplorer);

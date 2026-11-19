import {
  curlCommand,
  denseVector,
  isObject,
  requestBody,
  requestUrl,
  schemaFields,
  type Operation,
} from './rest-explorer';

function explorer() {
  const explorer = document.querySelector<HTMLElement>('.rest-explorer')!;
  const links = [
    ...explorer.querySelectorAll<HTMLAnchorElement>('.rest-navigation a'),
  ];

  function updateNavigation() {
    const selected =
      links.find((link) => link.hash === location.hash) ?? links[0];
    for (const link of links) {
      if (link === selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }

  updateNavigation();
  window.addEventListener('hashchange', updateNavigation);

  const endpoint = document.querySelector<HTMLInputElement>('#rest-endpoint')!;
  const token = document.querySelector<HTMLInputElement>('#rest-token')!;
  const collections =
    document.querySelector<HTMLSelectElement>('#rest-collection')!;
  const selectionStatus = document.querySelector<HTMLElement>(
    '#rest-selection-status'
  )!;
  const editors = new Map<Operation, HTMLTextAreaElement>();
  const schemaControls: Array<
    (fields: ReturnType<typeof schemaFields>) => void
  > = [];
  let listDatabase: unknown;
  let connectionRevision = 0;
  let selectionRevision = 0;

  function clearSchema() {
    selectionRevision++;
    schemaControls.forEach((update) => update([]));
    selectionStatus.textContent = '';
  }

  function resetSelection() {
    collections.replaceChildren(new Option('Run List collections', ''));
    collections.disabled = true;
    clearSchema();
  }

  function selectCollection() {
    clearSchema();
    if (!collections.value) return;
    const updated: string[] = [];
    for (const [operation, editor] of editors) {
      if (operation === 'listCollections') continue;
      try {
        const body = requestBody(editor.value);
        body.collectionName = collections.value;
        body.dbName = listDatabase;
        editor.value = JSON.stringify(body, null, 2);
        updated.push(operation);
      } catch {
        // Keep invalid edits intact so the user can correct them.
      }
    }
    selectionStatus.textContent =
      updated.length === 3
        ? `Selected ${collections.value}. Send Describe collection to load its schema.`
        : 'Fix invalid JSON in the remaining editors and reselect the collection to update them.';
  }

  collections.addEventListener('change', selectCollection);
  for (const input of [endpoint, token]) {
    input.addEventListener('input', () => {
      connectionRevision++;
      resetSelection();
    });
  }
  window.addEventListener('pagehide', () => {
    token.value = '';
    connectionRevision++;
    resetSelection();
  });

  for (const panel of document.querySelectorAll<HTMLElement>(
    '[data-operation]'
  )) {
    const operation = panel.dataset.operation as Operation;
    const body = panel.querySelector<HTMLTextAreaElement>('[data-body]')!;
    const status = panel.querySelector<HTMLElement>('[data-status]')!;
    const output = panel.querySelector<HTMLElement>('[data-response]')!;
    const command = panel.querySelector<HTMLElement>('[data-command]')!;
    const send = panel.querySelector<HTMLButtonElement>('[data-run]')!;
    const copyResponse = panel.querySelector<HTMLButtonElement>(
      '[data-copy-response]'
    )!;
    editors.set(operation, body);

    const feedback = panel.querySelector<HTMLElement>('[data-feedback]')!;
    function showFeedback(message: string) {
      feedback.hidden = false;
      feedback.textContent = message;
    }

    panel.querySelector('[data-copy]')!.addEventListener('click', async () => {
      try {
        requestBody(body.value);
        const url = requestUrl(
          endpoint.value.trim() || 'https://your-cluster.example.com',
          operation
        );
        command.textContent = curlCommand(
          url,
          body.value,
          Boolean(token.value.trim())
        );
        command.hidden = false;
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
      schemaControls.push((newFields) => {
        fields = newFields.filter((field) =>
          operation === 'query'
            ? !field.type.includes('Vector')
            : /^(Float|Float16|BFloat16)Vector$/.test(field.type) &&
              field.dimension > 0
        );
        select.replaceChildren(
          ...fields.map(
            (field) =>
              new Option(
                operation === 'search'
                  ? `${field.name} · ${field.type} (${field.dimension})`
                  : `${field.name} · ${field.type}`,
                field.name
              )
          )
        );
        schemaPanel.hidden = fields.length === 0;
      });
      schemaPanel
        .querySelector('[data-generate]')!
        .addEventListener('click', () => {
          try {
            const describe = requestBody(
              editors.get('describeCollection')!.value
            );
            const request = requestBody(body.value);
            if (
              describe.collectionName !== request.collectionName ||
              (describe.dbName ?? 'default') !== (request.dbName ?? 'default')
            ) {
              throw new Error(
                'Use the collection and database from the Describe collection response.'
              );
            }
            const field = fields.find(({ name }) => name === select.value)!;
            if (operation === 'query') {
              request.outputFields = [field.name];
            } else {
              request.annsField = field.name;
              request.data = [denseVector(field.dimension)];
              delete request.ids;
            }
            body.value = JSON.stringify(request, null, 2);
            showFeedback(`Applied ${field.name} to request JSON.`);
          } catch (error) {
            showFeedback(`Input error. ${(error as Error).message}`);
          }
        });
    }
    if (operation === 'describeCollection')
      body.addEventListener('input', clearSchema);

    send.addEventListener('click', async () => {
      feedback.hidden = true;
      let url: string;
      const json = body.value;
      let request;
      try {
        request = requestBody(json);
        url = requestUrl(endpoint.value.trim(), operation);
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
      const signal = AbortSignal.timeout(30_000);
      send.disabled = true;
      output.textContent = '';
      copyResponse.disabled = true;
      status.textContent = 'Sending live request…';
      if (operation === 'listCollections') resetSelection();
      if (operation === 'describeCollection') clearSchema();
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
        let result: unknown;
        try {
          result = JSON.parse(raw);
        } catch {
          // Preserve non-JSON bodies for inspection.
        }
        const envelope = isObject(result) ? result : {};
        const { code, data } = envelope;
        const elapsed = Math.round(performance.now() - started);
        const success = response.ok && code === 0;
        status.textContent = `${success ? 'Live response' : 'Live response error'} · HTTP ${response.status} · Milvus code ${typeof code === 'number' ? code : 'unavailable'} · ${elapsed} ms`;
        output.textContent = raw;
        copyResponse.disabled = raw.length === 0;

        if (!success || revision !== connectionRevision) return;
        if (operation === 'listCollections' && Array.isArray(data)) {
          const names = data.filter(
            (value): value is string => typeof value === 'string'
          );
          listDatabase = request.dbName ?? 'default';
          collections.replaceChildren(
            new Option(
              names.length ? 'Choose a collection' : 'No collections returned',
              ''
            ),
            ...names.map((name) => new Option(name, name))
          );
          collections.disabled = names.length === 0;
        }
        if (
          operation === 'describeCollection' &&
          body.value === json &&
          schemaRevision === selectionRevision
        ) {
          const fields = schemaFields(data);
          schemaControls.forEach((update) => update(fields));
          selectionStatus.textContent = fields.length
            ? `Schema loaded for ${String(request.collectionName)}. Use the field controls in Query or Search.`
            : 'No usable fields were returned in the schema.';
        }
      } catch {
        const elapsed = Math.round(performance.now() - started);
        status.textContent = signal.aborted
          ? `Request timed out · ${elapsed} ms`
          : `Network error · ${elapsed} ms. The browser could not read a response. Check reachability, TLS, redirects, and the CORS preflight.`;
      } finally {
        send.disabled = false;
      }
    });
  }
  explorer.dataset.ready = '';
}

explorer();

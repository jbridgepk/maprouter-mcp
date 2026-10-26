import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { MapRouterClient } from '../src/client.ts';
import { mapSnippet } from '../src/snippets.ts';
import { createServer } from '../src/tools.ts';

/** A fake MapRouter API that records calls. */
function fakeApi(
  handler: (
    method: string,
    url: URL,
    body: unknown,
  ) => { status?: number; body: unknown; headers?: Record<string, string> },
) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init?.method ?? 'GET', url, body });
    const r = handler(init?.method ?? 'GET', url, body);
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: r.headers ?? {},
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function connect(fetchImpl: typeof fetch) {
  const server = createServer(
    new MapRouterClient({ key: 'mr_sk_test', apiUrl: 'https://api.test', fetch: fetchImpl }),
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(b);
  return client;
}

const textOf = (r: unknown) => (r as { content: { text: string }[] }).content[0]!.text;

describe('MCP tools', () => {
  it('offers the documented tools and nothing that spends money', async () => {
    const client = await connect(fakeApi(() => ({ body: {} })).fetchImpl);
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'autocomplete',
      'check_usage',
      'geocode',
      'get_map_snippet',
      'reverse_geocode',
      'set_key_budget',
      'setup_project',
      'timezone',
    ]);
    expect(names.some((n) => /credit|top.?up|buy|purchase|raise/i.test(n))).toBe(false);
  });

  it('geocodes and reports the cost and balance', async () => {
    const api = fakeApi(() => ({
      body: { type: 'FeatureCollection', features: [] },
      headers: { 'x-mr-credits-used': '10', 'x-mr-balance': '9990' },
    }));
    const client = await connect(api.fetchImpl);
    const result = await client.callTool({
      name: 'geocode',
      arguments: { q: 'Baker Street', countries: ['GB'] },
    });
    expect(api.calls[0]!.url.pathname).toBe('/v1/geocode');
    expect(api.calls[0]!.url.searchParams.get('countries')).toBe('GB');
    expect(textOf(result)).toContain('Cost: 10 credits. Balance: 9,990 credits.');
  });

  it('sets up a project through the API', async () => {
    const api = fakeApi(() => ({
      status: 201,
      body: { env: { frontend: 'MAPROUTER_PUBLISHABLE_KEY=mr_pk_x' } },
    }));
    const client = await connect(api.fetchImpl);
    const result = await client.callTool({
      name: 'setup_project',
      arguments: { name: 'shop', origins: ['https://shop.example'] },
    });
    expect(api.calls[0]).toMatchObject({
      method: 'POST',
      body: { name: 'shop', origins: ['https://shop.example'] },
    });
    expect(textOf(result)).toContain('MAPROUTER_PUBLISHABLE_KEY');
  });

  it("passes the API's refusal to raise a budget back to the agent", async () => {
    const api = fakeApi(() => ({
      status: 403,
      body: { error: { code: 'raise_not_allowed', message: 'Agents can only lower budgets.' } },
    }));
    const client = await connect(api.fetchImpl);
    const result = (await client.callTool({
      name: 'set_key_budget',
      arguments: { key_id: 'key_abc', daily_cap: 999999 },
    })) as { isError?: boolean };
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('raise_not_allowed: Agents can only lower budgets.');
  });

  it('turns autocomplete focus into lat,lon', async () => {
    const api = fakeApi(() => ({ body: { features: [] } }));
    const client = await connect(api.fetchImpl);
    await client.callTool({
      name: 'autocomplete',
      arguments: { q: 'bak', focus_lat: 51.5, focus_lon: -0.1 },
    });
    expect(api.calls[0]!.url.searchParams.get('focus')).toBe('51.5,-0.1');
  });
});

describe('map snippets', () => {
  const markers = [
    { lat: 51.5226, lon: -0.1571, label: 'Baker St' },
    { lat: 51.5136, lon: -0.1365, label: "Soho's store" },
  ];

  it('writes a self-contained HTML page with the key, markers and bounds', () => {
    const { code } = mapSnippet({ framework: 'html', markers, publishableKey: 'mr_pk_abc' });
    expect(code).toContain('https://api.maprouter.dev/v1/styles/survey.json?key=mr_pk_abc');
    expect(code).toContain('.setLngLat([-0.1571, 51.5226])');
    expect(code).toContain('"Soho\'s store"');
    expect(code).toContain('map.fitBounds([[-0.1571, 51.5136], [-0.1365, 51.5226]]');
  });

  it('reads the key from env in React, Vue and Svelte', () => {
    const react = mapSnippet({ framework: 'react', style: 'dark' });
    expect(react.code).toContain('${import.meta.env.VITE_MAPROUTER_PUBLISHABLE_KEY}');
    expect(react.code).toContain('/v1/styles/dark.json');
    expect(react.install).toBe('npm install maplibre-gl@^5');
    expect(mapSnippet({ framework: 'vue' }).code).toContain('map = new maplibregl.Map');
    const svelte = mapSnippet({ framework: 'svelte' });
    expect(svelte.code).toContain(
      "import { PUBLIC_MAPROUTER_PUBLISHABLE_KEY } from '$env/static/public';",
    );
    expect(svelte.env).toBe('PUBLIC_MAPROUTER_PUBLISHABLE_KEY=mr_pk_YOUR_PUBLISHABLE_KEY');
  });
});

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MapRouterClient, MapRouterError } from './client.ts';
import { mapSnippet } from './snippets.ts';

export const SERVER_INSTRUCTIONS = `MapRouter gives this app maps, geocoding, autocomplete and time zones from OpenStreetMap data, paid from prepaid credits that double as a hard cap.

To add a map: call setup_project once (it returns a publishable key for the frontend and a secret key for the server, plus env lines), geocode any addresses, then get_map_snippet for working code. Put the publishable key (mr_pk_) in frontend env vars and the secret key (mr_sk_) in server env only. Keep the OpenStreetMap attribution visible.

You can read usage and lower a key's budget, but you can never add credits, turn on auto top-up or raise a budget. If the balance runs low, tell the user and point them to https://app.maprouter.dev/credits.`;

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean };

const text = (value: unknown, footer?: string): Result => ({
  content: [
    {
      type: 'text',
      text:
        (typeof value === 'string' ? value : JSON.stringify(value, null, 2)) +
        (footer ? `\n\n${footer}` : ''),
    },
  ],
});

const cost = (creditsUsed: number, balance: number | null) =>
  `Cost: ${creditsUsed} credits.${balance === null ? '' : ` Balance: ${balance.toLocaleString('en-US')} credits.`}`;

async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MapRouterError)
      return { ...text(`${err.code}: ${err.message}`), isError: true };
    throw err;
  }
}

const lat = z.number().min(-90).max(90).describe('Latitude in decimal degrees');
const lon = z.number().min(-180).max(180).describe('Longitude in decimal degrees');

export function createServer(client: MapRouterClient): McpServer {
  const server = new McpServer(
    { name: 'maprouter', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    'setup_project',
    {
      title: 'Set up MapRouter keys for this project',
      description:
        'Creates a project with a publishable key (browser; maps, autocomplete and time zones; locked to the given origins, localhost always works) and a secret key (server; everything). Returns env lines to add. Call once per app.',
      inputSchema: {
        name: z.string().min(1).max(80).describe('Project name, e.g. the app or repo name'),
        origins: z
          .array(z.string())
          .max(20)
          .optional()
          .describe(
            'Production origins for the publishable key, e.g. ["https://shop.example", "https://*.vercel.app"]',
          ),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    ({ name, origins }) =>
      guarded(async () => {
        const { data } = await client.request<Record<string, unknown>>('POST', '/v1/projects', {
          name,
          origins,
        });
        return text(
          data,
          'Add env.frontend to the frontend env file and env.server to the server env file. Do not commit them.',
        );
      }),
  );

  server.registerTool(
    'geocode',
    {
      title: 'Find coordinates for an address or place',
      description: 'Forward geocoding. Returns GeoJSON features (longitude first). 10 credits.',
      inputSchema: {
        q: z
          .string()
          .min(1)
          .max(300)
          .describe('Address or place, e.g. "221B Baker Street, London"'),
        limit: z.number().int().min(1).max(20).optional(),
        countries: z
          .array(z.string().length(2))
          .optional()
          .describe('ISO 3166 alpha-2 codes, e.g. ["GB"]'),
        lang: z.enum(['en', 'de', 'fr', 'it', 'default']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const { data, creditsUsed, balance } = await client.request('GET', '/v1/geocode', args);
        return text(data, cost(creditsUsed, balance));
      }),
  );

  server.registerTool(
    'reverse_geocode',
    {
      title: 'Find the address at a point',
      description: 'Reverse geocoding. 10 credits.',
      inputSchema: { lat, lon, lang: z.enum(['en', 'de', 'fr', 'it', 'default']).optional() },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const { data, creditsUsed, balance } = await client.request('GET', '/v1/reverse', args);
        return text(data, cost(creditsUsed, balance));
      }),
  );

  server.registerTool(
    'autocomplete',
    {
      title: 'Search-as-you-type suggestions',
      description:
        'Place suggestions for partial input, optionally biased towards a point. 2 credits.',
      inputSchema: {
        q: z.string().min(1).max(300),
        focus_lat: lat.optional(),
        focus_lon: lon.optional(),
        limit: z.number().int().min(1).max(20).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ q, focus_lat, focus_lon, limit }) =>
      guarded(async () => {
        const focus =
          focus_lat !== undefined && focus_lon !== undefined
            ? `${focus_lat},${focus_lon}`
            : undefined;
        const { data, creditsUsed, balance } = await client.request('GET', '/v1/autocomplete', {
          q,
          focus,
          limit,
        });
        return text(data, cost(creditsUsed, balance));
      }),
  );

  server.registerTool(
    'timezone',
    {
      title: 'Time zone at a point',
      description:
        'IANA time zone, current UTC offset and whether daylight saving is in effect. 1 credit.',
      inputSchema: { lat, lon },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const { data, creditsUsed, balance } = await client.request('GET', '/v1/timezone', args);
        return text(data, cost(creditsUsed, balance));
      }),
  );

  server.registerTool(
    'get_map_snippet',
    {
      title: 'Working map code',
      description:
        'Returns MapLibre code for HTML, React, Vue or Svelte using a MapRouter style, with optional markers. Free; does not call the API.',
      inputSchema: {
        framework: z.enum(['html', 'react', 'vue', 'svelte']),
        style: z
          .enum(['survey', 'survey-dark', 'light', 'dark', 'white', 'grayscale', 'black'])
          .optional(),
        center_lat: lat.optional(),
        center_lon: lon.optional(),
        zoom: z.number().min(0).max(18).optional(),
        markers: z
          .array(z.object({ lat, lon, label: z.string().max(200).optional() }))
          .max(500)
          .optional(),
        publishable_key: z
          .string()
          .regex(/^mr_pk_/)
          .optional()
          .describe('Only inlined for html; frameworks read it from env'),
        env_var: z
          .string()
          .regex(/^[A-Z_][A-Z0-9_]*$/)
          .optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const center =
          args.center_lat !== undefined && args.center_lon !== undefined
            ? { lat: args.center_lat, lon: args.center_lon }
            : undefined;
        const snippet = mapSnippet({
          framework: args.framework,
          ...(args.style ? { style: args.style } : {}),
          ...(center ? { center } : {}),
          ...(args.zoom !== undefined ? { zoom: args.zoom } : {}),
          ...(args.markers ? { markers: args.markers } : {}),
          ...(args.publishable_key ? { publishableKey: args.publishable_key } : {}),
          ...(args.env_var ? { envVar: args.env_var } : {}),
          apiUrl: client.apiUrl,
        });
        return text(snippet);
      }),
  );

  server.registerTool(
    'check_usage',
    {
      title: 'Balance and caps',
      description: "The account's credit balance, today's free quota, and this key's caps. Free.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () =>
      guarded(async () => {
        const [usage, keys] = await Promise.all([
          client.request('GET', '/v1/account/usage'),
          client.request<{ keys: unknown[] }>('GET', '/v1/keys'),
        ]);
        return text(
          { ...(usage.data as object), keys: keys.data.keys },
          'To add credits, the user visits https://app.maprouter.dev/credits. You cannot add them.',
        );
      }),
  );

  server.registerTool(
    'set_key_budget',
    {
      title: "Lower a key's budget",
      description:
        "Lowers a key's daily and/or monthly cap in credits. It can only lower: raising a cap or adding credits needs the user, in the dashboard.",
      inputSchema: {
        key_id: z.string().regex(/^key_/).describe('From check_usage or setup_project'),
        daily_cap: z.number().int().min(0).optional(),
        monthly_cap: z.number().int().min(0).optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    ({ key_id, daily_cap, monthly_cap }) =>
      guarded(async () => {
        const { data } = await client.request(
          'POST',
          `/v1/keys/${encodeURIComponent(key_id)}/budget`,
          { daily_cap, monthly_cap },
        );
        return text(data);
      }),
  );

  return server;
}

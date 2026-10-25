/** A small client for the MapRouter REST API. Errors keep the API's code and its "what to do next" message. */

export const DEFAULT_API_URL = 'https://api.maprouter.dev';

export class MapRouterError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface ClientOptions {
  /** A secret key (mr_sk_...). */
  key: string;
  apiUrl?: string;
  fetch?: typeof fetch;
}

export class MapRouterClient {
  readonly apiUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ key, apiUrl = DEFAULT_API_URL, fetch: fetchImpl = fetch }: ClientOptions) {
    this.key = key;
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, unknown>,
  ): Promise<{ data: T; creditsUsed: number; balance: number | null }> {
    let url = `${this.apiUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: { authorization: `Bearer ${this.key}`, 'user-agent': 'maprouter-mcp/0.1' },
    };
    if (method === 'GET' && params) {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) query.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
      url += `?${query}`;
    } else if (params) {
      init.body = JSON.stringify(params);
      (init.headers as Record<string, string>)['content-type'] = 'application/json';
    }
    const res = await this.fetchImpl(url, init);
    const body = (await res.json().catch(() => ({}))) as T & {
      error?: { code: string; message: string };
    };
    if (!res.ok) {
      throw new MapRouterError(
        res.status,
        body.error?.code ?? 'http_error',
        body.error?.message ?? `MapRouter returned ${res.status}.`,
      );
    }
    const balance = res.headers.get('x-mr-balance');
    return {
      data: body,
      creditsUsed: Number(res.headers.get('x-mr-credits-used') ?? 0),
      balance: balance === null ? null : Number(balance),
    };
  }
}

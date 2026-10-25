import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { MapRouterClient } from './client.ts';
import { createServer } from './tools.ts';

/**
 * Answers one Streamable HTTP MCP request, statelessly (no session id generator): a fresh server per
 * request, JSON responses.
 * Works anywhere with web-standard Request and Response (Cloudflare Workers, Deno, Bun, Node 22+).
 */
export async function handleMcpRequest(
  request: Request,
  client: MapRouterClient,
): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createServer(client);
  await server.connect(transport);
  return transport.handleRequest(request);
}

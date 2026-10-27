#!/usr/bin/env node
// Local MCP server over stdio, for clients that only run local servers.
//   MAPROUTER_SECRET_KEY=mr_sk_... npx -y maprouter-mcp
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MapRouterClient } from './client.ts';
import { createServer } from './tools.ts';

const key = process.env.MAPROUTER_SECRET_KEY;
if (!key?.startsWith('mr_sk_')) {
  console.error(
    'Set MAPROUTER_SECRET_KEY to a secret key (mr_sk_...). Get one free at https://app.maprouter.dev, or use the hosted server at https://mcp.maprouter.dev/mcp, which signs you in with GitHub.',
  );
  process.exit(1);
}
const client = new MapRouterClient({
  key,
  ...(process.env.MAPROUTER_API_URL ? { apiUrl: process.env.MAPROUTER_API_URL } : {}),
});
await createServer(client).connect(new StdioServerTransport());

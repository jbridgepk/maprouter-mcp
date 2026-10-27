# MapRouter MCP server

Maps your agent can set up, and a bill that can't run away.

This MCP server lets a coding agent add a working map to an app: it creates MapRouter keys,
geocodes addresses, and writes MapLibre code for HTML, React, Vue or Svelte. MapRouter is
prepaid, so the agent can read usage and lower budgets but can never add credits or raise a
budget.

## Use the hosted server (recommended)

No key to copy: it signs you in with GitHub.

```sh
claude mcp add --transport http maprouter https://mcp.maprouter.dev/mcp
```

## Claude Code plugin

This repo is also a Claude Code plugin marketplace. The plugin adds the hosted server and an
`add-a-map` skill:

```sh
/plugin marketplace add jbridgepk/maprouter-mcp
/plugin install maprouter@maprouter
```

## Run it locally

For clients that only run local servers. (The npm package is not published yet; until then,
clone this repo and point your client at `node src/stdio.ts`.) Create a secret key at https://app.maprouter.dev.

```json
{
  "mcpServers": {
    "maprouter": {
      "command": "npx",
      "args": ["-y", "maprouter-mcp"],
      "env": { "MAPROUTER_SECRET_KEY": "mr_sk_..." }
    }
  }
}
```

Requires Node 22.18 or later.

## Tools

| Tool              | What it does                                                                           | Cost       |
| ----------------- | -------------------------------------------------------------------------------------- | ---------- |
| `setup_project`   | Creates a publishable key (browser, origin-locked) and a secret key, returns env lines | Free       |
| `geocode`         | Address or place to coordinates                                                        | 10 credits |
| `reverse_geocode` | Coordinates to address                                                                 | 10 credits |
| `autocomplete`    | Search-as-you-type suggestions                                                         | 2 credits  |
| `timezone`        | IANA zone, UTC offset and DST at a point                                               | 1 credit   |
| `get_map_snippet` | Working MapLibre code with markers                                                     | Free       |
| `check_usage`     | Balance, free quota and key caps                                                       | Free       |
| `set_key_budget`  | Lowers a key's daily or monthly cap (never raises)                                     | Free       |

Map data © OpenStreetMap contributors.

## Use it as a library

```ts
import { MapRouterClient, createServer, handleMcpRequest } from 'maprouter-mcp';

const client = new MapRouterClient({ key: process.env.MAPROUTER_SECRET_KEY! });
// Any web-standard server: Workers, Deno, Bun, Node 22+.
export default { fetch: (request: Request) => handleMcpRequest(request, client) };
```

## Licence

MIT

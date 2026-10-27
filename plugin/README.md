# MapRouter plugin for Claude Code

MapRouter gives your app maps, address search and time zones from OpenStreetMap data, with one
key and prepaid credits that double as a hard spending cap. This plugin adds the hosted
MapRouter MCP server and the `add-a-map` skill, so you can ask Claude Code for "a map of our
three stores" and get origin-locked keys in `.env`, geocoded pins and working MapLibre code.

```sh
/plugin marketplace add jbridgepk/maprouter-mcp
/plugin install maprouter@maprouter
```

The first time Claude uses MapRouter, your browser opens to sign in with GitHub and approve the
connection. There's no card to add: every account gets 10,000 free credits a day (2,000 a day while your GitHub account is under 30 days old). Claude can
create keys and lower budgets, but it can never buy credits or raise a cap.

Or without the plugin: `claude mcp add --transport http maprouter https://mcp.maprouter.dev/mcp`.

Docs: https://maprouter.dev/docs/mcp. Privacy: https://maprouter.dev/legal/privacy/.

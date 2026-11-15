# dissolve MCP server

A tiny [Model Context Protocol](https://modelcontextprotocol.io) server that gives coding agents the
dissolve docs as tools. It has no dependencies: one file, `server.mjs`, run with Node over stdio
(JSON-RPC 2.0, one message per line).

Its data comes from the README and `src/dissolve` (types, hooks, variants).

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `list_variants` | `kind?`: `exit`, `entrance`, `gesture` or `transition` | Every variant with its kind, the hook to use and a one line use case, plus the picking rules |
| `get_variant` | `name`: a variant name (e.g. `dust`, `stream`, `gather`, `charge`, `peel`, `melt`, `morph`, `cascade`, `screen`) | Usage snippet, options and best practices for that variant |
| `get_setup` | none | Install command with the peer dependencies, the `DissolveProvider` root layout, a minimal `useDissolve` example and the variant picking rules |

## Requirements

Node 18 or later. Clone the repo and use the absolute path to `mcp/server.mjs` below.

## Register it

### Claude Code

```sh
claude mcp add dissolve -- npx -y react-native-dissolve-mcp
```

### Codex

```sh
codex mcp add dissolve -- npx -y react-native-dissolve-mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.dissolve]
command = "node"
args = ["/path/to/dissolve/mcp/server.mjs"]
```

### Claude Desktop

Add it to `claude_desktop_config.json` (Settings, Developer, Edit Config), then restart the app:

```json
{
  "mcpServers": {
    "dissolve": {
      "command": "node",
      "args": ["/path/to/dissolve/mcp/server.mjs"]
    }
  }
}
```

### Cursor

Add it to `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` for every project:

```json
{
  "mcpServers": {
    "dissolve": {
      "command": "node",
      "args": ["/path/to/dissolve/mcp/server.mjs"]
    }
  }
}
```

## Try it by hand

```sh
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp/server.mjs
```

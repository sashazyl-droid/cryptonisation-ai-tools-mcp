# Cryptonisation AI Tools MCP

[![Glama MCP server](https://glama.ai/mcp/servers/sashazyl-droid/cryptonisation-ai-tools-mcp/badges/score.svg)](https://glama.ai/mcp/servers/sashazyl-droid/cryptonisation-ai-tools-mcp)

A small, read-only **stdio wrapper** for the public [Cryptonisation AI Tools](https://aitools.cryptonisation.pro/) MCP server. It connects local MCP clients to `https://aitools.cryptonisation.pro/mcp` using the official MCP TypeScript SDK.

This repository contains only the transport adapter, tests and connection instructions. The website, Laravel application, database, administrative API, deployment configuration and credentials are **not included**.

## Choose a connection

**Remote MCP clients:** connect directly to the existing Streamable HTTP endpoint:

```text
https://aitools.cryptonisation.pro/mcp
```

No installation or API key is required. See the [client connection guide](https://aitools.cryptonisation.pro/mcp/) or [Russian guide](https://aitools.cryptonisation.pro/ru/mcp/).

**Cursor remote connection:** put this in `.cursor/mcp.json`:

```json
{"mcpServers":{"cryptonisation-ai-tools":{"url":"https://aitools.cryptonisation.pro/mcp"}}}
```

**Local stdio clients:** use this wrapper with Node.js 22 or newer and Git installed. The wrapper requires internet access to the public endpoint.

```sh
git clone https://github.com/sashazyl-droid/cryptonisation-ai-tools-mcp.git
cd cryptonisation-ai-tools-mcp
npm ci --ignore-scripts
node bin/server.js
```

The process waits for MCP JSON-RPC on stdin. No human-readable startup message is printed to stdout; this is expected.

Add the following to an MCP client's configuration (for example Claude Desktop's `mcpServers` or Cursor's `.cursor/mcp.json`), replacing the path with your clone's absolute path:

```json
{
  "mcpServers": {
    "cryptonisation-ai-tools": {
      "command": "node",
      "args": ["/absolute/path/cryptonisation-ai-tools-mcp/bin/server.js"]
    }
  }
}
```

On Windows, use a path such as `C:/Tools/cryptonisation-ai-tools-mcp/bin/server.js`. If Node is not in the client's PATH, set `command` to the absolute path of `node.exe`.

This project is distributed through GitHub; it is not published to the npm registry.

## Public tools

| Tool | Purpose |
| --- | --- |
| `search_tools` | Search published crypto AI tools by query, type, exchange, chain, task, client and maximum access. |
| `get_tool` | Read a published tool card by slug, including descriptions, permissions and source links. |
| `list_filters` | Get supported filter slugs and localized labels. |

The wrapper advertises the upstream input/output schemas and returns its structured results and concise text. Only these three tool names are forwarded. Administration, creation, editing, deletion, trading and withdrawals are unavailable through the wrapper. It does not execute installation commands from tool cards.

Example arguments:

```json
{
  "name": "search_tools",
  "arguments": {
    "exchange": ["okx"],
    "max_access": "read",
    "limit": 10,
    "offset": 0,
    "lang": "en"
  }
}
```

Use `list_filters` for current slugs, including the `cli` type. Continue result pages with `next_offset` as the next request’s `offset`. Supported languages are `en` and `ru`. `max_access` is an upper bound (`read` в†’ `trade` в†’ `limited` в†’ `withdraw`); unknown higher permissions are excluded by the public service. **Access levels are not a safety guarantee. Review the tool's code before connecting API keys.**

## Data, errors and privacy

- Requests, including search text and tool slugs, are sent over HTTPS to the public Cryptonisation MCP service. Do not put secrets or private personal information into searches.
- The wrapper does not ask for, load or forward administrative tokens, cookies, database access or `.env` files. Its endpoint is fixed; redirects are rejected.
- The wrapper does not persist queries or responses or write application logs. Your MCP client and the public service have their own logging policies. See the service's [privacy policy](https://aitools.cryptonisation.pro/privacy/).
- The public service currently limits requests to 60 per minute per IP and search results to 20 per request (default 10). Public API data can be cached for up to 10 minutes. Limits may be shared by clients behind the same IP.
- HTTPS requests time out after 10 seconds. Missing tools, unavailable upstream services and invalid input return errors; no demo or substitute data is generated. A failed initial connection can be retried on the next request.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm test
npm audit --omit=dev
```

Tests use an in-memory MCP client/server transport and fake upstream responses. They do not use a database or modify the website.

An optional read-only end-to-end check exercises all three tools through the executable against production:

```sh
npm run test:live
```

CI runs syntax checks, offline tests and a dependency audit on Node.js 22 and 24. It does not deploy anything. The dependency lockfile is committed, and there are no package lifecycle scripts.

## РџРѕ-СЂСѓСЃСЃРєРё

Р­С‚Рѕ РїСѓР±Р»РёС‡РЅР°СЏ РѕР±С‘СЂС‚РєР° РґР»СЏ Р»РѕРєР°Р»СЊРЅС‹С… MCP-РєР»РёРµРЅС‚РѕРІ. РћРЅР° РїРµСЂРµРґР°С‘С‚ С‚РѕР»СЊРєРѕ РїРѕРёСЃРє, С‡С‚РµРЅРёРµ РєР°СЂС‚РѕС‡РєРё Рё СЃРїРёСЃРѕРє С„РёР»СЊС‚СЂРѕРІ РІ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РїСѓР±Р»РёС‡РЅС‹Р№ СЃРµСЂРІРµСЂ. РўРѕРєРµРЅ РЅРµ РЅСѓР¶РµРЅ, РёСЃС…РѕРґРЅРёРєРѕРІ СЃР°Р№С‚Р° РІ СЂРµРїРѕР·РёС‚РѕСЂРёРё РЅРµС‚. Р”Р»СЏ РїРѕРёСЃРєР° РЅР° СЂСѓСЃСЃРєРѕРј СѓРєР°Р¶РёС‚Рµ `"lang": "ru"`. РљР»РёРµРЅС‚С‹ СЃ РїРѕРґРґРµСЂР¶РєРѕР№ СѓРґР°Р»С‘РЅРЅРѕРіРѕ MCP РјРѕРіСѓС‚ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ РЅР°РїСЂСЏРјСѓСЋ Рє Р°РґСЂРµСЃСѓ РІС‹С€Рµ, Р±РµР· СѓСЃС‚Р°РЅРѕРІРєРё РѕР±С‘СЂС‚РєРё.

## Support and license

For vulnerabilities, follow [SECURITY.md](SECURITY.md); use a private report, never a public issue. For wrapper bugs, [open an issue](https://github.com/sashazyl-droid/cryptonisation-ai-tools-mcp/issues). For catalog questions, use [Cryptonisation support](https://aitools.cryptonisation.pro/support/). Do not post credentials or private logs in public issues.

The wrapper code is MIT licensed. Public catalog content and third-party tools retain their own terms and licenses; this license does not relicense them.

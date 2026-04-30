# Visualiser MCP — project context

Node.js (Express) **streamable HTTP** MCP server (`@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`), pluggable auth, and a **Chart.js** visualiser (donut, pie, bar, trendline). **All env-backed settings** live in `config.js`. Tools and resources are registered via `src/lib/mcp-tools/index.js` and `src/lib/mcp-resources/index.js`.

**Request flow:** `express.json` → logger → **auth** → routes → error handler (`index.js`).

## Where things live

| Area | Location |
|------|----------|
| HTTP/TLS listen | `index.js` |
| Config | `config.js` |
| MCP HTTP routes | `src/routes/mcp.js` → `src/handler/mcp.js` |
| MCP server (tools + resources) | `src/lib/server/index.js` |
| Tool / resource registries | `src/lib/mcp-tools/index.js`, `src/lib/mcp-resources/index.js` |
| Auth | `src/middleware/auth.js`, `src/lib/auth-providers/index.js` |
| OAuth resolver | `src/lib/auth/oauth-server-resolver.js` |
| Unauthenticated paths | `src/constants/server.js` |
| Well-known OAuth | `src/routes/well-known-paths.js` |
| DCR | `src/routes/dcr.js` |
| Tool/resource builders | `src/lib/models/mcp-tool.js`, `src/lib/models/mcp-resource.js` |
| Per-request `Authorization` | `src/lib/request-context.js` |

**Web UIs:** `web-app/` (single chart) and `web-app-multi/` (multi-dataset); both need `npm run build` — server reads `web-app/dist/index.html` and `web-app-multi/dist/index.html` at runtime.

## HTTP surface (short)

| Method | Path | Notes |
|--------|------|--------|
| `POST`/`GET`/`DELETE` | `/mcp` | Streamable MCP; new session when `Mcp-Session-Id` absent; **DELETE** can skip auth when other methods require it |
| `GET` | `/healthcheck` | Liveness |
| `GET` | `/.well-known/...` | OAuth metadata (when using OAuth auth) |
| `GET`/`POST` | `/dcr/...` | DCR; `POST /dcr/get-client` for `dcr_self` |

## Config (short)

- **Env:** `MCP_API_KEY`, `CLIENT_ID`/`CLIENT_SECRET`, `KEY`/`CERT`, `PORT`, `HOST_NAME` (public host, no scheme), `LOG_LEVEL`.
- **`mcpServer.settings`:** `sessionsEnabled`, `enableHttps`, `enableHttp`, `authEnabled`, `authMethod` (`api_key` \| `static_oauth` \| `dcr_external` \| `dcr_self`), `oAuthConfig`, `externalOAuthServerIssuer` (required for `dcr_external`).
- **Critical:** Invalid/missing `authMethod` when `authEnabled` is true can leave routes effectively open — see `src/lib/auth/auth-config.js`.

**Unauthenticated:** `/.well-known`, `/healthcheck`, `/dcr`, `/register`; `/mcp` **only** `DELETE` is exempt from auth when auth is on — **`POST`/`GET` `/mcp` need auth**.

## Visualiser tools

- **`visualiser`** → tool name `visualiser-tool`, UI `ui://visualiser.html`, `web-app/dist`.
- **`multi-visualiser`** → `multi-visualiser-tool`, UI `ui://multi-visualiser.html`, `web-app-multi/dist`.

## Build UIs before run/deploy

```bash
cd web-app && npm install && npm run build
cd ../web-app-multi && npm install && npm run build
```

## Conventions

- Do not read `process.env` for MCP/auth outside `config.js` (except established leaf modules).
- Add tools/resources via the barrel `index.js` files; avoid editing `src/lib/server/index.js` for normal tools.
- Invalid `authMethod` + `authEnabled` → treat as dangerous until fixed.

For full env tables, auth decision procedure, LLM task recipes, and dependency list, see **README.md**.

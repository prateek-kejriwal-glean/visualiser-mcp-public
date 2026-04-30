# Visualiser MCP Server

[MCP](https://modelcontextprotocol.io/) server (Node.js, Express, streamable HTTP). Exposes chart tools (donut, pie, bar, trendline) backed by Chart.js **MCP Apps** in `web-app/` and `web-app-multi/`. Settings live only in **`config.js`**.

Automation-oriented overview: **`claude.md`**.

---

## Quick start

```bash
npm install
cd web-app && npm install && npm run build
cd ../web-app-multi && npm install && npm run build
cd ..
export MCP_API_KEY='your-secret'   # default config uses api_key auth
node index.js
```

Default HTTP is **port 80** (may need privileges); tune `enableHttp` / HTTPS in `config.js`. Health: `GET /healthcheck`. Point MCP clients at your base URL + `/mcp`.

---

## Layout & entry points

Request pipeline (`index.js`): `express.json` → logger → **auth** → routes → error handler.

**Do not** add new `process.env` reads for MCP/auth outside `config.js` (except existing leaf patterns).

```
.
├── config.js              # env + mcpServer.settings
├── index.js
├── web-app/, web-app-multi/   # Vite apps → dist/ required at runtime
└── src/
    ├── routes/mcp.js → handler/mcp.js    # /mcp
    ├── middleware/auth.js
    ├── constants/server.js                  # UNAUTHENTICATED_PATHS
    ├── lib/server/index.js                  # MCP server
    ├── lib/mcp-tools/index.js               # register tools
    ├── lib/mcp-resources/index.js           # register MCP App HTML
    ├── lib/auth-providers/, lib/auth/
    └── lib/models/mcp-tool.js, mcp-resource.js
```

---

## HTTP

| Method | Path | Notes |
|--------|------|--------|
| `POST` / `GET` / `DELETE` | `/mcp` | Streamable MCP; new session without `Mcp-Session-Id` |
| `GET` | `/healthcheck` | Liveness |
| `GET` | `/.well-known/...` | OAuth metadata (when using OAuth) |
| `GET` / `POST` | `/dcr/...` | DCR; `POST /dcr/get-client` for `dcr_self` only |

`DELETE /mcp` can skip auth while `POST`/`GET` require it when auth is on — see below.

---

## Configuration (`config.js`)

### Environment

| Variable | Role |
|----------|------|
| `MCP_API_KEY` | Bearer secret when `authMethod === 'api_key'` |
| `CLIENT_ID`, `CLIENT_SECRET` | `dcr_self` / `mcpClientMaps` clients |
| `KEY`, `CERT` | TLS when `enableHttps` |
| `PORT` | HTTPS port |
| `HOST_NAME` | Public hostname (no scheme); `https://${HOST_NAME}/...` in metadata |
| `LOG_LEVEL` | `DEBUG` … `ERROR` (default `INFO`) |

### `mcpServer.settings`

| Field | Notes |
|-------|--------|
| `sessionsEnabled`, `enableHttps`, `enableHttp` | HTTP listens on **80** when `enableHttp`; HTTPS when cert present |
| `authEnabled` | If false, auth is skipped (`getAuthMethod()` → `'none'`) |
| `authMethod` | Must be exactly `api_key`, `static_oauth`, `dcr_external`, or `dcr_self` if `authEnabled`. **Typos / invalid values fall back to `'none'` and can leave routes open** — see `src/lib/auth/auth-config.js` |
| `oAuthConfig` | Issuer, client, `userInfoUrl`, `supportedEmailDomains`, etc. for `static_oauth` / `dcr_self` |
| `externalOAuthServerIssuer` | **Required** for `dcr_external` |

**`mcpClientMaps`:** keyed by exact `redirect_uri`; used by `POST /dcr/get-client` for `dcr_self` (default includes Cursor’s MCP callback).

---

## Authentication (summary)

| `authMethod` | You set | Behavior (short) |
|--------------|---------|---------------------|
| `api_key` | `MCP_API_KEY`, `config.apiKey` | `Authorization: Bearer …` — `src/lib/auth-providers/api-key.js` |
| `static_oauth` | `oAuthConfig` | Discovery on issuer; JWT + `userInfoUrl` — `oauth.js`, well-known on this host |
| `dcr_external` | `externalOAuthServerIssuer` | DCR GET goes to external AS; tokens via its userinfo |
| `dcr_self` | `oAuthConfig` + `mcpClientMaps` | Like static OAuth + `registration_endpoint` → `https://${hostName}/dcr/get-client` |

`supportedEmailDomains`: suffix match on email (e.g. `"@company.com"`).

**Invalid `authMethod` with `authEnabled: true`:** logged warning; treat as misconfigured / possibly open until fixed.

### Unauthenticated (`UNAUTHENTICATED_PATHS`)

`/.well-known`, `/healthcheck`, `/dcr`, `/register` — all methods. **`/mcp`:** only **`DELETE`** bypasses auth; **`POST` and `GET` need auth** when enabled.

---

## Chart tools

| | Single | Multi |
|--|--------|--------|
| Registry key | `visualiser` | `multi-visualiser` |
| Tool name | `visualiser-tool` | `multi-visualiser-tool` |
| UI URI | `ui://visualiser.html` | `ui://multi-visualiser.html` |
| Source | `web-app/dist` | `web-app-multi/dist` |
| Code | `src/lib/mcp-tools/visualiser/`, `mcp-resources/visualiser/` | `.../multi-visualiser/` |

**Inputs:** chart types `donut` \| `pie` \| `bar` \| `trendline`; single tool takes `labels` / `data` / optional `series` (trendline); multi takes `datasets` (1–6). See tool Zod definitions for the full shape.

Build when you change frontends: `cd web-app && npm run build` and same for `web-app-multi/`. Server reads `dist/index.html` from `process.cwd()`.

---

## Extending

- **New tool:** folder under `src/lib/mcp-tools/<slug>/` exporting `getTool`, built with `McpTool` (`src/lib/models/mcp-tool.js`), registered in `src/lib/mcp-tools/index.js`. Usually do **not** edit `src/lib/server/index.js`.
- **New MCP App resource:** `McpResource` in `src/lib/mcp-resources/<slug>/`, register in `src/lib/mcp-resources/index.js`, `addUiResourceUri` from the tool. Use `RESOURCE_MIME_TYPE` for HTML apps.
- **Remove tool:** delete or unexport folder; drop registry entry; remove orphan resource if unused.
- **New route:** `src/routes/<x>.js`, mount in `src/routes/index.js`; public paths need a careful prefix in `src/constants/server.js`.
- **Auth change:** only `config.js` + secrets; for OAuth, `HOST_NAME` must match what clients use.
- **Caller token in tools (optional):** `getAuthorization` from `src/lib/request-context.js`.

Return shape: like visualiser — `content` with text items; apps may add `structuredContent`.

---

## Dependencies

`@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `express`, `zod`, `axios`, `uuid`. Vite/Chart.js live under `web-app*` `package.json` files.

## Docker

`Dockerfile` runs `node index.js`, exposes `443`; align published ports with `enableHttp` / `enableHttps` and env.

## Conventions

Config only in `config.js`. Barrel registries for tools/resources. Distinguish registry key vs MCP tool name. Errors: `src/middleware/error.js` / `CustomError`. Trace with `getAuthMethod`, `getAuthValidators`, `createMcpServer`.

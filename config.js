/**
 * Single source of truth for server and auth configuration.
 *
 * Environment variables (read only here; rest of the app uses this module):
 * - `MCP_API_KEY` — Bearer token when `authMethod` is `api_key`
 * - `CLIENT_ID` / `CLIENT_SECRET` — OAuth client for `mcpClientMaps` (e.g. Cursor callback)
 * - `KEY` / `CERT` — TLS key and certificate for HTTPS (`enableHttps`)
 * - `PORT` — HTTPS listen port
 * - `HOST_NAME` — Public hostname for OAuth metadata and WWW-Authenticate URLs
 * - `LOG_LEVEL` — `DEBUG` | `INFO` | `WARN` | `ERROR` (default `INFO`)
 *
 * Auth (`mcpServer.settings`): set `authEnabled: true` and `authMethod` to exactly one of the values below.
 *
 * - `api_key` — Bearer token must match top-level `apiKey`.
 * - `static_oauth` — Pre-registered OAuth client (`oAuthConfig`); no local DCR registration endpoint in metadata.
 * - `dcr_external` — External AS: set `externalOAuthServerIssuer`; tokens validated via that AS userinfo; DCR GET proxied to that issuer.
 * - `dcr_self` — `oAuthConfig` plus `registration_endpoint` on this host and POST `/dcr/get-client` using `mcpClientMaps`.
 */
module.exports = {
    /** Required when `authMethod` is `api_key` */
    apiKey: process.env.MCP_API_KEY,

    /** TLS private key PEM or path; env `KEY` */
    tlsKey: process.env.KEY,
    /** TLS certificate PEM or path; env `CERT` */
    tlsCert: process.env.CERT,
    /** HTTPS listen port; env `PORT` */
    httpsPort:
        process.env.PORT !== undefined && process.env.PORT !== ''
            ? Number(process.env.PORT)
            : undefined,

    /** Public host for OAuth resource URLs; env `HOST_NAME` */
    hostName: process.env.HOST_NAME,

    /** `DEBUG` | `INFO` | `WARN` | `ERROR`; env `LOG_LEVEL` */
    logLevel: process.env.LOG_LEVEL,

    mcpServer: {
        name: 'Visualiser',
        title: 'Visualiser MCP Server',
        description:
            'A visualiser MCP Server serving MCP Apps.',
        version: '1.0.0',
        settings: {
            sessionsEnabled: false,
            enableHttps: false,
            enableHttp: true,

            authEnabled: true,
            /** @type {'api_key'|'static_oauth'|'dcr_external'|'dcr_self'|undefined} Required when authEnabled is true. */
            authMethod: "api_key",

            /** OAuth/OIDC settings for `static_oauth` and `dcr_self` (issuer, optional clientId/clientSecret, userInfoUrl, supportedEmailDomains). */
            oAuthConfig: undefined,

            /** Issuer URL of the external authorization server; required when `authMethod` is `dcr_external`. */
            externalOAuthServerIssuer: undefined,
        },
    },

    /**
     * Redirect URI → static client credentials. Used for `dcr_self` POST `/dcr/get-client`.
     * For `static_oauth`, put client_id / client_secret on `oAuthConfig` instead (or both if you reuse the same client).
     */
    mcpClientMaps: {
        'cursor://anysphere.cursor-mcp/oauth/callback': {
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            redirect_uris: ['cursor://anysphere.cursor-mcp/oauth/callback'],
        },
    },
}

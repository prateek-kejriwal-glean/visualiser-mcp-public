/**
 * Wraps MCP server OAuth / OIDC client settings from config (issuer, static client, userinfo).
 */
class OAuthConfig {
    /**
     * @param {{
     *   supportedEmailDomains?: string
     *   clientId?: string
     *   clientSecret?: string
     *   issuer?: string
     *   userInfoUrl?: string
     * }} oAuthServer
     */
    constructor(oAuthServer) {
        if (!oAuthServer || typeof oAuthServer !== 'object') {
            throw new TypeError('OAuthConfig requires an oAuthServer object')
        }
        this.supportedEmailDomains = oAuthServer.supportedEmailDomains
        this.clientId = oAuthServer.clientId
        this.clientSecret = oAuthServer.clientSecret
        this.issuer = oAuthServer.issuer
        this.userInfoUrl = oAuthServer.userInfoUrl
        this.metaDataResponse = oAuthServer.metaDataResponse
    }
}

module.exports = { OAuthConfig } 

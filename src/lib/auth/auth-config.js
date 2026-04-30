const config = require('../../../config.js')

/** @typedef {'none'|'api_key'|'static_oauth'|'dcr_external'|'dcr_self'} AuthMethod */

const OAUTH_AUTH_METHODS = new Set(['static_oauth', 'dcr_external', 'dcr_self'])

const VALID_AUTH_METHODS = new Set(['api_key', 'static_oauth', 'dcr_external', 'dcr_self'])

/**
 * When auth is disabled, always `none`. When enabled, only an explicit valid `authMethod` applies.
 * @returns {AuthMethod}
 */
function getAuthMethod() {
    const settings = config.mcpServer?.settings ?? {}
    if (!settings.authEnabled) {
        return 'none'
    }
    const m = settings.authMethod
    if (m && VALID_AUTH_METHODS.has(m)) {
        return m
    }
    return 'none'
}

function isOAuthAuthMethod(method = getAuthMethod()) {
    return OAUTH_AUTH_METHODS.has(method)
}

module.exports = {
    getAuthMethod,
    isOAuthAuthMethod,
    OAUTH_AUTH_METHODS,
}

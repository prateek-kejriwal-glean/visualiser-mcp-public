const axios = require('axios')
const logger = require('../logger')
const { CustomError } = require('../../models')
const { OAuthConfig } = require('../../models/oauth-config.js')
const config = require('../../../config.js')
const { getAuthMethod } = require('./auth-config.js')

async function getOAuthMetadata(authServerUrl, wellKnownSuffix = 'openid-configuration') {
    const base = authServerUrl.replace(/\/$/, '')
    const metadataUrl = `${base}/.well-known/${wellKnownSuffix}`
    try {
        const response = await axios.get(metadataUrl, {
            headers: { Accept: 'application/json' },
            timeout: 15_000,
            validateStatus: (status) => status === 200,
        })
        const metadata = response.data
        if (!metadata || typeof metadata !== 'object') {
            throw new Error('Metadata response was not a JSON object')
        }
        return metadata
    } catch (exc) {
        logger.error('OAuth metadata fetch failed', {
            metadataUrl,
            status: exc.response?.status,
            data: exc.response?.data,
            message: exc.message,
        })
        throw new CustomError(502, 'Failed to fetch OAuth server metadata', { metadataUrl })
    }
}

function toOAuthConfigInput(oAuthConfig) {
    if (!oAuthConfig) return null
    if (oAuthConfig instanceof OAuthConfig) {
        return {
            supportedEmailDomains: oAuthConfig.supportedEmailDomains,
            clientId: oAuthConfig.clientId,
            clientSecret: oAuthConfig.clientSecret,
            issuer: oAuthConfig.issuer,
            userInfoUrl: oAuthConfig.userInfoUrl,
            metaDataResponse: oAuthConfig.metaDataResponse,
        }
    }
    return { ...oAuthConfig }
}

/**
 * Auth server context for well-known documents and OAuth token validation.
 * @returns {Promise<OAuthConfig|undefined>}
 */
async function getAuthServer() {
    const method = getAuthMethod()
    const settings = config.mcpServer?.settings ?? {}
    const { oAuthConfig, externalOAuthServerIssuer } = settings

    if (method === 'dcr_external') {
        const issuer = externalOAuthServerIssuer
        if (!issuer) {
            return undefined
        }
        const serverMetaData = await getOAuthMetadata(issuer)
        return new OAuthConfig({
            issuer: serverMetaData.issuer,
            metaDataResponse: serverMetaData,
            userInfoUrl: serverMetaData.userinfo_endpoint,
        })
    }

    if (method === 'static_oauth' || method === 'dcr_self') {
        const base = toOAuthConfigInput(oAuthConfig)
        if (!base?.issuer) {
            return undefined
        }
        const serverMetaData = await getOAuthMetadata(base.issuer)
        const merged = {
            ...base,
            issuer: serverMetaData.issuer ?? base.issuer,
            userInfoUrl: base.userInfoUrl || serverMetaData.userinfo_endpoint,
            metaDataResponse: { ...serverMetaData },
        }
        if (method === 'dcr_self') {
            merged.metaDataResponse.registration_endpoint = `https://${config.hostName}/dcr/get-client`
        }
        return new OAuthConfig(merged)
    }

    return undefined
}

module.exports = {
    getOAuthMetadata,
    getAuthServer,
}

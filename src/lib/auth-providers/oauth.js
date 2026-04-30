const axios = require('axios')
const logger = require('../logger')
const { CustomError } = require('../../models')
const { getAuthServer, getOAuthMetadata } = require('../auth/oauth-server-resolver.js')
const { getAuthMethod } = require('../auth/auth-config.js')

async function checkAuth(token) {
    const authServer = await getAuthServer()
    if (!authServer) {
        throw new CustomError(500, 'OAuth is not configured for this auth method')
    }
    const supportedEmailDomains = authServer.supportedEmailDomains
    const clientId = authServer.clientId
    const issuer = authServer.issuer
    const userInfoUrl = authServer.userInfoUrl

    const tokenDetails = decodeJwtPayload(token)

    if (getAuthMethod() !== 'dcr_external') {
        const tokenIssuer = tokenDetails.iss
        const tokenEmail = tokenDetails.email
        const tokenClientId = tokenDetails.azp

        if (
            supportedEmailDomains &&
            tokenEmail &&
            !(typeof tokenEmail === 'string' && tokenEmail.endsWith(supportedEmailDomains))
        ) {
            throw new CustomError(401, 'Invalid email domain', { tokenEmail, supportedEmailDomains })
        }
        if (clientId && tokenClientId && clientId !== tokenClientId) {
            throw new CustomError(401, 'Invalid client id', { tokenClientId, clientId })
        }
        if (issuer && tokenIssuer && tokenIssuer !== issuer) {
            throw new CustomError(401, 'Invalid issuer', { tokenIssuer, issuer })
        }
    }

    const userInfo = await getUserInfo(userInfoUrl, token)
    if (userInfo >= 400) {
        throw new CustomError(401, 'Userinfo rejected', { status: userInfo })
    }
    return true
}

function decodeJwtPayload(token) {
    const parts = token?.split('.') ?? []
    if (parts.length < 2) {
        return {}
    }
    const raw = parts[1]
    const attempts = ['base64url', 'base64']
    for (const enc of attempts) {
        try {
            const buf = Buffer.from(raw, enc)
            return JSON.parse(buf.toString('utf8'))
        } catch {
            /* try next */
        }
    }
    return {}
}

async function getUserInfo(userInfoUrl, token) {
    if (!userInfoUrl) {
        throw new CustomError(500, 'OAuth userinfo URL is not configured')
    }
    try {
        const response = await axios({
            url: userInfoUrl,
            method: 'post',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.status
    } catch (exc) {
        logger.error('Userinfo request failed', { data: exc.response?.data, message: exc.message })
        throw new Error('User is invalid or the token has expired')
    }
}

module.exports = { checkAuth, getOAuthMetadata }

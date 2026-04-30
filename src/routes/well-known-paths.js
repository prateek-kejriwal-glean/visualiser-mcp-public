const { getOAuthMetadata, getAuthServer } = require('../lib/auth/oauth-server-resolver.js')
const { isOAuthAuthMethod } = require('../lib/auth/auth-config.js')
const { hostName } = require('../../config.js')
const ExpressRouter = require('express').Router
const router = ExpressRouter()

router.get('/.well-known/:metadataType{/*resourceType}', async (req, res, next) => {
    const metadataType = req.params.metadataType

    if (!isOAuthAuthMethod()) {
        res.status(404).json({ message: 'OAuth metadata is not available for the configured auth method' })
        return
    }

    let authServer
    try {
        authServer = await getAuthServer()
    } catch (err) {
        next(err)
        return
    }

    if (!authServer) {
        res.status(404).json({ message: 'OAuth server unavailable for this configuration' })
        return
    }

    const metadata = authServer.metaDataResponse
    try {
        switch (metadataType) {
            case 'oauth-protected-resource':
                res.status(200).send({
                    resource: `https://${hostName}/mcp`,
                    authorization_servers: [authServer.issuer],
                })
                break

            case 'oauth-authorization-server':
                res.status(200).json(
                    metadata ?? (await getOAuthMetadata(authServer.issuer, 'oauth-authorization-server')),
                )
                break
            case 'openid-configuration':
                res.status(200).json(metadata ?? (await getOAuthMetadata(authServer.issuer, 'openid-configuration')))
                break
            default:
                res.redirect('https://app.glean.com')
        }
    } catch (err) {
        next(err)
    }
})

module.exports = router

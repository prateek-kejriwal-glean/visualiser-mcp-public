const ExpressRouter = require('express').Router
const router = ExpressRouter()
const config = require('../../config.js')
const { CustomError } = require('../models')
const { getAuthMethod } = require('../lib/auth/auth-config.js')

function tailPath(req) {
    const p = req.params.path
    if (Array.isArray(p)) {
        return p.join('/')
    }
    return p || ''
}

router.get('/dcr/{*path}', (req, res) => {
    const method = getAuthMethod()
    if (method === 'none' || method === 'api_key') {
        res.status(404).json({ message: 'DCR is not available for this auth method' })
        return
    }

    const settings = config.mcpServer?.settings ?? {}
    const issuer =
        method === 'dcr_external' ? settings.externalOAuthServerIssuer : settings.oAuthConfig?.issuer

    if (!issuer) {
        res.status(404).json({ message: 'No OAuth issuer configured' })
        return
    }

    const rest = tailPath(req)
    const targetBase = issuer.replace(/\/$/, '')
    const suffix = rest ? `/${rest}` : ''
    res.redirect(308, `${targetBase}${suffix}`)
})

router.post('/dcr/{*path}', (req, res, next) => {
    try {
        const method = getAuthMethod()
        const tail = tailPath(req)
        const head = tail.split('/')[0] || ''

        if (head !== 'get-client') {
            res.status(404).json({ message: 'Unknown DCR path' })
            return
        }

        if (method !== 'dcr_self') {
            res.status(404).json({
                message:
                    'Dynamic client registration is only available when authMethod is dcr_self. Use your authorization server for other modes.',
            })
            return
        }

        const mcpClientMaps = config.mcpClientMaps ?? {}
        const data = req.body
        const ok =
            data?.redirect_uris &&
            Array.isArray(data.redirect_uris) &&
            data.redirect_uris.every((value) => mcpClientMaps[value])

        if (ok) {
            res.send(mcpClientMaps[data.redirect_uris[0]])
            return
        }

        throw new CustomError(401, 'Invalid Client/ Redirect URI', { data })
    } catch (err) {
        next(err)
    }
})

module.exports = router

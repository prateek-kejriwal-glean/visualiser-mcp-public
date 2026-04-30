const { isAsyncFunction } = require('node:util/types')
const { getAuthValidators } = require('../lib/auth-providers')
const { UNAUTHENTICATED_PATHS: unAuthenticatedPaths } = require('../constants/server')
const logger = require('../lib/logger')
const { CustomError } = require('../models')
const { getAuthMethod } = require('../lib/auth/auth-config.js')
const { hostName } = require('../../config.js')

module.exports = function () {
    return async (req, res, next) => {
        if (checkForUnAuthenticatedPath(req.path, req.method) || getAuthMethod() === 'none') {
            next()
            return
        }

        let authToken = req.headers.authorization
        authToken = authToken?.split(' ')[1]
        const authValidators = getAuthValidators()
        const authChecks = []
        if (authToken) {
            for (const authType in authValidators) {
                const authChecker = authValidators[authType]
                if (isAsyncFunction(authChecker.checkAuth)) {
                    authChecks.push(authChecker.checkAuth(authToken))
                }
            }
            if (authChecks.length === 0) {
                next(new CustomError(500, 'No auth validators configured for this auth method'))
                return
            }
            try {
                await Promise.any(authChecks)
                next()
            } catch (exc) {
                logger.error('User is unauthenticated or the token is expired', exc)
                next(new CustomError(401, 'Invalid Token', { errorMessage: exc.message }))
            }
        } else {
            logger.error('Authorization token required to access this MCP Server')
            next(createUnauthenticatedMcpError())
        }
    }
}

function createUnauthenticatedMcpError() {
    const { isOAuthAuthMethod } = require('../lib/auth/auth-config.js')
    const headers = {}
    if (isOAuthAuthMethod()) {
        headers['WWW-Authenticate'] =
            `Bearer realm="OAuth",resource_metadata="https://${hostName}/.well-known/oauth-protected-resource"`
    } else {
        headers['WWW-Authenticate'] = `Bearer realm="MCP"`
    }
    return new CustomError(401, 'User Unauthenticated', {
        headers,
    })
}

function checkForUnAuthenticatedPath(path, method) {
    for (const unAuthenticatedPath in unAuthenticatedPaths) {
        if (path.startsWith(unAuthenticatedPath)) {
            const pathDetail = unAuthenticatedPaths[unAuthenticatedPath]
            if (pathDetail.methods) {
                return pathDetail.methods.some((val) => val === method)
            }
            return true
        }
    }
    return false
}

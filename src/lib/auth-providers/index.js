const { getAuthMethod } = require('../auth/auth-config.js')

function getAuthValidators() {
    const method = getAuthMethod()
    if (method === 'api_key') {
        return { apiKey: require('./api-key') }
    }
    if (method === 'static_oauth' || method === 'dcr_external' || method === 'dcr_self') {
        return { oauth: require('./oauth') }
    }
    return {}
}

module.exports = {
    oauth: require('./oauth'),
    apiKey: require('./api-key'),
    getAuthValidators,
}

const { AsyncLocalStorage } = require('node:async_hooks')

const requestContext = new AsyncLocalStorage()

function run(context, fn) {
    return requestContext.run(context, fn)
}

function get() {
    return requestContext.getStore()
}

function getAuthorization() {
    const store = requestContext.getStore()
    return store?.authorization ?? null
}

module.exports = { run, get, getAuthorization }

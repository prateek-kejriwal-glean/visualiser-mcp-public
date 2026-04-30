const { createMcpServer, getStreamableHttpTransport, removeStaleTransport } = require('../lib/server')
const requestContext = require('../lib/request-context')
const { mcpServer: mcpServerConfig } = require('../../config.js')

async function streamableHttpPost(req, res, next) {
    await handleMcpRequest(req, res, req.body)
    next()
}

async function streamableHttpGet(req, res, next) {
    await handleMcpRequest(req, res)
    next()
}

async function mcpSessionClose(req, res, next) {
    removeStaleTransport(req.headers['mcp-session-id'])
    res.sendStatus(202)
    next()
}

async function handleMcpRequest(req, res, body) {
    const sessionId = req.headers['mcp-session-id']
    const { transport, newSession } = getStreamableHttpTransport(sessionId ?? undefined)
    if (newSession) {
        const mcpServer = createMcpServer(
            mcpServerConfig.name,
            mcpServerConfig.title,
            mcpServerConfig.description,
            mcpServerConfig.version
        )
        await mcpServer.connect(transport)
    }
    const handlePromise = requestContext.run(
        { authorization: req.headers.authorization },
        () => transport.handleRequest(req, res, body ?? undefined)
    )
    await handlePromise
}




module.exports = { streamableHttpGet, streamableHttpPost, mcpSessionClose }
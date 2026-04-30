const logger = require('../lib/logger')
const { buildMcpAccessLogMeta } = require('../lib/mcp-request-log')

module.exports = (req, res, next) => {
    const startTime = Date.now()
    const { method, originalUrl } = req
    const mcpMeta = buildMcpAccessLogMeta(req)

    logger.info(`--> ${method} ${originalUrl}`, mcpMeta ?? undefined)

    res.on('finish', () => {
        const duration = Date.now() - startTime
        const { statusCode } = res

        logger.info(`<-- ${method} ${originalUrl}`, {
            statusCode,
            duration: `${duration}ms`,
            ...(mcpMeta ?? {})
        })
    })

    next()
}

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { registerAppResource } = require('@modelcontextprotocol/ext-apps/server')
const mcpTools = require('../mcp-tools');

const uuid = require('uuid')
const mcpResources = require('../mcp-resources')
const { CustomError } = require('../../models')
const logger = require('../logger')
let transports = {}

function getTools() {
    const tools = []
    for (const tool in mcpTools) {
        tools.push(mcpTools[tool].getTool())
    }
    return tools
}

function getResources() {
    const resources = []
    for (const mcpResource in mcpResources) {
        resources.push(mcpResources[mcpResource].getResource())
    }
    return resources

}

function createMcpServer(name, title, description, version) {
    const mcpServer = new McpServer({
        "name": name,
        "description": description,
        "title": title ?? name,
        "version": version ?? "1.0.0"
    })

    for (const tool of getTools()) {
        mcpServer.registerTool(...tool)
    }
    for (const resource of getResources()) {
        registerAppResource(mcpServer, ...resource)
    }

    mcpServer.server.onclose = () => logger.info("MCP server connection closed")
    return mcpServer
}

function getStreamableHttpTransport(sessionId) {
    let transportToReturn, newSession

    if (sessionId) {
        if (transports[sessionId]) {
            logger.debug("Reusing existing transport", { sessionId })
            transportToReturn = transports[sessionId]
        } else {
            logger.warn("Invalid session ID requested", { sessionId })
            removeStaleTransport(sessionId)
            throw new CustomError(404, "Invalid Session Id. Please re-initialise a session")
        }
    } else {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: uuid.v4 })
        transport.onmessage = (message) => {
            logger.info("MCP session ID", { sessionId: transport.sessionId })
            transports[transport.sessionId] = transport
        }
        transportToReturn = transport
        newSession = true
    }
    transportToReturn.onclose = () => {
        const closedId = transportToReturn.sessionId ?? sessionId
        logger.info("Transport closed", { sessionId: closedId })
        delete transports[closedId]
    }

    return { transport: transportToReturn, newSession }
}

function removeStaleTransport(sessionId) {
    const transport = transports[sessionId]
    transport?.close()
    delete transports[sessionId]
}

module.exports = { createMcpServer, getStreamableHttpTransport, removeStaleTransport }


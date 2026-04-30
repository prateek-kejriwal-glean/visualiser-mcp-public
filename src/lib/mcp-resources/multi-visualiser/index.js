const { MCPResource } = require('../../models/mcp-resource')
const { RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server')
const fs = require('fs')
const path = require('path')

function createResource() {
    const resource = new MCPResource('multi-visualiser')

    resource.setUri('ui://multi-visualiser.html')

    resource.setConfig({ mimeType: RESOURCE_MIME_TYPE })

    resource.setCallback(function () {
        const html = fs.readFileSync(
            path.join(process.cwd(), 'web-app-multi', 'dist', 'index.html'),
            'utf-8',
        )
        return {
            contents: [
                { uri: resource.uri, mimeType: RESOURCE_MIME_TYPE, text: html },
            ],
        }
    })

    return resource
}

function getResource() {
    return createResource().getResourceForMCPServer()
}

module.exports = { getResource }

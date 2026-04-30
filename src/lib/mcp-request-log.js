/**
 * Derives structured fields for access logs on POST /mcp JSON-RPC bodies.
 */

const MAX_MESSAGES_IN_LOG = 32
const MAX_TOOL_NAMES_IN_LOG = 64

/**
 * @param {import('express').Request} req
 * @returns {Record<string, unknown> | null} Meta to merge into log lines, or null if not an MCP route.
 */
function buildMcpAccessLogMeta(req) {
    if (req.path !== '/mcp') {
        return null
    }

    const mcpSessionId = req.headers['mcp-session-id']
    const base = {
        mcp: true,
        ...(mcpSessionId ? { mcpSessionId } : {})
    }

    if (req.method === 'GET') {
        return {
            ...base,
            mcpTransport: 'streamable_http',
            mcpMessageTypes: ['sse_stream'],
            mcpSummary: 'SSE stream (GET)'
        }
    }

    if (req.method === 'DELETE') {
        return {
            ...base,
            mcpTransport: 'streamable_http',
            mcpMessageTypes: ['session_close'],
            mcpSummary: 'Session close (DELETE)'
        }
    }

    if (req.method === 'POST') {
        return { ...base, ...summarizeMcpPostBody(req.body) }
    }

    return base
}

/**
 * @param {unknown} body
 */
function summarizeMcpPostBody(body) {
    const out = {
        mcpTransport: 'streamable_http',
        mcpMessageTypes: [],
        mcpRpcMethods: [],
        mcpJsonRpcKinds: [],
        mcpInitialize: false,
        mcpInitializedNotification: false,
        mcpToolsList: false,
        mcpToolCalls: [],
        mcpMessageCount: 0,
        mcpSummary: ''
    }

    if (body == null || (typeof body === 'object' && body !== null && Object.keys(body).length === 0)) {
        out.mcpSummary = 'POST (empty body)'
        return out
    }

    const rawList = Array.isArray(body) ? body : [body]
    out.mcpMessageCount = rawList.length
    const messages = rawList.slice(0, MAX_MESSAGES_IN_LOG)
    const truncated = rawList.length > MAX_MESSAGES_IN_LOG

    const typeSet = new Set()
    const methods = []
    const kinds = []
    const toolCallNames = []

    for (const msg of messages) {
        if (!msg || typeof msg !== 'object') {
            kinds.push('invalid')
            continue
        }

        const kind = classifyJsonRpcMessage(msg)
        kinds.push(kind)
        typeSet.add(kind)

        if (kind === 'request' || kind === 'notification') {
            const method = typeof msg.method === 'string' ? msg.method : undefined
            if (method) {
                methods.push(method)
            }

            if (method === 'initialize') {
                out.mcpInitialize = true
                typeSet.add('initialize')
            }
            if (method === 'initialized') {
                out.mcpInitializedNotification = true
                typeSet.add('initialized_notification')
            }
            if (method === 'tools/list') {
                out.mcpToolsList = true
                typeSet.add('tools_list')
            }
            if (method === 'tools/call') {
                typeSet.add('tool_call')
                const name = msg.params && typeof msg.params.name === 'string' ? msg.params.name : undefined
                if (name && toolCallNames.length < MAX_TOOL_NAMES_IN_LOG) {
                    toolCallNames.push(name)
                }
            }
        }
    }

    out.mcpJsonRpcKinds = kinds
    out.mcpRpcMethods = methods
    out.mcpToolCalls = toolCallNames
    out.mcpMessageTypes = [...typeSet]

    const parts = []
    if (out.mcpInitialize) parts.push('initialize')
    if (out.mcpInitializedNotification) parts.push('initialized')
    if (out.mcpToolsList) parts.push('tools/list')
    if (toolCallNames.length) parts.push(`tools/call:${toolCallNames.join(',')}`)
    if (methods.length && !parts.length) parts.push(methods.join(','))
    if (!parts.length && kinds.length) parts.push(`jsonrpc:${kinds.join(',')}`)

    let summary = parts.length ? `POST (${parts.join(' | ')})` : 'POST (mcp)'
    if (truncated) {
        summary += ` [+${rawList.length - MAX_MESSAGES_IN_LOG} more messages]`
    }
    out.mcpSummary = summary
    if (truncated) {
        out.mcpMessagesTruncated = true
    }

    return out
}

/**
 * @param {object} msg
 * @returns {string}
 */
function classifyJsonRpcMessage(msg) {
    if (msg.jsonrpc !== '2.0') {
        return 'non_jsonrpc'
    }
    const hasId = Object.prototype.hasOwnProperty.call(msg, 'id')
    if (Object.prototype.hasOwnProperty.call(msg, 'method')) {
        return hasId ? 'request' : 'notification'
    }
    if (Object.prototype.hasOwnProperty.call(msg, 'result')) {
        return 'response'
    }
    if (Object.prototype.hasOwnProperty.call(msg, 'error')) {
        return 'error'
    }
    return 'unknown'
}

module.exports = {
    buildMcpAccessLogMeta,
    summarizeMcpPostBody
}

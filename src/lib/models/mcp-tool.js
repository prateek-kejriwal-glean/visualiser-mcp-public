const { z } = require("zod")

class McpTool {

    name
    inputArgs = {}
    callbackFunction

    constructor(name) {
        this.name = name
    }

    setToolDescription(description) {
        this.toolDescription = description
    }

    addInputArgument(argName, argType, argDescription, argDefault) {
        let arg = z[argType]()
        arg = arg.describe(argDescription)
        arg = arg.default(argDefault)
        this.inputArgs[argName] = arg
    }

    addInputArgumentAdvanced(argName, zodValue) {
        this.inputArgs[argName] = zodValue
    }

    setCallback(callbackFunction) {
        this.callbackFunction = callbackFunction
    }

    setTitle(title) { this.title = title }

    getToolForMcpServer() {
        const config = {
            title: this.title,
            description: this.toolDescription,
            inputSchema: z.object(this.inputArgs),
            annotations: this.annotations,
        }
        if (this._meta) {
            config._meta = this._meta
        }
        return [this.name, config, this.callbackFunction]
    }

    setAnnotations(annotations) {
        this.annotations = annotations
    }
    addUiResourceUri(resourceUri) {
        this._meta = { ui: { resourceUri } }
    }
}

class McpToolAnnotationsBuilder {
    constructor() {
        this.annotations = {}
    }
    setReadOnly() {
        this.annotations.readOnlyHint = true
        return this
    }
    setWriteCapability() {
        this.annotations.destructiveHint = true
        return this

    }
    setIdempotentHint() {
        this.annotations.idempotentHint = true
        return this

    }
    setOpenWorldHint() {
        this.annotations.openWorldHint = true
        return this

    }
    setTitle(title) {
        this.annotations.title = title
        return this

    }
    build() { return this.annotations }
}
module.exports = { McpTool, McpToolAnnotationsBuilder }
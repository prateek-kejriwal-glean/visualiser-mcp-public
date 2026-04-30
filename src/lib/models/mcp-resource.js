
class MCPResource {

    constructor(name) {
        this.name = name
    }
    setUri(uri) {
        this.uri = uri
    }

    setConfig(config) {
        this.config = config
    }

    setCallback(callback) {
        this.callback = callback
    }
    getResourceForMCPServer() {
        return [this.name, this.uri, this.config, this.callback]
    }


}

module.exports = { MCPResource }
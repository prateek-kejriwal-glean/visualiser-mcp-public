module.exports = class extends Error {

    constructor(statusCode, message,data) { 
        super(message)
        this.statusCode=statusCode
        this.data=data
    }

}
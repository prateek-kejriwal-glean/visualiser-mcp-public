const CustomError = require('../models/error')
const logger = require('../lib/logger')

module.exports = async (error, req, res, next) => {
    if (error instanceof CustomError) {
        logger.warn("Request failed with custom error", {
            statusCode: error.statusCode,
            message: error.message,
            url: req.originalUrl,
            data: error.data
        })
        if (error?.data?.headers) {
            res.set(error.data.headers)
        }
        res.status(error.statusCode).json({ error: error.message })
    } else {
        logger.error("Unhandled error", {
            message: error.message,
            stack: error.stack,
            url: req.originalUrl
        })
        res.send(500)
    }
}
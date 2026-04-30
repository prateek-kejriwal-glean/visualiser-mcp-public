const logger = require('../logger')
const { CustomError } = require('../../models')
const { apiKey } = require('../../../config')

async function checkAuth(key) {
    if (key) {
        if (apiKey === key) {
            return true
        } else {
            throw new CustomError(401, 'API Key not valid', { status: key })
        }
    } else {
        throw new CustomError(400, 'API Key not provided', { status: key })
    }

}





module.exports = { checkAuth }

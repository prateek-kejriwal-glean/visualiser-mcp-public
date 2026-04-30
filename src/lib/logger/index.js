const { logLevel: logLevelEnv } = require('../../../config.js')

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
}

const LOG_LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR']

const currentLogLevel = LOG_LEVELS[logLevelEnv?.toUpperCase()] ?? LOG_LEVELS.INFO


function formatTimestamp() {
    return new Date().toISOString()
}

function formatMessage(level, message, meta = {}) {
    const base = {
        timestamp: formatTimestamp(),
        level: LOG_LEVEL_NAMES[level],
        message
    }

    if (Object.keys(meta).length > 0) {
        base.meta = meta
    }

    return JSON.stringify(base)
}

function log(level, message, meta) {
    if (level < currentLogLevel) return

    const formatted = formatMessage(level, message, meta)

    switch (level) {
        case LOG_LEVELS.ERROR:
            console.error(formatted)
            break
        case LOG_LEVELS.WARN:
            console.warn(formatted)
            break
        default:
            console.log(formatted)
    }
}

const logger = {
    debug: (message, meta) => log(LOG_LEVELS.DEBUG, message, meta),
    info: (message, meta) => log(LOG_LEVELS.INFO, message, meta),
    warn: (message, meta) => log(LOG_LEVELS.WARN, message, meta),
    error: (message, meta) => log(LOG_LEVELS.ERROR, message, meta),

    // Create a child logger with preset metadata
    child: (defaultMeta) => ({
        debug: (message, meta) => log(LOG_LEVELS.DEBUG, message, { ...defaultMeta, ...meta }),
        info: (message, meta) => log(LOG_LEVELS.INFO, message, { ...defaultMeta, ...meta }),
        warn: (message, meta) => log(LOG_LEVELS.WARN, message, { ...defaultMeta, ...meta }),
        error: (message, meta) => log(LOG_LEVELS.ERROR, message, { ...defaultMeta, ...meta })
    })
}

module.exports = logger

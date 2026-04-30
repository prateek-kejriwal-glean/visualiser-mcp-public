const ExpressRouter = require('express').Router
const router = ExpressRouter()

const mcpRoutes = require('./mcp')
const wellKnownRoutes = require('./well-known-paths')
const dcr = require('./dcr')
const healthCheck = require('./health-check')

router.use(mcpRoutes)
router.use(wellKnownRoutes)
router.use(dcr)
router.use(healthCheck)


module.exports = router
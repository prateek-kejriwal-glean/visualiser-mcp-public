const ExpressRouter = require('express').Router
const router = ExpressRouter()
const mcpHandler = require('../handler/mcp')

router.post('/mcp', mcpHandler.streamableHttpPost)
router.get('/mcp', mcpHandler.streamableHttpGet)
router.delete('/mcp', mcpHandler.mcpSessionClose)



module.exports = router


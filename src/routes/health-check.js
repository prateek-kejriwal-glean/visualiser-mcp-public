const ExpressRouter = require('express').Router
const router = ExpressRouter()

router.get('/healthcheck', (req,res,next)=>{
    res.sendStatus(200)
    return next()
})



module.exports = router


const express = require('express');
const https = require('https');
const routes = require('./src/routes/index')
const authCheck = require("./src/middleware/auth");
const config = require('./config.js')
const { mcpServer: { settings: mcpServerSettings }, tlsKey, tlsCert, httpsPort } = config
const { getAuthMethod } = require('./src/lib/auth/auth-config.js')
const errorHandler = require('./src/middleware/error.js')
const requestLogger = require('./src/middleware/logger')
const logger = require('./src/lib/logger');


const app = express();
app.use(express.json())
app.use(requestLogger)
app.use(authCheck())
app.use(routes)
app.use(errorHandler)


function runServerHttps() {
  const options = {
    key: tlsKey,
    cert: tlsCert
  };
  if (options.cert) {
    https.createServer(options, app).listen(httpsPort, () => {
      logger.info("Server started", { port: httpsPort })
    });
  }
}

function runServerHttp() {
  app.listen(80, () => {
    logger.info("Server started on port 80", { port: 80 })
  })
}


async function startServer() {
  if (mcpServerSettings.authEnabled && getAuthMethod() === 'none') {
    logger.warn(
      'authEnabled is true but authMethod is missing or invalid; protected routes will stay open until you set authMethod to api_key, static_oauth, dcr_external, or dcr_self.',
    )
  }
  if (mcpServerSettings.enableHttp) {
    runServerHttp()
  }
  if (mcpServerSettings.enableHttps) {
    runServerHttps()

  }

}


startServer().catch((err) => logger.error("Failed to start server", { error: err.message }))
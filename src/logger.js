const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  base: {
    service: 'matching-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;

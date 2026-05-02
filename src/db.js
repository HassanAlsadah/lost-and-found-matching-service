const { Pool } = require('pg');
const logger = require('./logger');

const poolConfig = {
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

// Cloud Run uses unix socket to connect to Cloud SQL
if (process.env.INSTANCE_CONNECTION_NAME) {
  poolConfig.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT, 10) || 5432;
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('Database connection established');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database error');
});

module.exports = pool;

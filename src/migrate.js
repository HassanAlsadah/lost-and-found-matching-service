require('dotenv').config();
const db = require('./db');
const logger = require('./logger');

const migrate = async () => {
  try {
    logger.info('Running database migration for matching-service...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        lost_item_id INTEGER NOT NULL,
        found_item_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(lost_item_id, found_item_id)
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost_item_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_item_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)');

    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  }
};

migrate();

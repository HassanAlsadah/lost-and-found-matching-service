// ============================================
// Factor 13: API First
// POST /match         → run matching for an item
// GET  /match/:itemId → get matches for an item
// GET  /match         → list all matches
// ============================================

const express = require('express');
const db = require('./db');
const { findMatches } = require('./matchingEngine');
const logger = require('./logger');

const router = express.Router();

const MATCH_THRESHOLD = parseInt(process.env.MATCH_THRESHOLD, 10) || 70;

// -----------------------------------------
// POST /match — Run matching for a given item
// This endpoint can be called directly OR
// your teammate will trigger it via Event Bridge
// -----------------------------------------
router.post('/', async (req, res) => {
  try {
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    // Get the new item
    const itemResult = await db.query('SELECT * FROM items WHERE id = $1', [itemId]);
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const newItem = itemResult.rows[0];

    // Determine opposite type
    const oppositeType = newItem.type === 'lost' ? 'found' : 'lost';

    // Read candidates from the opposite side (compare items)
    const candidatesResult = await db.query(
      `SELECT * FROM items
       WHERE type = $1
       AND category = $2
       AND status = 'unmatched'
       AND id != $3`,
      [oppositeType, newItem.category, newItem.id]
    );

    const candidates = candidatesResult.rows;

    logger.info({
      itemId: newItem.id,
      type: newItem.type,
      category: newItem.category,
      candidatesFound: candidates.length
    }, 'Running matching');

    // Run matching engine
    const matches = findMatches(newItem, candidates, MATCH_THRESHOLD);

    // Save matches to database
    const savedMatches = [];
    for (const match of matches) {
      const lostItemId = newItem.type === 'lost' ? newItem.id : match.candidate.id;
      const foundItemId = newItem.type === 'found' ? newItem.id : match.candidate.id;

      // Check if match already exists
      const existingMatch = await db.query(
        'SELECT id FROM matches WHERE lost_item_id = $1 AND found_item_id = $2',
        [lostItemId, foundItemId]
      );

      if (existingMatch.rows.length > 0) continue;

      // Save match
      const matchResult = await db.query(
        `INSERT INTO matches (lost_item_id, found_item_id, score, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [lostItemId, foundItemId, match.score]
      );

      // Update both items status to matched
      await db.query("UPDATE items SET status = 'matched' WHERE id = $1 OR id = $2", [lostItemId, foundItemId]);

      savedMatches.push(matchResult.rows[0]);

      logger.info({
        matchId: matchResult.rows[0].id,
        lostItemId,
        foundItemId,
        score: match.score
      }, 'Match saved');

      // NOTE: Event publishing (match_found) to Event Bridge
      // will be added by the teammate handling connections
    }

    res.status(200).json({
      message: `Matching complete. Found ${savedMatches.length} match(es)`,
      matches: savedMatches
    });
  } catch (err) {
    logger.error({ err }, 'Matching failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------------------
// GET /match/:itemId — Get matches for an item
// -----------------------------------------
router.get('/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await db.query(
      `SELECT m.*, 
              li.title as lost_title, li.category as lost_category, li.location as lost_location,
              fi.title as found_title, fi.category as found_category, fi.location as found_location
       FROM matches m
       JOIN items li ON m.lost_item_id = li.id
       JOIN items fi ON m.found_item_id = fi.id
       WHERE m.lost_item_id = $1 OR m.found_item_id = $1
       ORDER BY m.score DESC`,
      [itemId]
    );

    res.status(200).json({ matches: result.rows });
  } catch (err) {
    logger.error({ err }, 'Get matches failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -----------------------------------------
// GET /match — List all matches
// -----------------------------------------
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT m.*, 
             li.title as lost_title, li.user_id as lost_user_id,
             fi.title as found_title, fi.user_id as found_user_id
      FROM matches m
      JOIN items li ON m.lost_item_id = li.id
      JOIN items fi ON m.found_item_id = fi.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE m.status = $1';
      params.push(status);
    }

    query += ' ORDER BY m.created_at DESC';

    const result = await db.query(query, params);

    res.status(200).json({ matches: result.rows });
  } catch (err) {
    logger.error({ err }, 'List matches failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// ============================================
// Matching Engine
// Compares a new item against existing items
// on the opposite side and computes a score
// ============================================

const logger = require('./logger');

/**
 * Compute match score between two items (0-100)
 *
 * +40 pts  same category
 * +30 pts  location overlap (partial string match)
 * +20 pts  keyword overlap in title/description
 * +10 pts  date proximity (within 7 days = full score)
 */
const computeMatchScore = (newItem, candidate) => {
  let score = 0;

  // 1. Category match (+40)
  if (newItem.category.toLowerCase() === candidate.category.toLowerCase()) {
    score += 40;
  }

  // 2. Location proximity (+30)
  const newLoc = newItem.location.toLowerCase();
  const candLoc = candidate.location.toLowerCase();
  if (newLoc === candLoc) {
    score += 30;
  } else if (newLoc.includes(candLoc) || candLoc.includes(newLoc)) {
    score += 20;
  } else {
    // Check if any word overlaps
    const newWords = newLoc.split(/[\s,]+/);
    const candWords = candLoc.split(/[\s,]+/);
    const overlap = newWords.filter(w => candWords.includes(w) && w.length > 2);
    if (overlap.length > 0) {
      score += 10;
    }
  }

  // 3. Keyword overlap in title + description (+20)
  const newText = `${newItem.title} ${newItem.description || ''}`.toLowerCase();
  const candText = `${candidate.title} ${candidate.description || ''}`.toLowerCase();
  const newWords = newText.split(/\s+/).filter(w => w.length > 3);
  const candWords = new Set(candText.split(/\s+/).filter(w => w.length > 3));
  const matchingWords = newWords.filter(w => candWords.has(w));
  if (matchingWords.length >= 3) {
    score += 20;
  } else if (matchingWords.length >= 1) {
    score += 10;
  }

  // 4. Date proximity (+10)
  const newDate = new Date(newItem.date);
  const candDate = new Date(candidate.date);
  const daysDiff = Math.abs((newDate - candDate) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 1) {
    score += 10;
  } else if (daysDiff <= 3) {
    score += 7;
  } else if (daysDiff <= 7) {
    score += 5;
  } else if (daysDiff <= 14) {
    score += 2;
  }

  return score;
};

/**
 * Find matches for a given item
 * Returns array of { candidate, score } above threshold
 */
const findMatches = (newItem, candidates, threshold) => {
  const matches = [];

  for (const candidate of candidates) {
    // Don't match items from the same user
    if (candidate.user_id === newItem.user_id) continue;

    const score = computeMatchScore(newItem, candidate);

    if (score >= threshold) {
      matches.push({ candidate, score });
      logger.info({
        newItemId: newItem.id,
        candidateId: candidate.id,
        score
      }, 'Match found');
    }
  }

  // Sort by highest score first
  matches.sort((a, b) => b.score - a.score);

  return matches;
};

module.exports = { computeMatchScore, findMatches };

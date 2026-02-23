/**
 * AGENT PUBLISHER — publish-tracker.js
 * Gère l'état des publications pour éviter les doublons
 * et tracker les performances.
 *
 * State file : data/publish-state.json
 * {
 *   published: { [pin_id]: { pinterest_id, published_at, board, url } },
 *   failed:    { [pin_id]: { error, attempts, last_attempt } },
 *   stats:     { total_published, total_failed, this_week }
 * }
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../../data/publish-state.json');

// ─── State Management ────────────────────────────────────────────────────────

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      published: {},
      failed: {},
      stats: { total_published: 0, total_failed: 0, this_week: 0 },
      last_updated: null,
    };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  state.last_updated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Marque un pin comme publié avec succès
 */
function markPublished(state, pin, pinterestResult) {
  state.published[pin.pin_id] = {
    pinterest_id: pinterestResult.id,
    published_at: new Date().toISOString(),
    board: pin.board,
    keyword: pin.keyword,
    type: pin.type,
    destination_url: pin.destination_url,
    pinterest_url: `https://pinterest.com/pin/${pinterestResult.id}`,
    scheduled_at: pin.scheduled_at,
    mock: pinterestResult._mock || false,
  };

  // Supprime des failed si retry réussi
  delete state.failed[pin.pin_id];

  state.stats.total_published++;
  state.stats.this_week++;
  return state;
}

/**
 * Marque un pin comme échoué
 */
function markFailed(state, pin, error) {
  const existing = state.failed[pin.pin_id] || { attempts: 0 };
  state.failed[pin.pin_id] = {
    error: error.message,
    attempts: existing.attempts + 1,
    last_attempt: new Date().toISOString(),
    pin_id: pin.pin_id,
    keyword: pin.keyword,
  };
  state.stats.total_failed++;
  return state;
}

/**
 * Vérifie si un pin est déjà publié
 */
function isPublished(state, pinId) {
  return !!state.published[pinId];
}

/**
 * Vérifie si un pin a dépassé le max de tentatives
 */
function isMaxRetries(state, pinId, maxRetries = 3) {
  return (state.failed[pinId]?.attempts || 0) >= maxRetries;
}

/**
 * Filtre les pins à publier (non déjà publiés, non en max retries)
 */
function filterPendingPins(pins, state) {
  return pins.filter(pin => {
    if (isPublished(state, pin.pin_id)) {
      console.log(`[Publisher/Tracker] ⏭️  Déjà publié: ${pin.pin_id}`);
      return false;
    }
    if (isMaxRetries(state, pin.pin_id)) {
      console.log(`[Publisher/Tracker] 🚫 Max retries: ${pin.pin_id}`);
      return false;
    }
    return true;
  });
}

/**
 * Résumé des publications de la semaine
 */
function getWeeklySummary(state) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const weekPublished = Object.values(state.published)
    .filter(p => new Date(p.published_at) >= oneWeekAgo);

  const byBoard = weekPublished.reduce((acc, p) => {
    acc[p.board] = (acc[p.board] || 0) + 1;
    return acc;
  }, {});

  const byType = weekPublished.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});

  return {
    published_this_week: weekPublished.length,
    total_published: state.stats.total_published,
    total_failed: state.stats.total_failed,
    by_board: byBoard,
    by_type: byType,
    mock_count: weekPublished.filter(p => p.mock).length,
    latest: weekPublished
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, 5)
      .map(p => ({ keyword: p.keyword, board: p.board, published_at: p.published_at, url: p.pinterest_url })),
  };
}

/**
 * Reset le compteur hebdomadaire (appelé chaque lundi)
 */
function resetWeeklyStats(state) {
  state.stats.this_week = 0;
  return state;
}

module.exports = {
  loadState,
  saveState,
  markPublished,
  markFailed,
  isPublished,
  filterPendingPins,
  getWeeklySummary,
  resetWeeklyStats,
};

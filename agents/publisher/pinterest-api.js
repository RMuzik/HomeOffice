/**
 * AGENT PUBLISHER — pinterest-api.js
 * Client Pinterest API v5 pour la publication de pins.
 *
 * Docs : https://developers.pinterest.com/docs/api/v5/
 * OAuth : https://developers.pinterest.com/docs/getting-started/authentication/
 *
 * Scopes requis : boards:read, pins:write, pins:read
 */

require('dotenv').config();

const PINTEREST_API = 'https://api.pinterest.com/v5';

// ─── Board IDs mapping (à remplir après création des boards) ─────────────────
// Récupère les IDs via : node agents/publisher/index.js --list-boards

const BOARD_MAP = {
  setup_ideas:      process.env.PINTEREST_BOARD_SETUP || 'BOARD_ID_SETUP',
  ergonomic_office: process.env.PINTEREST_BOARD_ERGO  || 'BOARD_ID_ERGO',
  minimalist_desk:  process.env.PINTEREST_BOARD_MINI  || 'BOARD_ID_MINI',
  budget_office:    process.env.PINTEREST_BOARD_BUDGET || 'BOARD_ID_BUDGET',
  gaming_setup:     process.env.PINTEREST_BOARD_GAMING || 'BOARD_ID_GAMING',
};

// ─── Helper fetch ────────────────────────────────────────────────────────────

async function pinterestFetch(endpoint, options = {}) {
  const { default: fetch } = require('node-fetch');
  const token = process.env.PINTEREST_ACCESS_TOKEN;

  if (!token) throw new Error('PINTEREST_ACCESS_TOKEN manquant dans .env');

  const response = await fetch(`${PINTEREST_API}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Rate limit handling
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  if (remaining && parseInt(remaining) < 5) {
    console.warn(`[Pinterest API] ⚠️  Rate limit proche: ${remaining} requêtes restantes`);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new PinterestAPIError(response.status, error.message || response.statusText, endpoint);
  }

  return response.json();
}

class PinterestAPIError extends Error {
  constructor(status, message, endpoint) {
    super(`Pinterest API ${status}: ${message} (${endpoint})`);
    this.status = status;
    this.endpoint = endpoint;
    this.name = 'PinterestAPIError';
  }
}

// ─── Boards ──────────────────────────────────────────────────────────────────

/**
 * Liste les boards de l'utilisateur
 */
async function listBoards() {
  const data = await pinterestFetch('/boards?page_size=25');
  return data.items || [];
}

/**
 * Crée un board Pinterest
 */
async function createBoard(name, description = '') {
  return pinterestFetch('/boards', {
    method: 'POST',
    body: JSON.stringify({ name, description, privacy: 'PUBLIC' }),
  });
}

/**
 * Initialise tous les boards nécessaires s'ils n'existent pas
 * À appeler une seule fois au setup
 */
async function initializeBoards() {
  const boardsConfig = [
    { key: 'setup_ideas',      name: 'Home Office Setup Ideas',           desc: 'Best home office setup ideas and inspiration for remote workers' },
    { key: 'ergonomic_office', name: 'Ergonomic Office Furniture',        desc: 'Ergonomic chairs, standing desks and accessories for a healthy workspace' },
    { key: 'minimalist_desk',  name: 'Minimalist Desk Aesthetic',         desc: 'Minimalist and aesthetic desk setup ideas for a clean workspace' },
    { key: 'budget_office',    name: 'Budget Home Office Ideas',          desc: 'Home office setup ideas under 500€ — affordable and productive' },
    { key: 'gaming_setup',     name: 'Gaming Desk Setup Ideas',           desc: 'Gaming and dual monitor desk setup ideas and accessories' },
  ];

  const existing = await listBoards();
  const existingNames = existing.map(b => b.name.toLowerCase());
  const results = {};

  for (const board of boardsConfig) {
    if (existingNames.includes(board.name.toLowerCase())) {
      const existingBoard = existing.find(b => b.name.toLowerCase() === board.name.toLowerCase());
      console.log(`[Publisher/Boards] ✅ Board existant: "${board.name}" → ${existingBoard.id}`);
      results[board.key] = existingBoard.id;
    } else {
      const newBoard = await createBoard(board.name, board.desc);
      console.log(`[Publisher/Boards] 🆕 Board créé: "${board.name}" → ${newBoard.id}`);
      results[board.key] = newBoard.id;
    }
  }

  return results;
}

// ─── Pins ─────────────────────────────────────────────────────────────────────

/**
 * Publie un pin sur Pinterest
 * @param {object} pin - Pin composé par CREATOR
 * @returns {Promise<object>} Pin créé avec son ID Pinterest
 */
async function publishPin(pin) {
  const boardId = BOARD_MAP[pin.board] || BOARD_MAP.setup_ideas;

  if (boardId.startsWith('BOARD_ID')) {
    throw new Error(`Board ID non configuré pour "${pin.board}". Lance: npm run setup-boards`);
  }

  const payload = {
    board_id: boardId,
    title: pin.title,
    description: pin.description,
    alt_text: pin.alt_text,
    link: pin.destination_url,
    media_source: {
      source_type: 'image_base64',
      content_type: 'image/png',
      data: pin.image_base64,
    },
  };

  const result = await pinterestFetch('/pins', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return result;
}

/**
 * Vérifie le statut d'un pin publié
 */
async function getPinStatus(pinId) {
  return pinterestFetch(`/pins/${pinId}`);
}

/**
 * Liste les pins d'un board
 */
async function getBoardPins(boardId, limit = 25) {
  return pinterestFetch(`/boards/${boardId}/pins?page_size=${limit}`);
}

/**
 * Récupère les analytics d'un pin
 */
async function getPinAnalytics(pinId, startDate, endDate) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK',
  });
  return pinterestFetch(`/pins/${pinId}/analytics?${params}`);
}

// ─── Mode Mock ───────────────────────────────────────────────────────────────

/**
 * Simule la publication Pinterest (sans clé API)
 * Retourne une réponse réaliste
 */
function mockPublishPin(pin) {
  const fakeId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: fakeId,
    board_id: BOARD_MAP[pin.board] || 'mock_board_id',
    title: pin.title,
    link: pin.destination_url,
    created_at: new Date().toISOString(),
    media: { media_type: 'image' },
    _mock: true,
  };
}

module.exports = {
  publishPin,
  mockPublishPin,
  listBoards,
  createBoard,
  initializeBoards,
  getPinStatus,
  getBoardPins,
  getPinAnalytics,
  BOARD_MAP,
  PinterestAPIError,
};

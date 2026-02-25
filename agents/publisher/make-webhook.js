/**
 * AGENT PUBLISHER — make-webhook.js
 * Publie les pins via un webhook Make.com (anciennement Integromat).
 *
 * Make.com possède un module Pinterest natif — pas besoin de créer
 * sa propre app Pinterest developer. Le compte Business Pinterest
 * se connecte directement via OAuth dans Make.
 *
 * Setup :
 *   1. Créer un compte Make.com (gratuit : 1000 ops/mois)
 *   2. Importer config/make-blueprint.json comme nouveau scénario
 *   3. Connecter le compte Pinterest dans Make
 *   4. Copier l'URL webhook → MAKE_WEBHOOK_URL dans .env
 *
 * Usage :
 *   node agents/publisher/make-webhook.js
 *   node agents/publisher/make-webhook.js --dry-run
 *   node agents/publisher/make-webhook.js --limit=5
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { loadState, saveState, markPublished, markFailed, filterPendingPins } = require('./publish-tracker');

const DATA_DIR = path.join(__dirname, '../../data');

// ─── Config ───────────────────────────────────────────────────────────────────

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const SITE_URL         = process.env.SITE_URL || 'https://homeofficesetup.net';

// Délai entre chaque pin (Make.com limite les requêtes entrantes)
const DELAY_BETWEEN_PINS_MS = 3000; // 3 secondes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadPinsReady() {
  const filepath = path.join(DATA_DIR, 'pins-ready.json');
  if (!fs.existsSync(filepath)) {
    throw new Error('pins-ready.json manquant. Lance: npm run creator');
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return data.pins || [];
}

const BOARD_NAMES = {
  setup_ideas:      'Home Office Setup Ideas',
  ergonomic_office: 'Ergonomic Office Furniture',
  minimalist_desk:  'Minimalist Desk Aesthetic',
  budget_office:    'Budget Home Office Ideas',
  gaming_setup:     'Gaming Desk Setup Ideas',
};

// Board IDs numériques récupérés depuis Make.com (connexion Pinterest OAuth)
// Ces IDs sont requis par l'API Pinterest v5 (format numérique obligatoire)
const BOARD_IDS = {
  setup_ideas:      '1132373968747887564',  // Home Office Setup Ideas
  ergonomic_office: '1132373968747887566',  // Ergonomic Office Furniture
  minimalist_desk:  '1132373968747887564',  // → Home Office Setup Ideas (fallback)
  budget_office:    '1132373968747887567',  // Budget Home Office Ideas
  gaming_setup:     '1132373968747887564',  // → Home Office Setup Ideas (fallback)
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Publication via webhook ──────────────────────────────────────────────────

/**
 * Envoie un pin au webhook Make.com
 * Make se charge de le publier sur Pinterest
 */
async function sendToMakeWebhook(pin, dryRun = false) {
  if (!MAKE_WEBHOOK_URL) {
    throw new Error('MAKE_WEBHOOK_URL manquant dans .env\nVoir config/make-blueprint.json pour les instructions de setup.');
  }

  const boardName = BOARD_NAMES[pin.board] || BOARD_NAMES.setup_ideas;
  const boardId   = BOARD_IDS[pin.board]   || BOARD_IDS.setup_ideas;

  // Payload envoyé à Make.com
  const payload = {
    pin_id:          pin.pin_id,
    title:           pin.title,
    description:     pin.description,
    alt_text:        pin.alt_text || pin.title,
    link:            pin.destination_url,
    board_name:      boardName,
    board_id:        boardId,   // ID numérique requis par Pinterest API v5
    keyword:         pin.keyword,
    type:            pin.type,
    // Image via URL publique GitHub CDN (base64 non envoyé pour éviter payload trop large)
    image_base64:    null,
    image_url:       buildPublicImageUrl(pin),
    scheduled_at:    pin.scheduled_at || null,
    source:          'homeofficesetup.net',
  };

  if (dryRun) {
    console.log(`   [DRY RUN] Envoi simulé → ${MAKE_WEBHOOK_URL.slice(0, 50)}...`);
    console.log(`   Payload: ${pin.title} → ${boardName}`);
    return { success: true, _dry_run: true, pin_id: pin.pin_id };
  }

  const { default: fetch } = require('node-fetch');

  const response = await fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Make.com webhook erreur ${response.status}: ${text}`);
  }

  // Make.com renvoie "Accepted" (202) ou un JSON avec l'ID
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { accepted: true, raw: responseText };
  }

  return { ...result, pin_id: pin.pin_id, board: boardName };
}

/**
 * Construit une URL publique vers l'image si le site est déployé
 * Fallback : null (Make utilisera image_base64)
 */
function buildPublicImageUrl(pin) {
  if (!pin.pin_id) return null;
  // Les images sont servies depuis le site si déployées
  // ex: https://homeofficesetup.net/pins/pin_001.png
  return `${SITE_URL}/pins/${pin.pin_id}.png`;
}

// ─── Run Principal ────────────────────────────────────────────────────────────

async function run() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit   = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  📤 PUBLISHER — Make.com Webhook      ║');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN ' : 'LIVE    '} | Make: ${MAKE_WEBHOOK_URL ? '✅ configuré' : '❌ manquant'}   ║`);
  console.log('╚══════════════════════════════════════╝\n');

  if (!MAKE_WEBHOOK_URL && !dryRun) {
    console.error('❌ MAKE_WEBHOOK_URL non défini dans .env');
    console.error('\nInstructions :');
    console.error('  1. Créer un compte Make.com (gratuit)');
    console.error('  2. Importer config/make-blueprint.json');
    console.error('  3. Activer le scénario et copier l\'URL webhook');
    console.error('  4. Ajouter dans .env : MAKE_WEBHOOK_URL=https://hook.eu2.make.com/...');
    console.error('\nEn attendant, utilise : npm run publish:export');
    process.exit(1);
  }

  const allPins = loadPinsReady();
  const state   = loadState();
  let pending   = filterPendingPins(allPins, state);

  if (limit > 0) pending = pending.slice(0, limit);

  if (pending.length === 0) {
    console.log('✅ Aucun pin à publier (tous déjà publiés).\n');
    return;
  }

  console.log(`📋 ${pending.length} pins à envoyer à Make.com\n`);

  const results = { sent: 0, failed: 0 };

  for (let i = 0; i < pending.length; i++) {
    const pin = pending[i];
    console.log(`[${i + 1}/${pending.length}] 📌 "${pin.keyword}" → ${BOARD_NAMES[pin.board] || pin.board}`);

    try {
      const result = await sendToMakeWebhook(pin, dryRun);
      markPublished(state, pin, {
        id: result.pin_id || `make_${Date.now()}`,
        via: 'make_webhook',
        _make: true,
      });
      saveState(state);
      results.sent++;
      console.log(`   ✅ Envoyé à Make.com`);
    } catch (err) {
      markFailed(state, pin, err);
      saveState(state);
      results.failed++;
      console.log(`   ❌ Erreur: ${err.message}`);
    }

    // Délai entre pins (rate limiting Make.com)
    if (i < pending.length - 1 && !dryRun) {
      await sleep(DELAY_BETWEEN_PINS_MS);
    }
  }

  console.log(`
╔══════════════════════════════════════╗
║     ✅ WEBHOOK TERMINÉ               ║
╚══════════════════════════════════════╝
  Envoyés : ${results.sent}  |  Erreurs : ${results.failed}
`);
}

run().catch(err => {
  console.error('\n❌ MAKE WEBHOOK FAILED:', err.message);
  process.exit(1);
});

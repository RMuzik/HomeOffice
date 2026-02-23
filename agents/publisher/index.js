/**
 * AGENT PUBLISHER — index.js
 * Orchestre la publication des pins Pinterest :
 * 1. Lit pins-ready.json (produit par CREATOR)
 * 2. Filtre les pins déjà publiés (via publish-state.json)
 * 3. Respecte le scheduling optimal
 * 4. Publie via Pinterest API v5 (ou mock)
 * 5. Met à jour publish-state.json
 *
 * Usage :
 *   node agents/publisher/index.js              → publie les pins du jour
 *   node agents/publisher/index.js --all        → publie toute la file d'attente
 *   node agents/publisher/index.js --dry-run    → simule sans publier
 *   node agents/publisher/index.js --list-boards → affiche les boards Pinterest
 *   node agents/publisher/index.js --status     → état des publications
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { publishPin, mockPublishPin, listBoards, initializeBoards } = require('./pinterest-api');
const { scheduleWeeklyPins, getPublishDelay, formatSchedule } = require('./scheduler');
const {
  loadState, saveState, markPublished, markFailed,
  filterPendingPins, getWeeklySummary
} = require('./publish-tracker');

const DATA_DIR = path.join(__dirname, '../../data');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDirs() {
  [DATA_DIR, LOGS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function log(level, message, data = null) {
  const entry = { timestamp: new Date().toISOString(), level, agent: 'PUBLISHER', message, ...(data && { data }) };
  console.log(`[${level}] [PUBLISHER] ${message}`);
  const logFile = path.join(LOGS_DIR, `publisher-${new Date().toISOString().split('T')[0]}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

function loadPinsReady() {
  const filepath = path.join(DATA_DIR, 'pins-ready.json');
  if (!fs.existsSync(filepath)) {
    throw new Error(`pins-ready.json manquant. Lance d'abord: npm run creator`);
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

/**
 * Filtre les pins à publier aujourd'hui selon le scheduling
 */
function getPinsForToday(pins) {
  const now = new Date();
  const today = now.getDay(); // 0=Dim, 1=Lun...

  // Mapping day number dans pins-queue vers jour de la semaine
  // Si scheduled_at est présent, on l'utilise directement
  return pins.filter(pin => {
    if (pin.scheduled_at) {
      const pinDate = new Date(pin.scheduled_at);
      return pinDate.toDateString() === now.toDateString();
    }
    // Fallback : publie les pins du jour 1 le lundi, jour 2 le mardi, etc.
    const dayMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };
    return dayMap[pin.day] === today;
  });
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdListBoards() {
  console.log('\n📋 Récupération des boards Pinterest...\n');
  try {
    const boards = await listBoards();
    if (boards.length === 0) {
      console.log('Aucun board trouvé. Crée des boards sur Pinterest d\'abord.');
      return;
    }
    console.log(`${boards.length} board(s) trouvé(s):\n`);
    boards.forEach(b => {
      console.log(`  🗂️  ${b.name}`);
      console.log(`     ID: ${b.id}`);
      console.log(`     Pins: ${b.pin_count || 'N/A'}`);
      console.log('');
    });
    console.log('💡 Copie ces IDs dans ton .env:\n');
    boards.forEach(b => {
      const key = b.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
      console.log(`PINTEREST_BOARD_${key.toUpperCase()}=${b.id}`);
    });
  } catch (err) {
    console.error('❌', err.message);
  }
}

async function cmdStatus() {
  const state = loadState();
  const summary = getWeeklySummary(state);

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     📊 PUBLISHER STATUS               ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log(`Total publié       : ${summary.total_published} pins`);
  console.log(`Cette semaine      : ${summary.published_this_week} pins`);
  console.log(`Échecs             : ${summary.total_failed} pins`);
  console.log(`Mock (test)        : ${summary.mock_count} pins\n`);

  if (Object.keys(summary.by_board).length > 0) {
    console.log('Par board:');
    Object.entries(summary.by_board).forEach(([b, c]) => console.log(`  ${b}: ${c} pins`));
  }

  if (summary.latest.length > 0) {
    console.log('\nDernières publications:');
    summary.latest.forEach(p => {
      console.log(`  • ${p.keyword} — ${formatSchedule(p.published_at)}`);
    });
  }
  console.log('');
}

async function cmdSetupBoards() {
  console.log('\n🗂️  Initialisation des boards Pinterest...\n');
  try {
    const boardIds = await initializeBoards();
    console.log('\n✅ Boards prêts!\n');
    console.log('Ajoute dans ton .env:\n');
    Object.entries(boardIds).forEach(([key, id]) => {
      console.log(`PINTEREST_BOARD_${key.toUpperCase()}=${id}`);
    });
  } catch (err) {
    console.error('❌', err.message);
  }
}

// ─── Publication principale ───────────────────────────────────────────────────

async function publishPins(pins, options = {}) {
  const { dryRun = false, useMock = false } = options;
  const state = loadState();
  const pending = filterPendingPins(pins, state);

  if (pending.length === 0) {
    log('INFO', '✅ Aucun pin à publier (tous déjà publiés ou max retries)');
    return { published: 0, failed: 0, skipped: pins.length };
  }

  log('INFO', `📤 ${pending.length} pins à publier${dryRun ? ' (DRY RUN)' : ''}`);

  const results = { published: 0, failed: 0, skipped: pins.length - pending.length };
  let lastPublishedAt = null;

  for (let i = 0; i < pending.length; i++) {
    const pin = pending[i];
    console.log(`\n[${i + 1}/${pending.length}] 📌 "${pin.keyword}" → ${pin.board}`);
    console.log(`   Type: ${pin.type} | Scheduled: ${pin.scheduled_at ? formatSchedule(pin.scheduled_at) : 'maintenant'}`);

    if (dryRun) {
      console.log(`   [DRY RUN] Serait publié sur Pinterest`);
      results.published++;
      continue;
    }

    // Rate limit delay
    if (lastPublishedAt) {
      const delay = getPublishDelay(lastPublishedAt);
      if (delay > 0) {
        console.log(`   ⏳ Attente ${Math.ceil(delay / 1000)}s (rate limiting)...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    try {
      // Vérifie que l'image est présente
      if (!pin.image_base64 && !useMock) {
        throw new Error('image_base64 manquante — run creator first');
      }

      // Publication
      const pinterestResult = useMock || !process.env.PINTEREST_ACCESS_TOKEN
        ? mockPublishPin(pin)
        : await publishPin(pin);

      markPublished(state, pin, pinterestResult);
      saveState(state);

      lastPublishedAt = new Date().toISOString();
      results.published++;

      const isRealPin = !pinterestResult._mock;
      console.log(`   ${isRealPin ? '✅' : '🔧'} ${isRealPin ? 'Publié' : 'Mock'}: https://pinterest.com/pin/${pinterestResult.id}`);

    } catch (err) {
      markFailed(state, pin, err);
      saveState(state);
      results.failed++;
      log('ERROR', `❌ Échec pin ${pin.pin_id}: ${err.message}`);
      console.log(`   ❌ Erreur: ${err.message}`);
    }
  }

  return results;
}

// ─── Run Principal ───────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);

  // Commands spéciales
  if (args.includes('--list-boards')) return cmdListBoards();
  if (args.includes('--status')) return cmdStatus();
  if (args.includes('--setup-boards')) return cmdSetupBoards();

  const dryRun = args.includes('--dry-run');
  const publishAll = args.includes('--all');
  const useMock = !process.env.PINTEREST_ACCESS_TOKEN;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  📤 AGENT PUBLISHER — HomeOffice Bot  ║');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN' : useMock ? 'MOCK   ' : 'LIVE   '} | ${publishAll ? 'TOUTE LA FILE' : "AUJOURD'HUI"}     ║`);
  console.log('╚══════════════════════════════════════╝\n');

  ensureDirs();
  const startTime = Date.now();

  try {
    // ── 1. Charge les pins ────────────────────────────────────────────────
    log('INFO', '📂 Chargement pins-ready.json...');
    const pinsData = loadPinsReady();
    let pins = pinsData.pins || [];
    log('INFO', `📋 ${pins.length} pins chargés au total`);

    // ── 2. Schedule si pas encore fait ───────────────────────────────────
    const pinsWithSchedule = pins.some(p => p.scheduled_at) ? pins
      : scheduleWeeklyPins(new Date(), pins);

    // ── 3. Filtre selon mode ──────────────────────────────────────────────
    let pinsToPublish;
    if (publishAll) {
      pinsToPublish = pinsWithSchedule;
      log('INFO', `🗂️  Mode --all: ${pinsToPublish.length} pins`);
    } else {
      pinsToPublish = getPinsForToday(pinsWithSchedule);
      log('INFO', `📅 Pins du jour: ${pinsToPublish.length}`);
    }

    if (pinsToPublish.length === 0) {
      console.log('\n⚠️  Aucun pin à publier aujourd\'hui.');
      console.log('   Utilise --all pour publier toute la file.\n');
      return;
    }

    // Affiche le plan
    console.log(`\n📅 Plan de publication:`);
    pinsToPublish.slice(0, 10).forEach((p, i) => {
      const time = p.scheduled_at ? formatSchedule(p.scheduled_at) : `Pin ${i + 1}`;
      console.log(`  ${i + 1}. [${time}] "${p.keyword}" → ${p.board}`);
    });
    if (pinsToPublish.length > 10) {
      console.log(`  ... et ${pinsToPublish.length - 10} autres`);
    }

    // ── 4. Publication ────────────────────────────────────────────────────
    console.log('');
    const results = await publishPins(pinsToPublish, { dryRun, useMock });

    // ── Rapport ───────────────────────────────────────────────────────────
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const state = loadState();
    const summary = getWeeklySummary(state);

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║        ✅ PUBLISHER TERMINÉ           ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`\n📊 Session:`);
    console.log(`   Publiés    : ${results.published} ✅`);
    console.log(`   Échoués    : ${results.failed} ❌`);
    console.log(`   Ignorés    : ${results.skipped} ⏭️`);
    console.log(`\n📈 Total semaine: ${summary.published_this_week} pins`);
    console.log(`⏱️  Durée: ${duration}s`);

    if (!dryRun && !useMock) {
      console.log('\n🎉 Pins live sur Pinterest!\n');
    } else if (useMock) {
      console.log('\n💡 Mode mock — ajoute PINTEREST_ACCESS_TOKEN dans .env pour publier pour de vrai\n');
    }

    log('INFO', `✅ Session terminée: ${results.published} publiés, ${results.failed} échoués`);

  } catch (err) {
    log('ERROR', `❌ Erreur critique: ${err.message}`, { stack: err.stack });
    console.error('\n❌ PUBLISHER FAILED:', err.message);
    process.exit(1);
  }
}

run();

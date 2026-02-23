/**
 * AGENT CREATOR — index.js
 * Orchestre la génération de contenu :
 * 1. Lit pins-queue.json (produit par SCOUT)
 * 2. Génère texte via Claude API (ou mock)
 * 3. Génère images via DALL-E (ou mock SVG)
 * 4. Compose les pins finaux
 * 5. Écrit pins-ready.json pour le PUBLISHER
 *
 * Usage :
 *   node agents/creator/index.js           → batch complète
 *   node agents/creator/index.js --limit 5 → 5 premiers pins seulement
 *   node agents/creator/index.js --day 1   → pins du jour 1 seulement
 *   node agents/creator/index.js --dry-run → sans écrire les fichiers
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { generateBatchContent } = require('./text-generator');
const { generateBatchImages } = require('./image-generator');
const { composeBatch, validatePin, getBatchStats } = require('./pin-composer');

const DATA_DIR = path.join(__dirname, '../../data');
const IMAGES_DIR = path.join(DATA_DIR, 'pins-images');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDirs() {
  [DATA_DIR, IMAGES_DIR, LOGS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function log(level, message, data = null) {
  const entry = { timestamp: new Date().toISOString(), level, agent: 'CREATOR', message, ...(data && { data }) };
  console.log(`[${level}] [CREATOR] ${message}`);
  const logFile = path.join(LOGS_DIR, `creator-${new Date().toISOString().split('T')[0]}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

function loadData(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Fichier manquant: ${filepath} — Lance d'abord: npm run scout`);
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function saveData(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify({
    generated_at: new Date().toISOString(),
    agent: 'CREATOR',
    ...data
  }, null, 2));
  log('INFO', `💾 Saved: ${filename}`);
}

// ─── Run Principal ───────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const dayArg = args.find(a => a.startsWith('--day='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const targetDay = dayArg ? parseInt(dayArg.split('=')[1]) : null;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  🎨 AGENT CREATOR — HomeOffice Bot   ║');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN ' : 'PRODUCTION'} | ${process.env.ANTHROPIC_API_KEY ? 'Claude API ✓' : 'Mock mode'} | ${process.env.OPENAI_API_KEY ? 'DALL-E ✓' : 'SVG mock'} ║`);
  console.log('╚══════════════════════════════════════╝\n');

  ensureDirs();
  const startTime = Date.now();

  try {
    // ── 1. Charge les données SCOUT ───────────────────────────────────────
    log('INFO', '📂 Chargement données SCOUT...');
    const queueData = loadData('pins-queue.json');
    const productsData = loadData('products.json');

    // Flatten tous les pins de la semaine
    let allPins = queueData.queue?.daily_plan?.flatMap(day => day.pins) || [];

    // Filtres optionnels
    if (targetDay) {
      allPins = allPins.filter(p => p.day === targetDay);
      log('INFO', `📅 Filtré sur jour ${targetDay}: ${allPins.length} pins`);
    }
    if (limit) {
      allPins = allPins.slice(0, limit);
      log('INFO', `⚡ Limité à ${limit} pins`);
    }

    log('INFO', `📋 ${allPins.length} pins à générer`);

    // ── 2. Génération texte (Claude API ou mock) ──────────────────────────
    log('INFO', '✍️  Génération contenu texte...');
    const pinsWithText = await generateBatchContent(allPins, productsData.by_category || {});
    log('INFO', `✅ Texte généré pour ${pinsWithText.length} pins`);

    // ── 3. Génération images (DALL-E ou SVG mock) ─────────────────────────
    log('INFO', '🎨 Génération images...');
    const pinsWithImages = await generateBatchImages(pinsWithText, IMAGES_DIR);
    const imagesOk = pinsWithImages.filter(p => p.image_status === 'ok').length;
    log('INFO', `✅ Images générées: ${imagesOk}/${pinsWithImages.length}`);

    // ── 4. Composition finale ─────────────────────────────────────────────
    log('INFO', '📦 Composition pins finaux...');
    const composedPins = composeBatch(pinsWithImages);

    // Validation
    const validPins = composedPins.filter(p => validatePin(p).valid);
    const invalidPins = composedPins.filter(p => !validatePin(p).valid);

    if (invalidPins.length > 0) {
      log('WARN', `⚠️  ${invalidPins.length} pins invalides:`, 
        invalidPins.map(p => ({ id: p.pin_id, errors: validatePin(p).errors }))
      );
    }

    // Stats
    const stats = getBatchStats(composedPins);

    // ── 5. Sauvegarde ─────────────────────────────────────────────────────
    if (!dryRun) {
      saveData('pins-ready.json', {
        week_start: queueData.queue?.week_start,
        pins: composedPins,
        stats
      });
    }

    // ── Rapport final ─────────────────────────────────────────────────────
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║        ✅ CREATOR TERMINÉ             ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`\n📊 Résultats:`);
    console.log(`   Total pins    : ${stats.total}`);
    console.log(`   Prêts         : ${stats.ready} ✅`);
    console.log(`   Image manquante: ${stats.missing_image} ⚠️`);
    console.log(`   Taille images  : ${stats.total_image_size_mb} MB`);
    console.log(`\n📋 Par type:`);
    Object.entries(stats.by_type).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} pins`);
    });
    console.log(`\n🗂️  Par board:`);
    Object.entries(stats.by_board).forEach(([board, count]) => {
      console.log(`   ${board}: ${count} pins`);
    });

    // Preview du premier pin
    if (composedPins.length > 0) {
      const preview = composedPins[0];
      console.log(`\n🔍 Preview pin #1:`);
      console.log(`   Titre: ${preview.title}`);
      console.log(`   Type: ${preview.type} | Board: ${preview.board}`);
      console.log(`   URL: ${preview.destination_url}`);
      console.log(`   Image: ${preview.image_status}`);
    }

    console.log(`\n⏱️  Durée: ${duration}s`);
    if (!dryRun) console.log(`💾 Fichiers sauvegardés dans /data/\n`);

    log('INFO', `✅ Cycle CREATOR terminé en ${duration}s — ${stats.ready} pins prêts`);

  } catch (err) {
    log('ERROR', `❌ Erreur critique: ${err.message}`, { stack: err.stack });
    console.error('\n❌ CREATOR FAILED:', err.message);
    process.exit(1);
  }
}

run();

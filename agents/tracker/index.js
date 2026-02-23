/**
 * AGENT TRACKER — index.js
 * Orchestre la collecte d'analytics et la génération du rapport hebdo :
 * 1. Charge l'état de publication (publish-state.json)
 * 2. Collecte les métriques Pinterest pour chaque pin
 * 3. Génère le rapport Markdown + Discord
 * 4. Sauvegarde dans data/reports/
 * 5. Envoie la notification Discord
 *
 * Usage :
 *   node agents/tracker/index.js           → rapport de la semaine courante
 *   node agents/tracker/index.js --dry-run → sans envoyer Discord
 *   node agents/tracker/index.js --mock    → force mode mock (sans API)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { collectAllMetrics } = require('./analytics');
const {
  generateMarkdownReport,
  generateDiscordReport,
  aggregateByType,
  aggregateByBoard,
  generateRecommendations,
} = require('./report-generator');

const DATA_DIR    = path.join(__dirname, '../../data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const LOGS_DIR    = path.join(DATA_DIR, 'logs');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDirs() {
  [DATA_DIR, REPORTS_DIR, LOGS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function log(level, message, data = null) {
  const entry = { timestamp: new Date().toISOString(), level, agent: 'TRACKER', message, ...(data && { data }) };
  console.log(`[${level}] [TRACKER] ${message}`);
  const logFile = path.join(LOGS_DIR, `tracker-${new Date().toISOString().split('T')[0]}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

function loadJSON(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) throw new Error(`Fichier manquant: ${filepath}`);
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

/**
 * Envoie une notification Discord
 */
async function sendDiscord(message) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.log('[Tracker] ℹ️  Discord: pas de webhook configuré');
    return;
  }

  const { default: fetch } = require('node-fetch');
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message.slice(0, 2000) }),
  });

  if (!response.ok) {
    console.error(`[Tracker] ❌ Discord webhook failed: ${response.statusText}`);
  } else {
    console.log('[Tracker] ✅ Notification Discord envoyée');
  }
}

/**
 * Calcule la plage de dates de la semaine courante (lun-dim)
 */
function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=dim
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday), label: `${fmt(monday)} au ${fmt(sunday)}` };
}

// ─── Run Principal ───────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  📊 AGENT TRACKER — HomeOffice Bot   ║');
  console.log(`║  Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'} | ${process.env.PINTEREST_ACCESS_TOKEN ? 'Pinterest API ✓' : 'Mock mode'} ║`);
  console.log('╚══════════════════════════════════════╝\n');

  ensureDirs();
  const startTime = Date.now();
  const week = getWeekRange();

  try {
    // ── 1. Charge les pins publiés ────────────────────────────────────────
    log('INFO', '📂 Chargement publish-state.json...');
    const state = loadJSON('publish-state.json');
    // published peut être un objet {pin_id: {...}} ou un array
    const publishedRaw = state.published || {};
    const publishedPins = Array.isArray(publishedRaw)
      ? publishedRaw
      : Object.entries(publishedRaw).map(([pin_id, data]) => ({ pin_id, ...data }));

    if (publishedPins.length === 0) {
      log('WARN', '⚠️  Aucun pin publié trouvé. Lance npm run publish d\'abord.');
      console.log('\n⚠️  Aucun pin publié. Lance: npm run publish');
      return;
    }

    log('INFO', `📋 ${publishedPins.length} pins publiés à analyser`);

    // ── 2. Collecte analytics ─────────────────────────────────────────────
    log('INFO', `📊 Collecte métriques (${week.start} → ${week.end})...`);
    const metrics = await collectAllMetrics(publishedPins, week.start, week.end);
    const validMetrics = metrics.filter(m => !m.error);

    const totalRevenue = validMetrics.reduce((s, m) => s + (m.estimated_revenue_eur || 0), 0);
    log('INFO', `✅ Analytics: ${validMetrics.length}/${publishedPins.length} pins — ${totalRevenue.toFixed(2)}€ estimés`);

    // ── 3. Analyse ────────────────────────────────────────────────────────
    log('INFO', '🔍 Analyse des performances...');
    const topPins = [...validMetrics].sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0));
    const byType = aggregateByType(validMetrics);
    const byBoard = aggregateByBoard(validMetrics);
    const recommendations = generateRecommendations(validMetrics, byType, byBoard);

    const weekData = {
      week: week.label,
      metrics: validMetrics,
      publishedCount: publishedPins.length,
      totalRevenue,
      topPins,
      byType,
      byBoard,
      recommendations,
    };

    // ── 4. Génère rapports ────────────────────────────────────────────────
    log('INFO', '📝 Génération rapport...');
    const markdownReport = generateMarkdownReport(weekData);
    const discordMessage = generateDiscordReport(weekData);

    // ── 5. Sauvegarde ─────────────────────────────────────────────────────
    if (!dryRun) {
      // Rapport Markdown
      const reportFile = path.join(REPORTS_DIR, `report-${week.start}.md`);
      fs.writeFileSync(reportFile, markdownReport);
      log('INFO', `💾 Rapport: ${reportFile}`);

      // Données JSON brutes
      const dataFile = path.join(REPORTS_DIR, `metrics-${week.start}.json`);
      fs.writeFileSync(dataFile, JSON.stringify({
        generated_at: new Date().toISOString(),
        week: week.label,
        summary: {
          published: publishedPins.length,
          total_impressions: validMetrics.reduce((s, m) => s + (m.impressions || 0), 0),
          total_saves: validMetrics.reduce((s, m) => s + (m.saves || 0), 0),
          total_outbound_clicks: validMetrics.reduce((s, m) => s + (m.outbound_clicks || 0), 0),
          total_revenue_eur: parseFloat(totalRevenue.toFixed(2)),
        },
        metrics: validMetrics,
        by_type: byType,
        by_board: byBoard,
        recommendations,
      }, null, 2));
      log('INFO', `💾 Données: ${dataFile}`);

      // Envoie Discord
      await sendDiscord(discordMessage);
    }

    // ── Rapport console ───────────────────────────────────────────────────
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalImp = validMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
    const totalSaves = validMetrics.reduce((s, m) => s + (m.saves || 0), 0);
    const totalClicks = validMetrics.reduce((s, m) => s + (m.outbound_clicks || 0), 0);
    const avgScore = Math.round(validMetrics.reduce((s, m) => s + (m.performance_score || 0), 0) / (validMetrics.length || 1));

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║        ✅ TRACKER TERMINÉ             ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`\n📊 Semaine du ${week.label}:`);
    console.log(`   Pins analysés   : ${validMetrics.length}`);
    console.log(`   Impressions      : ${totalImp.toLocaleString()}`);
    console.log(`   Saves (repins)   : ${totalSaves}`);
    console.log(`   Clics outbound   : ${totalClicks}`);
    console.log(`   Revenus estimés  : ${totalRevenue.toFixed(2)}€`);
    console.log(`   Score moyen      : ${avgScore}/100`);

    console.log(`\n🏆 Top 3 pins:`);
    topPins.slice(0, 3).forEach((pin, i) => {
      console.log(`   ${i+1}. "${pin.keyword}" — Score ${pin.performance_score}/100 | ${pin.outbound_clicks} clics | ${pin.estimated_revenue_eur}€`);
    });

    console.log(`\n💡 Recommandations:`);
    recommendations.slice(0, 3).forEach((r, i) => {
      console.log(`   ${i+1}. ${r.title}`);
    });

    console.log(`\n⏱️  Durée: ${duration}s`);
    if (!dryRun) {
      console.log(`💾 Rapport: data/reports/report-${week.start}.md`);
    }
    console.log('');

    log('INFO', `✅ Cycle TRACKER terminé en ${duration}s — ${totalRevenue.toFixed(2)}€ revenus estimés`);

  } catch (err) {
    log('ERROR', `❌ Erreur critique: ${err.message}`, { stack: err.stack });
    console.error('\n❌ TRACKER FAILED:', err.message);
    process.exit(1);
  }
}

run();

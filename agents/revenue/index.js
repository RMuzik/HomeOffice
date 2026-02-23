/**
 * AGENT REVENUE — index.js
 *
 * Croise les données Pinterest Analytics (TRACKER) avec Amazon Associates
 * pour calculer le RPM réel par keyword et alimenter le SCOUT.
 *
 * Pipeline :
 *   1. Charge tous les rapports TRACKER (data/reports/metrics-*.json)
 *   2. Charge les données Amazon Associates (data/associates.json si dispo)
 *   3. Croise par keyword → calcule RPM, taux conversion, commission/clic
 *   4. Écrit data/revenue.json (lu par SCOUT pour prioriser)
 *   5. Génère un rapport Markdown hebdo dans data/reports/
 *   6. Optionnel : alerte Discord si keyword en or détecté
 *
 * Usage :
 *   node agents/revenue/index.js           → rapport complet
 *   node agents/revenue/index.js --dry-run → sans écrire
 *   node agents/revenue/index.js --mock    → force données mock
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { fetchAssociatesData } = require('./associates-scraper');
const { buildRevenueReport, generateMarkdown } = require('./report');

const DATA_DIR    = path.join(__dirname, '../../data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

// ─── Config ───────────────────────────────────────────────────────────────────

// Commission Amazon par catégorie (taux réels Amazon.fr Associates)
const COMMISSION_RATES = {
  'Standing Desks':         0.06,   // 6% — Maison/Bureau
  'Ergonomic Chairs':       0.06,
  'Monitor Arms':           0.06,
  'Desk Accessories':       0.06,
  'Monitors':               0.025,  // 2.5% — Électronique
  'Keyboards':              0.025,
  'Headsets':               0.025,
  'Webcams':                0.025,
  'Lighting':               0.06,
  'Storage':                0.06,
  'default':                0.04,   // 4% fallback
};

// Panier moyen estimé par catégorie (€)
const AVG_ORDER = {
  'Standing Desks':   450,
  'Ergonomic Chairs': 600,
  'Monitors':         350,
  'Monitor Arms':     80,
  'Keyboards':        120,
  'Headsets':         150,
  'Webcams':          100,
  'Lighting':         60,
  'Storage':          50,
  'Desk Accessories': 40,
  'default':          150,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${ts}] [REVENUE] ${msg}`);
}

function ensureDirs() {
  [DATA_DIR, REPORTS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function loadJSON(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

/**
 * Charge tous les rapports metrics-*.json des N dernières semaines
 */
function loadAllMetrics(weeksBack = 12) {
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('metrics-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, weeksBack);

  const allMetrics = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8'));
    const metrics = data.metrics || [];
    allMetrics.push(...metrics.map(m => ({ ...m, _week: data.week, _file: file })));
  }

  log(`${allMetrics.length} métriques chargées (${files.length} semaines)`);
  return allMetrics;
}

// ─── Calculs revenus ──────────────────────────────────────────────────────────

/**
 * Groupe les métriques par keyword et calcule les agrégats
 */
function aggregateByKeyword(metrics) {
  const byKeyword = {};

  for (const m of metrics) {
    const kw = m.keyword || 'unknown';
    if (!byKeyword[kw]) {
      byKeyword[kw] = {
        keyword: kw,
        type: m.type,
        board: m.board,
        weeks: 0,
        impressions: 0,
        saves: 0,
        pin_clicks: 0,
        outbound_clicks: 0,
        estimated_revenue_eur: 0,
        pins: [],
        category: inferCategory(kw),
      };
    }

    const k = byKeyword[kw];
    k.weeks++;
    k.impressions         += m.impressions || 0;
    k.saves               += m.saves || 0;
    k.pin_clicks          += m.pin_clicks || 0;
    k.outbound_clicks     += m.outbound_clicks || 0;
    k.estimated_revenue_eur += m.estimated_revenue_eur || 0;
    k.pins.push(m.pin_id);
  }

  return Object.values(byKeyword);
}

/**
 * Infère la catégorie Amazon depuis le keyword
 */
function inferCategory(keyword) {
  const kw = keyword.toLowerCase();
  if (kw.includes('standing desk') || kw.includes('bureau debout')) return 'Standing Desks';
  if (kw.includes('chair') || kw.includes('chaise') || kw.includes('ergonomic')) return 'Ergonomic Chairs';
  if (kw.includes('monitor') || kw.includes('écran') || kw.includes('screen')) return 'Monitors';
  if (kw.includes('arm') || kw.includes('bras')) return 'Monitor Arms';
  if (kw.includes('keyboard') || kw.includes('clavier')) return 'Keyboards';
  if (kw.includes('headset') || kw.includes('casque') || kw.includes('headphone')) return 'Headsets';
  if (kw.includes('webcam') || kw.includes('camera')) return 'Webcams';
  if (kw.includes('light') || kw.includes('lamp') || kw.includes('lumière')) return 'Lighting';
  if (kw.includes('storage') || kw.includes('rangement')) return 'Storage';
  return 'Desk Accessories';
}

/**
 * Calcule les métriques revenus pour chaque keyword
 */
function calculateRevenue(kwData, associatesData) {
  const commission = COMMISSION_RATES[kwData.category] || COMMISSION_RATES.default;
  const avgOrder   = AVG_ORDER[kwData.category] || AVG_ORDER.default;

  // Taux de conversion Pinterest → site → achat
  const ctrPinterest   = kwData.impressions > 0 ? kwData.outbound_clicks / kwData.impressions : 0;
  const cvrSite        = kwData.outbound_clicks > 0 ? (kwData.estimated_revenue_eur / (avgOrder * commission)) / kwData.outbound_clicks : 0.02;

  // Données réelles Associates si disponibles
  let realRevenue    = null;
  let realClicks     = null;
  let realConversion = null;

  if (associatesData) {
    const assoc = associatesData.byKeyword?.[kwData.keyword];
    if (assoc) {
      realRevenue    = assoc.commissions_eur;
      realClicks     = assoc.clicks;
      realConversion = assoc.conversion_rate;
    }
  }

  const revenue    = realRevenue ?? kwData.estimated_revenue_eur;
  const clicks     = realClicks  ?? kwData.outbound_clicks;

  // RPM = revenus pour 1000 impressions
  const rpm = kwData.impressions > 0 ? (revenue / kwData.impressions) * 1000 : 0;

  // Revenue per click
  const rpc = clicks > 0 ? revenue / clicks : 0;

  // Score potentiel = RPM × volume × tendance
  const potentialScore = rpm * Math.log10(Math.max(kwData.impressions, 10) + 1);

  // Tier de performance
  let tier;
  if (rpm >= 5)       tier = 'S'; // Jackpot
  else if (rpm >= 2)  tier = 'A'; // Excellent
  else if (rpm >= 0.5) tier = 'B'; // Bon
  else if (rpm >= 0.1) tier = 'C'; // Moyen
  else                tier = 'D'; // À abandonner

  return {
    ...kwData,
    commission_rate: commission,
    avg_order_eur: avgOrder,
    ctr_pinterest: Math.round(ctrPinterest * 10000) / 100,    // %
    cvr_site: Math.round((realConversion ?? cvrSite) * 10000) / 100, // %
    revenue_eur: Math.round(revenue * 100) / 100,
    revenue_per_click: Math.round(rpc * 1000) / 1000,
    rpm: Math.round(rpm * 1000) / 1000,
    potential_score: Math.round(potentialScore * 10) / 10,
    tier,
    is_real_data: !!realRevenue,
  };
}

// ─── Recommandations SCOUT ────────────────────────────────────────────────────

/**
 * Génère des recommandations pour le SCOUT basées sur les données REVENUE
 */
function generateScoutReco(keywords) {
  const sorted = [...keywords].sort((a, b) => b.rpm - a.rpm);

  const doubleDown = sorted.filter(k => k.tier === 'S' || k.tier === 'A').slice(0, 5);
  const test       = sorted.filter(k => k.tier === 'B').slice(0, 10);
  const abandon    = sorted.filter(k => k.tier === 'D' && k.weeks >= 4);
  const untested   = sorted.filter(k => k.weeks < 2);

  return {
    double_down: doubleDown.map(k => ({
      keyword: k.keyword,
      action: 'MORE_CONTENT',
      reason: `RPM ${k.rpm}€ tier ${k.tier} — créer 3+ pins/semaine`,
      priority: 'HIGH',
    })),
    test: test.map(k => ({
      keyword: k.keyword,
      action: 'TEST_DIFFERENT_FORMAT',
      reason: `RPM ${k.rpm}€ — essayer format infographic ou comparatif`,
      priority: 'MEDIUM',
    })),
    abandon: abandon.map(k => ({
      keyword: k.keyword,
      action: 'ABANDON',
      reason: `${k.weeks} semaines, RPM ${k.rpm}€ — pas de traction`,
      priority: 'LOW',
    })),
    new_opportunities: generateNewKeywords(doubleDown),
  };
}

/**
 * Suggère de nouveaux keywords basés sur les winners
 */
function generateNewKeywords(winners) {
  const suggestions = [];
  for (const winner of winners) {
    const kw = winner.keyword;
    // Variations longue traîne
    if (kw.includes('standing desk')) {
      suggestions.push(`${kw} under 500`, `${kw} small space`, `${kw} dual monitor`);
    } else if (kw.includes('ergonomic chair')) {
      suggestions.push(`${kw} under 300`, `${kw} back pain`, `best ${kw} 2025`);
    } else if (kw.includes('home office')) {
      suggestions.push(`${kw} ideas`, `${kw} on a budget`, `${kw} setup guide`);
    }
  }
  return [...new Set(suggestions)].slice(0, 10).map(kw => ({
    keyword: kw,
    action: 'CREATE_CONTENT',
    reason: 'Longue traîne basée sur keyword winner',
    priority: 'HIGH',
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const dryRun  = process.argv.includes('--dry-run');
  const mockMode = process.argv.includes('--mock') || !process.env.AMAZON_ACCESS_KEY;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   💶 AGENT REVENUE — Analyse ROI     ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | Mock: ${mockMode}        ║`);
  console.log('╚══════════════════════════════════════╝\n');

  ensureDirs();

  // 1. Charge les métriques TRACKER
  log('Chargement des métriques TRACKER...');
  const metrics = loadAllMetrics(12);

  if (metrics.length === 0) {
    log('⚠️  Aucune métrique trouvée — le TRACKER doit tourner d\'abord');
    process.exit(0);
  }

  // 2. Données Amazon Associates (optionnel)
  log('Chargement des données Amazon Associates...');
  let associatesData = null;
  if (!mockMode) {
    try {
      associatesData = await fetchAssociatesData();
      log(`✅ Associates: ${Object.keys(associatesData.byKeyword || {}).length} keywords avec données réelles`);
    } catch (err) {
      log(`⚠️  Associates indisponible (${err.message}) — utilisation des estimations`);
    }
  } else {
    log('Mode mock — utilisation des estimations Pinterest uniquement');
  }

  // 3. Agrège par keyword
  log('Agrégation par keyword...');
  const byKeyword = aggregateByKeyword(metrics);
  log(`${byKeyword.length} keywords analysés`);

  // 4. Calcule les revenus
  log('Calcul des métriques revenus...');
  const keywords = byKeyword.map(kw => calculateRevenue(kw, associatesData));

  // 5. Tri par RPM
  keywords.sort((a, b) => b.rpm - a.rpm);

  // 6. Recommandations SCOUT
  const scoutReco = generateScoutReco(keywords);

  // 7. Summary global
  const summary = {
    total_keywords: keywords.length,
    total_impressions: keywords.reduce((s, k) => s + k.impressions, 0),
    total_revenue_eur: Math.round(keywords.reduce((s, k) => s + k.revenue_eur, 0) * 100) / 100,
    total_clicks: keywords.reduce((s, k) => s + k.outbound_clicks, 0),
    avg_rpm: Math.round(keywords.reduce((s, k) => s + k.rpm, 0) / keywords.length * 1000) / 1000,
    by_tier: {
      S: keywords.filter(k => k.tier === 'S').length,
      A: keywords.filter(k => k.tier === 'A').length,
      B: keywords.filter(k => k.tier === 'B').length,
      C: keywords.filter(k => k.tier === 'C').length,
      D: keywords.filter(k => k.tier === 'D').length,
    },
    top3: keywords.slice(0, 3).map(k => ({ keyword: k.keyword, rpm: k.rpm, tier: k.tier })),
    is_mock_data: mockMode,
  };

  // 8. Construit revenue.json
  const revenueData = {
    generated_at: new Date().toISOString(),
    agent: 'REVENUE',
    version: '1.0.0',
    period_weeks: [...new Set(metrics.map(m => m._week))].length,
    summary,
    keywords,
    scout_recommendations: scoutReco,
  };

  // 9. Rapport Markdown
  const today = new Date().toISOString().split('T')[0];
  const markdown = generateMarkdown(revenueData);

  // 10. Affichage console
  console.log('\n📊 TOP 10 KEYWORDS PAR RPM :');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Keyword                        │ Impr. │ Clics │ RPM €  │ Tier');
  console.log('─────────────────────────────────────────────────────────────');
  for (const k of keywords.slice(0, 10)) {
    const kw = k.keyword.padEnd(30).slice(0, 30);
    const imp = String(k.impressions).padStart(5);
    const clk = String(k.outbound_clicks).padStart(5);
    const rpm = String(k.rpm).padStart(6);
    console.log(`  ${kw} │ ${imp} │ ${clk} │ ${rpm} │ ${k.tier}`);
  }

  console.log('\n🎯 RECOMMANDATIONS SCOUT :');
  console.log(`  Double down (${scoutReco.double_down.length}): ${scoutReco.double_down.map(r => r.keyword).join(', ') || 'aucun'}`);
  console.log(`  À tester   (${scoutReco.test.length}): ${scoutReco.test.slice(0, 3).map(r => r.keyword).join(', ') || 'aucun'}`);
  console.log(`  À abandonner (${scoutReco.abandon.length}): ${scoutReco.abandon.slice(0, 3).map(r => r.keyword).join(', ') || 'aucun'}`);

  console.log('\n💶 SUMMARY GLOBAL :');
  console.log(`  Revenue total : ${summary.total_revenue_eur}€`);
  console.log(`  RPM moyen     : ${summary.avg_rpm}€`);
  console.log(`  Impressions   : ${summary.total_impressions.toLocaleString('fr-FR')}`);
  console.log(`  Tiers : S=${summary.by_tier.S} A=${summary.by_tier.A} B=${summary.by_tier.B} C=${summary.by_tier.C} D=${summary.by_tier.D}`);

  if (!dryRun) {
    saveJSON('revenue.json', revenueData);
    log('✅ revenue.json sauvegardé');

    fs.writeFileSync(path.join(REPORTS_DIR, `revenue-${today}.md`), markdown);
    log(`✅ Rapport Markdown → data/reports/revenue-${today}.md`);
  } else {
    log('💡 DRY RUN — rien écrit');
  }

  console.log('\n✅ AGENT REVENUE terminé\n');
  return revenueData;
}

run().catch(err => {
  console.error('❌ REVENUE FAILED:', err.message);
  process.exit(1);
});

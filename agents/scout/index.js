/**
 * AGENT SCOUT — index.js
 * Point d'entrée principal. Orchestre les modules et produit les fichiers data/.
 * 
 * Usage :
 *   node agents/scout/index.js              → run complet
 *   node agents/scout/index.js --dry-run    → affiche résultats sans écrire
 *   node agents/scout/index.js --keywords   → keywords seulement
 *   node agents/scout/index.js --products   → produits seulement
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { filterAndRankKeywords, scoreKeyword } = require('./keyword-scorer');
const { analyzeAllKeywords, getTrendData } = require('./pinterest-trends');
const { fetchAllCategories } = require('./amazon-research');

const DATA_DIR = path.join(__dirname, '../../data');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDirs() {
  [DATA_DIR, LOGS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function log(level, agent, message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    agent,
    message,
    ...(data && { data })
  };
  console.log(`[${level}] [${agent}] ${message}`);
  
  // Log dans fichier
  const logFile = path.join(LOGS_DIR, `scout-${new Date().toISOString().split('T')[0]}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

function saveData(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  const output = {
    generated_at: new Date().toISOString(),
    agent: 'SCOUT',
    version: '1.0.0',
    ...data
  };
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  log('INFO', 'SCOUT', `💾 Saved: ${filename} (${JSON.stringify(output).length} bytes)`);
  return filepath;
}

// ─── Étape 1 : Analyse Keywords ─────────────────────────────────────────────

async function runKeywordAnalysis() {
  log('INFO', 'SCOUT', '🔍 Démarrage analyse keywords...');
  
  // 1. Récupère tendances Pinterest pour tous les keywords
  const trendData = analyzeAllKeywords();
  log('INFO', 'SCOUT', `📊 ${trendData.length} keywords analysés`);

  // 2. Score chaque keyword avec le scorer
  const scoredKeywords = filterAndRankKeywords(
    trendData.map(td => ({
      keyword: td.keyword,
      search_volume: td.volume_score * 200, // Estimation volume
      competition_level: td.opportunity_window === 'HIGH' ? 'low' 
                       : td.opportunity_window === 'MEDIUM' ? 'medium' : 'high'
    }))
  );

  // 3. Enrichit avec données de tendance
  const enriched = scoredKeywords.map(sk => ({
    ...sk,
    trend: trendData.find(td => td.keyword === sk.keyword) || {}
  }));

  // 4. Boost REVENUE — remonte les keywords rentables (tier S/A)
  const revenuePath = path.join(DATA_DIR, 'revenue.json');
  let revenueBoost = {};
  if (fs.existsSync(revenuePath)) {
    const revenueData = JSON.parse(fs.readFileSync(revenuePath, 'utf-8'));
    for (const kw of revenueData.keywords || []) {
      revenueBoost[kw.keyword] = { tier: kw.tier, rpm: kw.rpm };
    }
    log('INFO', 'SCOUT', `💶 Revenue boost: ${Object.keys(revenueBoost).length} keywords avec données ROI`);
  }

  // Applique le boost : tier S/A → force HIGH priority, tier D → LOW
  const boosted = enriched.map(k => {
    const rev = revenueBoost[k.keyword];
    if (!rev) return k;
    if (rev.tier === 'S' || rev.tier === 'A') {
      log('INFO', 'SCOUT', `💰 Boost HIGH: "${k.keyword}" (RPM ${rev.rpm}€, tier ${rev.tier})`);
      return { ...k, priority: 'HIGH', revenue_tier: rev.tier, rpm: rev.rpm, _revenue_boosted: true };
    }
    if (rev.tier === 'D' && k.priority !== 'HIGH') {
      return { ...k, priority: 'LOW', revenue_tier: rev.tier, rpm: rev.rpm };
    }
    return { ...k, revenue_tier: rev.tier, rpm: rev.rpm };
  });

  // 5. Sépare par priorité
  const prioritized = {
    high: boosted.filter(k => k.priority === 'HIGH'),
    medium: boosted.filter(k => k.priority === 'MEDIUM'),
    low: boosted.filter(k => k.priority === 'LOW'),
  };

  const boostedCount = boosted.filter(k => k._revenue_boosted).length;
  log('INFO', 'SCOUT', `✅ Keywords HIGH: ${prioritized.high.length} (${boostedCount} boostés revenue), MEDIUM: ${prioritized.medium.length}, LOW: ${prioritized.low.length}`);

  return { keywords: boosted, prioritized, total: boosted.length };
}

// ─── Étape 2 : Recherche Produits ───────────────────────────────────────────

async function runProductResearch() {
  log('INFO', 'SCOUT', '🛒 Démarrage recherche produits Amazon...');
  
  const allProducts = await fetchAllCategories();
  
  // Calcule stats
  const totalProducts = Object.values(allProducts).reduce((sum, cat) => sum + cat.length, 0);
  const topProducts = Object.entries(allProducts).flatMap(([category, products]) =>
    products
      .sort((a, b) => (b.rating * Math.log(b.review_count + 1)) - (a.rating * Math.log(a.review_count + 1)))
      .slice(0, 3)
      .map(p => ({ ...p, category }))
  );

  log('INFO', 'SCOUT', `✅ ${totalProducts} produits trouvés, ${topProducts.length} top produits sélectionnés`);

  return { by_category: allProducts, top_products: topProducts, total: totalProducts };
}

// ─── Étape 3 : Génère Plan de Contenu ───────────────────────────────────────

function generateContentPlan(keywordData, productData) {
  log('INFO', 'SCOUT', '📋 Génération du plan de contenu...');

  const highPriorityKeywords = keywordData.prioritized.high.slice(0, 10);
  const topProducts = productData.top_products.slice(0, 15);

  const weeklyPinPlan = [];

  // 35 pins/semaine : 5/jour
  for (let day = 1; day <= 7; day++) {
    const dayPins = [];
    
    // Distribue les types de pins
    const pinTypes = ['best-of-list', 'setup-showcase', 'product-review', 'how-to', 'budget-guide'];
    
    for (let i = 0; i < 5; i++) {
      const keyword = highPriorityKeywords[(day * 5 + i) % highPriorityKeywords.length];
      const product = topProducts[(day * 5 + i) % topProducts.length];
      const pinType = pinTypes[i % pinTypes.length];

      dayPins.push({
        pin_id: `pin_week${Date.now()}_d${day}_${i + 1}`,
        day,
        slot: i + 1,
        type: pinType,
        keyword: keyword?.keyword || 'home office setup',
        target_product: product ? {
          asin: product.asin,
          title: product.title,
          price: product.price,
          affiliate_url: product.affiliate_url
        } : null,
        board: getBoardForKeyword(keyword?.keyword || ''),
        status: 'pending',
        scheduled_time: getScheduledTime(day, i)
      });
    }
    
    weeklyPinPlan.push({ day, pins: dayPins });
  }

  log('INFO', 'SCOUT', `✅ Plan généré : ${weeklyPinPlan.length * 5} pins sur 7 jours`);

  return {
    week_start: getMonday(),
    total_pins: 35,
    daily_plan: weeklyPinPlan,
    priority_keywords: highPriorityKeywords.map(k => k.keyword),
    featured_products: topProducts.map(p => ({ asin: p.asin, title: p.title, category: p.category }))
  };
}

function getBoardForKeyword(keyword) {
  const kw = keyword.toLowerCase();
  if (kw.includes('ergonomic') || kw.includes('chair') || kw.includes('standing')) return 'ergonomic_office';
  if (kw.includes('minimalist') || kw.includes('aesthetic')) return 'minimalist_desk';
  if (kw.includes('budget') || kw.includes('cheap') || kw.includes('affordable')) return 'budget_office';
  if (kw.includes('gaming')) return 'gaming_setup';
  return 'setup_ideas'; // Default board
}

function getScheduledTime(day, slot) {
  const schedules = {
    1: ['09:00', '12:00', '19:00', '21:00', '22:00'],
    2: ['08:00', '12:00', '20:00', '21:00', '22:00'],
    3: ['09:00', '13:00', '19:00', '21:00', '22:00'],
    4: ['08:00', '12:00', '19:00', '21:00', '22:00'],
    5: ['09:00', '12:00', '18:00', '20:00', '21:00'],
    6: ['10:00', '14:00', '18:00', '20:00', '21:00'],
    7: ['11:00', '15:00', '19:00', '21:00', '22:00'],
  };
  return schedules[day]?.[slot] || '12:00';
}

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// ─── Run Principal ───────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const keywordsOnly = args.includes('--keywords');
  const productsOnly = args.includes('--products');

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🔍 AGENT SCOUT — HomeOffice Bot    ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}                   ║`);
  console.log('╚══════════════════════════════════════╝\n');

  ensureDirs();
  
  const startTime = Date.now();
  log('INFO', 'SCOUT', '🚀 Démarrage du cycle SCOUT...');

  try {
    let keywordResults, productResults, contentPlan;

    // ── Keywords ──
    if (!productsOnly) {
      keywordResults = await runKeywordAnalysis();
      if (!dryRun) {
        saveData('keywords.json', keywordResults);
      }
    }

    // ── Products ──
    if (!keywordsOnly) {
      productResults = await runProductResearch();
      if (!dryRun) {
        saveData('products.json', productResults);
      }
    }

    // ── Content Plan ──
    if (!keywordsOnly && !productsOnly && keywordResults && productResults) {
      contentPlan = generateContentPlan(keywordResults, productResults);
      if (!dryRun) {
        saveData('pins-queue.json', { queue: contentPlan });
      }
    }

    // ─── Rapport final ───────────────────────────────────────────────────────
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n╔══════════════════════════════════════╗');
    console.log('║         ✅ SCOUT TERMINÉ              ║');
    console.log('╚══════════════════════════════════════╝');
    
    if (keywordResults) {
      console.log(`\n📊 Keywords analysés : ${keywordResults.total}`);
      console.log(`   🔥 HIGH priority  : ${keywordResults.prioritized.high.length}`);
      console.log(`   🟡 MEDIUM priority: ${keywordResults.prioritized.medium.length}`);
      console.log('\n🏆 Top 5 keywords :');
      keywordResults.prioritized.high.slice(0, 5).forEach((k, i) => {
        console.log(`   ${i + 1}. "${k.keyword}" — Score: ${k.scores.final}/100`);
      });
    }

    if (productResults) {
      console.log(`\n🛒 Produits trouvés : ${productResults.total}`);
      console.log('\n💎 Top 3 produits (revenu potentiel) :');
      productResults.top_products.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title.substring(0, 50)}...`);
        console.log(`      💰 ${p.revenue_potential?.estimated_monthly_revenue}€/mois estimé`);
      });
    }

    if (contentPlan) {
      console.log(`\n📋 Plan de contenu : ${contentPlan.total_pins} pins programmés`);
    }

    console.log(`\n⏱️  Durée : ${duration}s`);
    if (!dryRun) console.log('💾 Fichiers sauvegardés dans /data/\n');

    log('INFO', 'SCOUT', `✅ Cycle terminé en ${duration}s`);

  } catch (err) {
    log('ERROR', 'SCOUT', `❌ Erreur critique: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}

run();

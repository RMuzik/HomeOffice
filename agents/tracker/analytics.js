/**
 * AGENT TRACKER — analytics.js
 * Collecte les métriques Pinterest pour chaque pin publié.
 * Calcule les revenus affiliés estimés via les clics outbound.
 *
 * Métriques collectées :
 * - IMPRESSION : nombre de fois que le pin a été vu
 * - SAVE       : repins (signal qualité fort)
 * - PIN_CLICK  : clics sur le pin (vers le site)
 * - OUTBOUND_CLICK : clics vers l'URL de destination
 */

require('dotenv').config();
const { getPinAnalytics } = require('../publisher/pinterest-api');

// Taux de conversion estimés (à affiner avec les vraies données)
const CONVERSION_RATES = {
  site_to_affiliate: 0.15,   // 15% des visiteurs cliquent sur un lien affilié
  affiliate_to_sale: 0.02,   // 2% des clics affiliés = achat
};

// Commissions moyennes par board/catégorie
const AVG_COMMISSIONS = {
  setup_ideas:      { avg_order: 250, commission: 0.04 },
  ergonomic_office: { avg_order: 350, commission: 0.04 },
  minimalist_desk:  { avg_order: 200, commission: 0.04 },
  budget_office:    { avg_order: 150, commission: 0.04 },
  gaming_setup:     { avg_order: 400, commission: 0.04 },
};

/**
 * Collecte les analytics pour un pin sur une période
 * @param {object} pin - Pin depuis publish-state.json
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 */
async function collectPinMetrics(pin, startDate, endDate) {
  const useMock = !process.env.PINTEREST_ACCESS_TOKEN || pin.pinterest_id?.startsWith('mock');

  if (useMock) {
    return generateMockMetrics(pin);
  }

  try {
    const data = await getPinAnalytics(pin.pinterest_id, startDate, endDate);

    const metrics = {
      pin_id: pin.pin_id,
      pinterest_id: pin.pinterest_id,
      board: pin.board,
      keyword: pin.keyword,
      type: pin.type,
      period: { start: startDate, end: endDate },
      impressions:      data.all?.daily_metrics?.reduce((s, d) => s + (d.data?.IMPRESSION || 0), 0) || 0,
      saves:            data.all?.daily_metrics?.reduce((s, d) => s + (d.data?.SAVE || 0), 0) || 0,
      pin_clicks:       data.all?.daily_metrics?.reduce((s, d) => s + (d.data?.PIN_CLICK || 0), 0) || 0,
      outbound_clicks:  data.all?.daily_metrics?.reduce((s, d) => s + (d.data?.OUTBOUND_CLICK || 0), 0) || 0,
      source: 'pinterest_api',
    };

    return enrichWithRevenue(metrics, pin.board);
  } catch (err) {
    console.error(`[Tracker] ❌ Analytics pin ${pin.pinterest_id}: ${err.message}`);
    return { pin_id: pin.pin_id, error: err.message, source: 'error' };
  }
}

/**
 * Enrichit les métriques avec des estimations de revenus
 */
function enrichWithRevenue(metrics, board) {
  const config = AVG_COMMISSIONS[board] || AVG_COMMISSIONS.setup_ideas;

  const estimated_site_visitors = metrics.outbound_clicks;
  const estimated_affiliate_clicks = Math.round(estimated_site_visitors * CONVERSION_RATES.site_to_affiliate);
  const estimated_sales = Math.round(estimated_affiliate_clicks * CONVERSION_RATES.affiliate_to_sale);
  const estimated_revenue = parseFloat((estimated_sales * config.avg_order * config.commission).toFixed(2));

  // Taux d'engagement Pinterest
  const engagement_rate = metrics.impressions > 0
    ? parseFloat(((metrics.saves + metrics.pin_clicks) / metrics.impressions * 100).toFixed(2))
    : 0;

  // Score de performance (0-100)
  const performance_score = calculatePerformanceScore(metrics);

  return {
    ...metrics,
    estimated_site_visitors,
    estimated_affiliate_clicks,
    estimated_sales,
    estimated_revenue_eur: estimated_revenue,
    engagement_rate_pct: engagement_rate,
    performance_score,
    revenue_config: config,
  };
}

/**
 * Score de performance relatif (aide à identifier les meilleurs pins)
 * Pondération : outbound_clicks 40% + saves 35% + engagement 25%
 */
function calculatePerformanceScore(metrics) {
  // Baselines attendues par semaine
  const BASELINE = { impressions: 500, saves: 5, pin_clicks: 15, outbound_clicks: 8 };

  const scores = {
    outbound: Math.min(metrics.outbound_clicks / BASELINE.outbound_clicks * 40, 40),
    saves: Math.min(metrics.saves / BASELINE.saves * 35, 35),
    engagement: Math.min(metrics.pin_clicks / BASELINE.pin_clicks * 25, 25),
  };

  return Math.round(scores.outbound + scores.saves + scores.engagement);
}

/**
 * Génère des métriques mock réalistes pour le dev/test
 */
function generateMockMetrics(pin) {
  // Variance selon le type de pin (basée sur benchmarks Pinterest)
  const typeMultipliers = {
    'best-of-list':   { imp: 1.4, saves: 1.5, clicks: 1.3 },
    'setup-showcase': { imp: 1.6, saves: 2.0, clicks: 0.9 },
    'product-review': { imp: 1.0, saves: 0.8, clicks: 1.6 },
    'how-to':         { imp: 1.2, saves: 1.3, clicks: 1.1 },
    'budget-guide':   { imp: 1.1, saves: 1.0, clicks: 1.4 },
  };

  const mult = typeMultipliers[pin.type] || typeMultipliers['setup-showcase'];

  // Simule 7 jours après publication (croissance organique)
  const daysLive = Math.min(7, Math.max(1, Math.round(
    (Date.now() - new Date(pin.published_at || Date.now()).getTime()) / 86400000
  )));

  const base = {
    impressions: Math.round((200 + Math.random() * 800) * mult.imp * daysLive),
    saves: Math.round((2 + Math.random() * 15) * mult.saves * daysLive),
    pin_clicks: Math.round((5 + Math.random() * 30) * mult.clicks * daysLive),
    outbound_clicks: Math.round((2 + Math.random() * 12) * mult.clicks * daysLive),
  };

  const metrics = {
    pin_id: pin.pin_id,
    pinterest_id: pin.pinterest_id || 'mock_' + pin.pin_id,
    board: pin.board,
    keyword: pin.keyword,
    type: pin.type,
    period: { start: '7d', end: 'today' },
    ...base,
    source: 'mock',
  };

  return enrichWithRevenue(metrics, pin.board);
}

/**
 * Collecte les analytics pour tous les pins publiés
 */
async function collectAllMetrics(publishedPins, startDate, endDate) {
  const results = [];

  for (const pin of publishedPins) {
    process.stdout.write(`[Tracker] 📊 ${pin.keyword?.slice(0, 30)}... `);
    const metrics = await collectPinMetrics(pin, startDate, endDate);
    results.push(metrics);
    console.log(`${metrics.performance_score || 0}/100 | ${metrics.outbound_clicks} clics | ${metrics.estimated_revenue_eur}€`);

    // Rate limiting API
    if (process.env.PINTEREST_ACCESS_TOKEN && !pin.pinterest_id?.startsWith('mock')) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

module.exports = { collectPinMetrics, collectAllMetrics, generateMockMetrics, enrichWithRevenue };

/**
 * AGENT SCOUT — keyword-scorer.js
 * Score et filtre les keywords selon leur potentiel affiliate.
 * 
 * Score = (buy_intent * 0.4) + (low_competition * 0.3) + (search_relevance * 0.3)
 */

const settings = require('../../config/settings.json');

// Modificateurs d'intent d'achat par mot-clé
const BUY_INTENT_MODIFIERS = {
  // Fort intent d'achat (+)
  'best': 1.5,
  'top': 1.4,
  'review': 1.5,
  'buy': 1.8,
  'cheap': 1.3,
  'affordable': 1.3,
  'under': 1.4,
  'budget': 1.3,
  'vs': 1.3,
  'comparison': 1.4,
  'worth it': 1.6,
  'recommend': 1.5,
  '2026': 1.2,
  '2025': 1.1,
  // Intent informatif (neutre)
  'how to': 0.7,
  'ideas': 0.8,
  'inspiration': 0.6,
  'aesthetic': 0.7,
  'diy': 0.8,
  // Marques connues (très bon intent)
  'flexispot': 1.7,
  'uplift': 1.7,
  'autonomous': 1.7,
  'secretlab': 1.7,
  'logitech': 1.6,
  'herman miller': 1.9,
  'lg ultrafine': 1.6,
};

// Catégories de produits avec leur potentiel de commission
const CATEGORY_VALUES = {
  'standing desk': { avg_order: 400, commission: 0.03, score: 9 },
  'ergonomic chair': { avg_order: 350, commission: 0.03, score: 9 },
  'monitor': { avg_order: 300, commission: 0.025, score: 8 },
  'desk lamp': { avg_order: 80, commission: 0.04, score: 6 },
  'webcam': { avg_order: 100, commission: 0.04, score: 6 },
  'headset': { avg_order: 200, commission: 0.03, score: 7 },
  'monitor arm': { avg_order: 60, commission: 0.04, score: 5 },
  'desk mat': { avg_order: 40, commission: 0.04, score: 4 },
  'keyboard': { avg_order: 150, commission: 0.03, score: 7 },
  'mouse': { avg_order: 80, commission: 0.03, score: 5 },
};

/**
 * Calcule le score buy intent d'un keyword
 * @param {string} keyword 
 * @returns {number} 0-10
 */
function scoreBuyIntent(keyword) {
  const kw = keyword.toLowerCase();
  let score = 5; // Base

  // Applique les modificateurs
  for (const [term, modifier] of Object.entries(BUY_INTENT_MODIFIERS)) {
    if (kw.includes(term)) {
      score *= modifier;
    }
  }

  // Check catégorie produit
  for (const [cat, data] of Object.entries(CATEGORY_VALUES)) {
    if (kw.includes(cat)) {
      score = score * 0.5 + data.score * 0.5; // Mix avec le score catégorie
    }
  }

  return Math.min(10, Math.max(0, score));
}

/**
 * Calcule le revenu potentiel d'un keyword
 * @param {string} keyword
 * @param {number} estimatedMonthlyClicks
 * @returns {object} { monthly_revenue, yearly_revenue, commission_rate }
 */
function calculateRevenuePotential(keyword, estimatedMonthlyClicks = 100) {
  const kw = keyword.toLowerCase();
  let avgOrder = 100;
  let commissionRate = 0.03;

  for (const [cat, data] of Object.entries(CATEGORY_VALUES)) {
    if (kw.includes(cat)) {
      avgOrder = data.avg_order;
      commissionRate = data.commission;
      break;
    }
  }

  // Hypothèses conservatives : 2% conversion site, 10% conversion affiliate
  const conversionRate = 0.02;
  const affiliateConversionRate = 0.10;

  const monthlyRevenue = estimatedMonthlyClicks * conversionRate * affiliateConversionRate * avgOrder * commissionRate;

  return {
    avg_order_value: avgOrder,
    commission_rate: commissionRate,
    estimated_monthly_revenue: parseFloat(monthlyRevenue.toFixed(2)),
    estimated_yearly_revenue: parseFloat((monthlyRevenue * 12).toFixed(2)),
    assumptions: {
      clicks_per_month: estimatedMonthlyClicks,
      site_conversion: '2%',
      affiliate_conversion: '10%'
    }
  };
}

/**
 * Score final d'un keyword (0-100)
 * @param {object} keywordData 
 * @returns {number}
 */
function scoreKeyword(keywordData) {
  const { keyword, search_volume = 1000, competition_level = 'medium' } = keywordData;

  // Score buy intent (0-10)
  const buyIntentScore = scoreBuyIntent(keyword);

  // Score competition (0-10, inversé : moins de concurrence = meilleur score)
  const competitionScore = {
    'very_low': 10,
    'low': 8,
    'medium': 5,
    'high': 3,
    'very_high': 1
  }[competition_level] || 5;

  // Score volume (0-10)
  const volumeScore = Math.min(10, Math.log10(search_volume + 1) * 3);

  // Score final pondéré
  const finalScore = (
    buyIntentScore * 0.4 +
    competitionScore * 0.3 +
    volumeScore * 0.3
  ) * 10;

  return {
    keyword,
    scores: {
      buy_intent: parseFloat(buyIntentScore.toFixed(1)),
      competition: competitionScore,
      volume: parseFloat(volumeScore.toFixed(1)),
      final: parseFloat(finalScore.toFixed(1))
    },
    revenue_potential: calculateRevenuePotential(keyword, search_volume * 0.01),
    priority: finalScore >= 70 ? 'HIGH' : finalScore >= 50 ? 'MEDIUM' : 'LOW',
    recommended_pin_types: getRecommendedPinTypes(keyword)
  };
}

/**
 * Détermine les types de pins recommandés pour un keyword
 */
function getRecommendedPinTypes(keyword) {
  const kw = keyword.toLowerCase();
  const types = [];

  if (kw.includes('best') || kw.includes('top')) types.push('best-of-list');
  if (kw.includes('review') || kw.includes('vs')) types.push('product-review');
  if (kw.includes('ideas') || kw.includes('inspiration')) types.push('inspiration-collage');
  if (kw.includes('budget') || kw.includes('under') || kw.includes('cheap')) types.push('budget-guide');
  if (kw.includes('how') || kw.includes('guide') || kw.includes('tips')) types.push('how-to');
  if (kw.includes('setup') || kw.includes('aesthetic')) types.push('setup-showcase');

  return types.length > 0 ? types : ['setup-showcase', 'best-of-list'];
}

/**
 * Filtre et trie les keywords selon les critères de settings
 */
function filterAndRankKeywords(keywordsData) {
  return keywordsData
    .map(kd => scoreKeyword(kd))
    .filter(kd => kd.scores.final >= 30) // Seuil minimum
    .sort((a, b) => b.scores.final - a.scores.final);
}

module.exports = { scoreKeyword, filterAndRankKeywords, scoreBuyIntent, calculateRevenuePotential };

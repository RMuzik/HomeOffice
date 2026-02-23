/**
 * AGENT SCOUT — pinterest-trends.js
 * Simule l'analyse des tendances Pinterest pour les keywords.
 * 
 * En production : Pinterest n'a pas d'API Trends publique.
 * Stratégies réelles :
 * 1. Pinterest API v5 — Recherche de pins existants pour estimer volume
 * 2. Scraping Pinterest Trends (trends.pinterest.com)
 * 3. Données Google Trends comme proxy
 * 4. SEMrush / Ahrefs API pour search volume
 */

const settings = require('../../config/settings.json');

// ─── Données de tendance mock (simulant Pinterest Trends 2025-2026) ──────────
const TREND_DATA = {
  'home office setup': { trend: 'rising', volume_score: 9, seasonality: { Q1: 1.2, Q2: 0.9, Q3: 0.8, Q4: 1.1 } },
  'ergonomic desk setup': { trend: 'stable', volume_score: 8, seasonality: { Q1: 1.1, Q2: 1.0, Q3: 0.9, Q4: 1.0 } },
  'cozy home office': { trend: 'rising', volume_score: 8, seasonality: { Q1: 1.3, Q2: 0.8, Q3: 0.7, Q4: 1.2 } },
  'minimalist desk': { trend: 'rising', volume_score: 7, seasonality: { Q1: 1.1, Q2: 1.0, Q3: 1.0, Q4: 0.9 } },
  'standing desk setup': { trend: 'rising', volume_score: 8, seasonality: { Q1: 1.3, Q2: 1.0, Q3: 0.9, Q4: 0.8 } },
  'dual monitor setup': { trend: 'stable', volume_score: 7, seasonality: { Q1: 1.2, Q2: 1.0, Q3: 0.9, Q4: 0.9 } },
  'small space home office': { trend: 'rising', volume_score: 7, seasonality: { Q1: 1.2, Q2: 1.0, Q3: 0.9, Q4: 0.9 } },
  'home office ideas 2026': { trend: 'seasonal_peak', volume_score: 9, seasonality: { Q1: 2.0, Q2: 0.8, Q3: 0.5, Q4: 0.7 } },
  'work from home setup': { trend: 'stable', volume_score: 8, seasonality: { Q1: 1.3, Q2: 0.9, Q3: 0.8, Q4: 1.0 } },
  'gaming desk aesthetic': { trend: 'rising', volume_score: 7, seasonality: { Q1: 1.0, Q2: 1.0, Q3: 1.2, Q4: 1.2 } },
  'home office on a budget': { trend: 'rising', volume_score: 6, seasonality: { Q1: 1.2, Q2: 0.9, Q3: 0.9, Q4: 1.0 } },
  'ergonomic chair home office': { trend: 'rising', volume_score: 8, seasonality: { Q1: 1.3, Q2: 1.0, Q3: 0.9, Q4: 0.8 } },
  'home office lighting': { trend: 'rising', volume_score: 7, seasonality: { Q1: 1.1, Q2: 0.9, Q3: 0.9, Q4: 1.1 } },
  'cable management desk': { trend: 'rising', volume_score: 6, seasonality: { Q1: 1.0, Q2: 1.0, Q3: 1.0, Q4: 1.0 } },
  'home office decor ideas': { trend: 'stable', volume_score: 8, seasonality: { Q1: 1.2, Q2: 1.0, Q3: 0.9, Q4: 0.9 } },
  // Keywords longue traîne à fort potentiel
  'best standing desk under 500': { trend: 'rising', volume_score: 6, seasonality: { Q1: 1.4, Q2: 0.9, Q3: 0.8, Q4: 1.0 } },
  'home office setup ideas for men': { trend: 'rising', volume_score: 5, seasonality: { Q1: 1.0, Q2: 1.0, Q3: 1.1, Q4: 0.9 } },
  'aesthetic desk setup 2026': { trend: 'seasonal_peak', volume_score: 7, seasonality: { Q1: 1.8, Q2: 0.8, Q3: 0.6, Q4: 0.8 } },
  'home office with plants': { trend: 'rising', volume_score: 6, seasonality: { Q1: 1.1, Q2: 1.2, Q3: 0.9, Q4: 0.8 } },
  'flexispot review': { trend: 'stable', volume_score: 6, seasonality: { Q1: 1.1, Q2: 1.0, Q3: 0.9, Q4: 1.0 } },
};

/**
 * Simule le nombre de pins concurrents pour un keyword
 * Bas = opportunité, haut = marché saturé
 */
const COMPETITOR_PIN_COUNTS = {
  'home office setup': 8420,
  'ergonomic desk setup': 1240,
  'cozy home office': 3890,
  'minimalist desk': 4230,
  'standing desk setup': 980,
  'dual monitor setup': 760,
  'small space home office': 1870,
  'home office ideas 2026': 340,
  'work from home setup': 2100,
  'gaming desk aesthetic': 5600,
  'home office on a budget': 420,
  'ergonomic chair home office': 890,
  'home office lighting': 1340,
  'cable management desk': 280,
  'home office decor ideas': 3200,
  'best standing desk under 500': 120,
  'home office setup ideas for men': 340,
  'aesthetic desk setup 2026': 180,
  'home office with plants': 2100,
  'flexispot review': 95,
};

/**
 * Récupère les données de tendance pour un keyword
 * @param {string} keyword
 * @returns {object}
 */
function getTrendData(keyword) {
  const kw = keyword.toLowerCase();
  
  // Recherche exacte ou partielle
  let data = TREND_DATA[kw];
  if (!data) {
    const matchKey = Object.keys(TREND_DATA).find(k => kw.includes(k) || k.includes(kw));
    data = matchKey ? TREND_DATA[matchKey] : { trend: 'unknown', volume_score: 5, seasonality: { Q1: 1, Q2: 1, Q3: 1, Q4: 1 } };
  }

  const competitorPins = COMPETITOR_PIN_COUNTS[kw] || 
    Object.values(COMPETITOR_PIN_COUNTS).reduce((a, b) => a + b) / Object.keys(COMPETITOR_PIN_COUNTS).length;

  // Score de faible saturation (inversé : peu de pins = bon score)
  const saturationScore = Math.max(0, 10 - Math.log10(competitorPins + 1) * 2.5);

  return {
    keyword,
    trend_direction: data.trend,
    volume_score: data.volume_score,
    competitor_pins: Math.round(competitorPins),
    saturation_score: parseFloat(saturationScore.toFixed(1)),
    current_quarter_multiplier: getCurrentQuarterMultiplier(data.seasonality),
    opportunity_window: competitorPins < 500 ? 'HIGH' : competitorPins < 2000 ? 'MEDIUM' : 'LOW',
    pinterest_tags: generatePinterestTags(keyword)
  };
}

/**
 * Retourne le multiplicateur pour le trimestre actuel
 */
function getCurrentQuarterMultiplier(seasonality) {
  const month = new Date().getMonth() + 1;
  const quarter = `Q${Math.ceil(month / 3)}`;
  return seasonality[quarter] || 1;
}

/**
 * Génère des hashtags Pinterest optimisés pour un keyword
 */
function generatePinterestTags(keyword) {
  const base = keyword.toLowerCase().split(' ');
  const tags = new Set();

  // Tags directs
  tags.add(`#${base.join('')}`);
  tags.add(`#${base.join('_')}`);
  
  // Tags thématiques
  tags.add('#homeoffice');
  tags.add('#workfromhome');
  tags.add('#homeofficesetup');
  tags.add('#desksetup');
  tags.add('#productivity');
  tags.add('#remotework');
  tags.add('#officedecor');
  tags.add('#minimalistoffice');

  return [...tags].slice(0, 10);
}

/**
 * Analyse tous les seed keywords et retourne un rapport trié
 * @returns {Array}
 */
function analyzeAllKeywords() {
  const allKeywords = [
    ...settings.seed_keywords,
    // Keywords longue traîne générés automatiquement
    ...generateLongTailKeywords()
  ];

  return allKeywords
    .map(kw => getTrendData(kw))
    .sort((a, b) => {
      // Priorité : opportunité window + volume score
      const scoreA = (a.opportunity_window === 'HIGH' ? 3 : a.opportunity_window === 'MEDIUM' ? 2 : 1) * a.volume_score;
      const scoreB = (b.opportunity_window === 'HIGH' ? 3 : b.opportunity_window === 'MEDIUM' ? 2 : 1) * b.volume_score;
      return scoreB - scoreA;
    });
}

/**
 * Génère des keywords longue traîne depuis les seed keywords
 */
function generateLongTailKeywords() {
  const prefixes = ['best', 'top 10', 'affordable', 'minimalist', 'aesthetic', 'cozy'];
  const suffixes = ['2026', 'ideas', 'inspiration', 'on a budget', 'for small spaces'];
  const bases = ['home office setup', 'desk setup', 'work from home'];
  
  const longTail = [];
  for (const base of bases) {
    for (const prefix of prefixes.slice(0, 2)) {
      longTail.push(`${prefix} ${base}`);
    }
    for (const suffix of suffixes.slice(0, 2)) {
      longTail.push(`${base} ${suffix}`);
    }
  }
  
  return [...new Set(longTail)];
}

module.exports = { getTrendData, analyzeAllKeywords, generatePinterestTags };

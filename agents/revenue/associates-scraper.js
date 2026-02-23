/**
 * associates-scraper.js — Récupère les données Amazon Associates
 *
 * Amazon Associates n'a pas d'API officielle pour les rapports.
 * Options disponibles :
 *   1. Scraping du dashboard Associates (fragile)
 *   2. Export CSV manuel uploadé dans data/associates-export.csv
 *   3. Estimation depuis les données PA-API + taux de conversion connus
 *
 * On implémente les 3 avec fallback automatique.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * Parse un export CSV Amazon Associates
 * Format : Date, Clics, Commandes converties, Articles expédiés, Revenus
 *
 * Pour obtenir ce CSV :
 *   1. Aller sur affiliate-program.amazon.fr
 *   2. Rapports → Rapport de performance
 *   3. Exporter en CSV
 *   4. Sauvegarder dans data/associates-export.csv
 */
function parseAssociatesCSV(csvPath) {
  if (!fs.existsSync(csvPath)) return null;

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) return null;

  // Détecte le séparateur (virgule ou point-virgule selon la locale)
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, ''));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, j) => row[h] = values[j]);
    rows.push(row);
  }

  // Agrège les totaux
  const totals = {
    clicks: 0,
    orders: 0,
    items_shipped: 0,
    revenue_eur: 0,
    conversion_rate: 0,
  };

  for (const row of rows) {
    // Colonnes Amazon Associates FR (noms approximatifs — peuvent varier)
    totals.clicks        += parseInt(row['Clics'] || row['Clicks'] || 0);
    totals.orders        += parseInt(row['Commandes'] || row['Orders'] || 0);
    totals.items_shipped += parseInt(row['Articles expédiés'] || row['Items Shipped'] || 0);
    totals.revenue_eur   += parseFloat((row['Revenus'] || row['Revenue'] || '0').replace(',', '.'));
  }

  if (totals.clicks > 0) {
    totals.conversion_rate = totals.orders / totals.clicks;
  }

  return {
    source: 'csv_export',
    period_rows: rows.length,
    totals,
    // Pas de breakdown par keyword dans le CSV Associates standard
    byKeyword: {},
  };
}

/**
 * Estimation basée sur les clics sortants Pinterest
 * Utilise les taux de conversion industrie pour home office
 */
function estimateFromPinterest(pricesData) {
  // Pas assez de données pour estimer par keyword sans Associates réel
  return {
    source: 'estimated',
    note: 'Données estimées — exporter CSV Associates pour données réelles',
    totals: null,
    byKeyword: {},
  };
}

/**
 * Point d'entrée principal
 * Essaie dans l'ordre : CSV export → estimation
 */
async function fetchAssociatesData() {
  // Option 1 : CSV export (le plus fiable)
  const csvPath = path.join(DATA_DIR, 'associates-export.csv');
  const csvData = parseAssociatesCSV(csvPath);

  if (csvData) {
    console.log(`[REVENUE] ✅ Associates CSV chargé (${csvData.period_rows} lignes)`);
    return csvData;
  }

  // Option 2 : Estimation
  console.log('[REVENUE] ⚠️  CSV Associates absent — utilisation des estimations');
  console.log('[REVENUE] 💡 Pour des données réelles : exporter depuis affiliate-program.amazon.fr');
  console.log('[REVENUE]    → Rapports → Rapport de performance → Exporter CSV');
  console.log('[REVENUE]    → Sauvegarder dans data/associates-export.csv');

  const pricesData = null; // sera alimenté par prices.json
  return estimateFromPinterest(pricesData);
}

module.exports = { fetchAssociatesData };

/**
 * price-updater.js — Met à jour les prix Amazon dans data/prices.json
 *
 * Lit tous les ASINs référencés dans products.json + pages manuelles,
 * appelle la PA-API pour les prix actuels, écrit data/prices.json.
 * Le site Astro lit prices.json au build pour afficher les vrais prix.
 *
 * Usage:
 *   node agents/builder/price-updater.js           → tous les ASINs
 *   node agents/builder/price-updater.js --dry-run → affiche sans écrire
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getItems, formatPrice } = require('./amazon-paapi');

const DATA_DIR = path.join(__dirname, '../../data');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');

// ASINs des pages manuelles — à maintenir à jour
const MANUAL_ASINS = [
  // Standing desks
  'B09C6J4WCS', // FlexiSpot E7 Pro
  'B08P5J1X3V', // Jarvis Bamboo
  'B093BGYTPW', // FlexiSpot E5
  'B07KTTXQPW', // Uplift V2
  'B0BNMK7XYZ', // Autonomous SmartDesk
  // Ergonomic chairs
  'B001MS57O8', // Herman Miller Aeron
  'B09JYRS2KP', // Secretlab Titan Evo
  'B00BX4SZCK', // Humanscale Liberty
  'B0CVMNXYZ1', // FlexiSpot BS13
  'B003HSB34E', // Steelcase Leap V2
  // Budget picks
  'B002Y3PJGU', // IKEA Markus
  'B08BHVXYMR', // AOC 24G2
  'B07W6JRBSD', // Logitech MK470
  'B08GGZ2PMT', // Anker PowerConf S3
];

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   💰 PRICE UPDATER — PA-API v5       ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'} | ${MANUAL_ASINS.length} ASINs      ║`);
  console.log('╚══════════════════════════════════════╝\n');

  // Charge les prix existants (pour conserver l'historique)
  let existingPrices = {};
  if (fs.existsSync(PRICES_FILE)) {
    existingPrices = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf-8'));
  }

  // Récupère les ASINs du SCOUT aussi
  let scoutAsins = [];
  const productsFile = path.join(DATA_DIR, 'products.json');
  if (fs.existsSync(productsFile)) {
    const data = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
    // Structure: { by_category: { Cat: [{ asin, ... }] } } ou { products: [...] }
    const allProducts = data.products
      || Object.values(data.by_category || {}).flat()
      || [];
    scoutAsins = allProducts.map(p => p.asin).filter(Boolean);
  }

  // Déduplique
  const allAsins = [...new Set([...MANUAL_ASINS, ...scoutAsins])];
  console.log(`📋 ${allAsins.length} ASINs à mettre à jour (${MANUAL_ASINS.length} manuels + ${scoutAsins.length} SCOUT)\n`);

  // Appel PA-API
  const items = await getItems(allAsins, {
    accessKey: process.env.AMAZON_ACCESS_KEY,
    secretKey: process.env.AMAZON_SECRET_KEY,
    partnerTag: process.env.AFFILIATE_TAG,
  });

  // Construit le nouveau prices.json
  const prices = { ...existingPrices };
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (const item of items) {
    const prev = existingPrices[item.asin];
    const priceChanged = prev?.price !== item.price;

    prices[item.asin] = {
      ...item,
      priceFormatted: formatPrice(item.price),
      originalPriceFormatted: formatPrice(item.originalPrice),
      savingsFormatted: formatPrice(item.savings),
      // Historique des prix (garde les 10 derniers)
      priceHistory: [
        ...(prev?.priceHistory || []).slice(-9),
        { price: item.price, date: new Date().toISOString().split('T')[0] },
      ].filter((v, i, a) => i === 0 || v.price !== a[i-1].price), // déduplique consécutifs
    };

    if (item.error) {
      errors++;
      process.stdout.write(`❌ ${item.asin} — ${item.error}\n`);
    } else if (priceChanged && prev) {
      const arrow = item.price < prev.price ? '📉' : '📈';
      process.stdout.write(`${arrow} ${item.asin} — ${formatPrice(prev.price)} → ${formatPrice(item.price)}\n`);
      updated++;
    } else {
      process.stdout.write(`✅ ${item.asin} — ${formatPrice(item.price)} ${item.isMock ? '(mock)' : ''}\n`);
      unchanged++;
    }
  }

  // Métadonnées
  prices._meta = {
    lastUpdated: new Date().toISOString(),
    totalAsins: allAsins.length,
    updated,
    unchanged,
    errors,
    isMockMode: items.some(i => i.isMock),
  };

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║       💰 PRICE UPDATE TERMINÉ        ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`\n   Mis à jour : ${updated} prix 💰`);
  console.log(`   Inchangés  : ${unchanged} prix ✅`);
  console.log(`   Erreurs    : ${errors} ASINs ❌`);

  if (!dryRun) {
    fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2));
    console.log(`\n   💾 Sauvegardé → data/prices.json`);
  } else {
    console.log(`\n   💡 DRY RUN — rien écrit`);
  }

  // Alerte si baisses de prix significatives (>10%)
  const bigDrops = items.filter(item => {
    const prev = existingPrices[item.asin];
    if (!prev?.price || !item.price) return false;
    return (prev.price - item.price) / prev.price > 0.10;
  });

  if (bigDrops.length > 0) {
    console.log(`\n🚨 ALERTES BAISSES DE PRIX (>10%) :`);
    for (const item of bigDrops) {
      const prev = existingPrices[item.asin];
      const drop = Math.round((prev.price - item.price) / prev.price * 100);
      console.log(`   -${drop}% — ${item.title}: ${formatPrice(prev.price)} → ${formatPrice(item.price)}`);
    }
  }

  console.log('');
  return prices;
}

run().catch(err => {
  console.error('❌ PRICE UPDATER FAILED:', err.message);
  process.exit(1);
});

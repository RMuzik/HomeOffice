/**
 * AGENT SCOUT — amazon-research.js
 * Simule la recherche de produits Amazon (structure prête pour Amazon PA API).
 * 
 * En production : remplacer MOCK_MODE par les vrais appels Amazon Product Advertising API v5.
 * Docs : https://webservices.amazon.com/paapi5/documentation/
 */

const settings = require('../../config/settings.json');

// ─── Mode Mock (pour développement sans clés API) ───────────────────────────
// Données réalistes basées sur des vrais produits Amazon
const MOCK_PRODUCTS = {
  'standing desk home office': [
    {
      asin: 'B09TD87W1J',
      title: 'Bureau Assis Debout Électrique 160x80cm',
      brand: 'Desktronic',
      price: 464.00,
      rating: 4.8,
      review_count: 826,
      category: 'Standing Desks',
      image_url: `https://www.amazon.fr/dp/B09TD87W1J`,
      affiliate_url: `https://www.amazon.fr/dp/B09TD87W1J?tag=${settings.amazon_tag}`,
      features: ['Moteur double ultra-stable', 'Mémoire 4 positions', 'Anti-collision', 'Livraison rapide'],
      pros: ['Très stable', 'Silencieux', 'Livraison Amazon rapide'],
      cons: ['Plateau non inclus', 'Montage ~60 min']
    },
    {
      asin: 'B0BHTQRLXS',
      title: 'Bureau Assis Debout Électrique 200x80cm',
      brand: 'Desktronic',
      price: 584.00,
      rating: 4.7,
      review_count: 412,
      category: 'Standing Desks',
      image_url: `https://www.amazon.fr/dp/B0BHTQRLXS`,
      affiliate_url: `https://www.amazon.fr/dp/B0BHTQRLXS?tag=${settings.amazon_tag}`,
      features: ['Grand plateau 200x80cm', 'Moteur double', 'Mémoire 4 positions'],
      pros: ['Grande surface', 'Stable', 'Idéal dual monitor'],
      cons: ['Plateau non inclus', 'Encombrant']
    },
    {
      asin: 'B087JF3B5S',
      title: 'T2 Pro Plus Bureau Assis Debout 140x70cm',
      brand: 'MAIDeSITe',
      price: 339.00,
      rating: 4.6,
      review_count: 1200,
      category: 'Standing Desks',
      image_url: `https://www.amazon.fr/dp/B087JF3B5S`,
      affiliate_url: `https://www.amazon.fr/dp/B087JF3B5S?tag=${settings.amazon_tag}`,
      features: ['Moteur double', 'Cadre acier renforcé', 'Mémoire 4 positions', 'Anti-collision'],
      pros: ['Excellent rapport qualité/prix', 'Montage simple', 'Livraison Amazon'],
      cons: ['Plateau non inclus', 'Notice en anglais']
    }
  ],
  'ergonomic chair home office': [
    {
      asin: 'B0BGZB6VZM',
      title: 'Chaise Ergonomique Maille Réglable',
      brand: 'CleverSeat',
      price: 249.00,
      rating: 4.6,
      review_count: 1250,
      category: 'Ergonomic Chairs',
      image_url: `https://www.amazon.fr/dp/B0BGZB6VZM`,
      affiliate_url: `https://www.amazon.fr/dp/B0BGZB6VZM?tag=${settings.amazon_tag}`,
      features: ['Lombaire réglable', 'Dossier maille respirant', 'Appui-tête inclus', 'Accoudoirs 3D'],
      pros: ['Lombaire réglable', 'Mesh respirant', 'Accoudoirs 3D'],
      cons: ['Marque peu connue', 'Montage 45 min']
    },
    {
      asin: 'B0GFMQMJ47',
      title: 'Chaise Bureau Ergonomique 150kg',
      brand: 'Alpha Chair',
      price: 159.00,
      rating: 4.4,
      review_count: 890,
      category: 'Ergonomic Chairs',
      image_url: `https://www.amazon.fr/dp/B0GFMQMJ47`,
      affiliate_url: `https://www.amazon.fr/dp/B0GFMQMJ47?tag=${settings.amazon_tag}`,
      features: ['Lombaire ajustable', 'Capacité 150kg', 'Hauteur réglable'],
      pros: ['Prix accessible', 'Lombaire ajustable', 'Capacité 150kg'],
      cons: ['Moins de réglages premium', 'Durabilité à confirmer']
    },
    {
      asin: 'B0D9GWQF84',
      title: 'Chaise Bureau Ergonomique Similicuir',
      brand: 'Yaheetech',
      price: 79.00,
      rating: 4.1,
      review_count: 3420,
      category: 'Ergonomic Chairs',
      image_url: `https://www.amazon.fr/dp/B0D9GWQF84`,
      affiliate_url: `https://www.amazon.fr/dp/B0D9GWQF84?tag=${settings.amazon_tag}`,
      features: ['Hauteur réglable', 'Accoudoirs réglables', 'Assise rembourrée', 'Pivotante 360°'],
      pros: ['Prix imbattable', 'Marque reconnue Amazon', 'Hauteur réglable'],
      cons: ['Support lombaire limité', 'Pas pour usage intensif 8h/jour']
    }
  ],
  'monitor home office 27 inch': [
    {
      asin: 'B0DTQ9SKYF',
      title: 'LG 27UP850K-W 27" 4K IPS USB-C 96W',
      brand: 'LG',
      price: 273.00,
      rating: 4.6,
      review_count: 1850,
      category: 'Monitors',
      image_url: `https://www.amazon.fr/dp/B0DTQ9SKYF`,
      affiliate_url: `https://www.amazon.fr/dp/B0DTQ9SKYF?tag=${settings.amazon_tag}`,
      features: ['4K UHD IPS', 'USB-C 96W', 'HDR400', 'DCI-P3 95%', 'Pied réglable hauteur'],
      pros: ['USB-C 96W charge MacBook', '4K IPS', 'Pied réglable hauteur'],
      cons: ['Pas de 144Hz', 'Haut-parleurs basiques']
    },
    {
      asin: 'B096K7YHPW',
      title: 'Dell P2722H 27" FHD IPS Hub USB',
      brand: 'Dell',
      price: 257.00,
      rating: 4.7,
      review_count: 3240,
      category: 'Monitors',
      image_url: `https://www.amazon.fr/dp/B096K7YHPW`,
      affiliate_url: `https://www.amazon.fr/dp/B096K7YHPW?tag=${settings.amazon_tag}`,
      features: ['Full HD IPS', 'Hub USB intégré', 'Garantie 3 ans Dell'],
      pros: ['Garantie 3 ans Dell', 'Hub USB intégré', 'Dalle IPS fidèle'],
      cons: ['Full HD seulement', 'Pas de USB-C']
    },
    {
      asin: 'B0DK51HDGB',
      title: 'Lenovo L27i-4B 27" FHD IPS Eye-Care',
      brand: 'Lenovo',
      price: 109.00,
      rating: 4.4,
      review_count: 520,
      category: 'Monitors',
      image_url: `https://www.amazon.fr/dp/B0DK51HDGB`,
      affiliate_url: `https://www.amazon.fr/dp/B0DK51HDGB?tag=${settings.amazon_tag}`,
      features: ['Full HD IPS 27"', 'Eye-Care certifié', 'Bords ultra-fins'],
      pros: ['Prix imbattable pour du 27"', 'Dalle IPS fidèle', 'Marque de confiance'],
      cons: ['60Hz uniquement', 'Pied peu réglable']
    }
  ],
  'desk lamp home office LED': [
    {
      asin: 'B07L755X9G',
      title: 'Elgato Key Light Panneau LED 80W',
      brand: 'Elgato',
      price: 199.00,
      rating: 4.7,
      review_count: 5621,
      category: 'Desk Lamps',
      image_url: `https://www.amazon.fr/dp/B07L755X9G`,
      affiliate_url: `https://www.amazon.fr/dp/B07L755X9G?tag=${settings.amazon_tag}`,
      features: ['80W équivalent', 'CCT 2900-7000K', 'Contrôle app Wi-Fi', 'Anti-éblouissement'],
      pros: ['Parfait pour visioconférences', 'Contrôle app', 'Lumière douce professionnelle'],
      cons: ['Prix premium', 'Fixation bureau obligatoire']
    }
  ],
  'webcam home office 1080p': [
    {
      asin: 'B07K986YLL',
      title: 'Logitech C920s HD Pro Webcam 1080p',
      brand: 'Logitech',
      price: 89.99,
      rating: 4.5,
      review_count: 28400,
      category: 'Webcams',
      image_url: `https://www.amazon.fr/dp/B07K986YLL`,
      affiliate_url: `https://www.amazon.fr/dp/B07K986YLL?tag=${settings.amazon_tag}`,
      features: ['1080p 30fps', 'Correction automatique lumière', 'Micro stéréo', 'Obturateur vie privée'],
      pros: ['Référence du marché', 'Compatible Teams/Zoom/Meet', 'Très bonne qualité image'],
      cons: ['30fps uniquement', 'Pas de 4K']
    }
  ],
  'headset home office noise cancelling': [
    {
      asin: 'B004ELA7TA',
      title: 'Jabra Speak 410 Speakerphone USB',
      brand: 'Jabra',
      price: 103.00,
      rating: 4.5,
      review_count: 6200,
      category: 'Headsets',
      image_url: `https://www.amazon.fr/dp/B004ELA7TA`,
      affiliate_url: `https://www.amazon.fr/dp/B004ELA7TA?tag=${settings.amazon_tag}`,
      features: ['Microphone 360°', 'Plug & play USB', 'Compatible Zoom/Teams/Meet', 'Certifié Microsoft'],
      pros: ['Plug & play USB', 'Micro 360° certifié', 'Compatible tous outils visio'],
      cons: ['Pas de Bluetooth', 'Moins bon qu\'un micro dédié solo']
    }
  ],
  'desk organizer home office': [
    {
      asin: 'B0FHHV6YR5',
      title: 'Logitech MX Master 3S Souris Sans Fil',
      brand: 'Logitech',
      price: 93.00,
      rating: 4.8,
      review_count: 9120,
      category: 'Desk Accessories',
      image_url: `https://www.amazon.fr/dp/B0FHHV6YR5`,
      affiliate_url: `https://www.amazon.fr/dp/B0FHHV6YR5?tag=${settings.amazon_tag}`,
      features: ['Scroll MagSpeed électromagnétique', 'Multi-device 3 appareils', 'Silencieuse', 'USB-C charge'],
      pros: ['Scroll MagSpeed', 'Multi-device 3', 'Silencieuse'],
      cons: ['Prix élevé', 'Conçue pour grande main']
    },
    {
      asin: 'B0CFR34FDB',
      title: 'Logitech Pebble 2 Combo Clavier + Souris',
      brand: 'Logitech',
      price: 42.00,
      rating: 4.5,
      review_count: 1850,
      category: 'Desk Accessories',
      image_url: `https://www.amazon.fr/dp/B0CFR34FDB`,
      affiliate_url: `https://www.amazon.fr/dp/B0CFR34FDB?tag=${settings.amazon_tag}`,
      features: ['Ultra-silencieux -90%', 'Bluetooth + dongle USB', 'Autonomie 36 mois clavier'],
      pros: ['Ultra-silencieux', 'Autonomie record', 'Bluetooth + dongle USB'],
      cons: ['Pas d\'éclairage', 'Format compact (sans pavé num)']
    }
  ],
  'monitor arm dual home office': [
    {
      asin: 'B00BVP7502',
      title: 'Ergotron LX Bras Écran Articulé',
      brand: 'Ergotron',
      price: 109.00,
      rating: 4.7,
      review_count: 15200,
      category: 'Monitor Arms',
      image_url: `https://www.amazon.fr/dp/B00BVP7502`,
      affiliate_url: `https://www.amazon.fr/dp/B00BVP7502?tag=${settings.amazon_tag}`,
      features: ['Rotation 360°', 'Inclinaison ±70°', 'Pivot portrait/paysage', 'Compatible VESA 75/100mm'],
      pros: ['Référence bras moniteur', 'Très fluide', 'Robuste'],
      cons: ['Fixation pince ou perçage', 'Un seul écran']
    }
  ]
};

// ─── Module Principal ──────────────────────────────────────────────────────

/**
 * Recherche des produits pour une catégorie donnée
 * En production : appel Amazon PA API v5
 * @param {string} searchQuery 
 * @param {number} maxResults
 * @returns {Promise<Array>}
 */
async function searchProducts(searchQuery, maxResults = 5) {
  const mockMode = !process.env.AMAZON_ACCESS_KEY;
  
  if (mockMode) {
    console.log(`[SCOUT/Amazon] 🔧 Mode mock — "${searchQuery}"`);
    const mockKey = Object.keys(MOCK_PRODUCTS).find(k => 
      searchQuery.toLowerCase().includes(k.split(' ')[0])
    );
    const results = MOCK_PRODUCTS[mockKey] || MOCK_PRODUCTS['standing desk home office'];
    return results.slice(0, maxResults);
  }

  // ─── PRODUCTION : Amazon PA API v5 ───────────────────────────────────────
  // Décommenter et configurer avec vos clés
  /*
  const { SearchItems } = require('paapi5-nodejs-sdk');
  const searchItemsRequest = new SearchItems();
  searchItemsRequest.PartnerTag = process.env.AMAZON_ASSOCIATE_TAG;
  searchItemsRequest.PartnerType = 'Associates';
  searchItemsRequest.Keywords = searchQuery;
  searchItemsRequest.SearchIndex = 'All';
  searchItemsRequest.ItemCount = maxResults;
  searchItemsRequest.Resources = [
    'ItemInfo.Title',
    'Offers.Listings.Price',
    'CustomerReviews.StarRating',
    'CustomerReviews.Count',
    'Images.Primary.Large',
    'ItemInfo.Features'
  ];
  // ... appel API
  */
  
  throw new Error('Amazon PA API not configured. Set AMAZON_ACCESS_KEY in .env');
}

/**
 * Filtre les produits selon les critères de qualité
 * @param {Array} products
 * @returns {Array}
 */
function filterQualityProducts(products) {
  const { min_amazon_rating, min_amazon_reviews } = settings.scout;
  return products.filter(p => 
    p.rating >= min_amazon_rating && 
    p.review_count >= min_amazon_reviews
  );
}

/**
 * Calcule le revenu potentiel d'un produit
 * @param {object} product
 * @param {number} monthlyPinterestClicks
 * @returns {object}
 */
function calculateProductRevenue(product, monthlyPinterestClicks = 500) {
  // Hypothèse : 2% des clics Pinterest → site, 5% → achat affiliate
  const siteVisits = monthlyPinterestClicks * 0.02;
  const purchases = siteVisits * 0.05;
  const commissionRate = product.price > 300 ? 0.03 : 0.04; // Amazon Associates
  const monthlyRevenue = purchases * product.price * commissionRate;

  return {
    commission_rate: `${commissionRate * 100}%`,
    estimated_monthly_revenue: parseFloat(monthlyRevenue.toFixed(2)),
    estimated_yearly_revenue: parseFloat((monthlyRevenue * 12).toFixed(2)),
    commission_per_sale: parseFloat((product.price * commissionRate).toFixed(2))
  };
}

/**
 * Fetch complet pour toutes les catégories configurées
 * @returns {Promise<object>}
 */
async function fetchAllCategories() {
  const results = {};
  
  for (const category of settings.product_categories) {
    console.log(`[SCOUT/Amazon] 🔍 Recherche "${category.name}"...`);
    try {
      const products = await searchProducts(category.amazon_search);
      const filtered = filterQualityProducts(products);
      
      results[category.name] = filtered.map(p => ({
        ...p,
        revenue_potential: calculateProductRevenue(p)
      }));
      
      console.log(`[SCOUT/Amazon] ✅ ${filtered.length} produits qualifiés pour "${category.name}"`);
    } catch (err) {
      console.error(`[SCOUT/Amazon] ❌ Erreur pour "${category.name}": ${err.message}`);
      results[category.name] = [];
    }
  }
  
  return results;
}

module.exports = { searchProducts, filterQualityProducts, calculateProductRevenue, fetchAllCategories };

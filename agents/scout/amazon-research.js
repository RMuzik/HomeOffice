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
      asin: 'B08D9GPMDK',
      title: 'Flexispot E7 Pro Standing Desk 140x70cm',
      brand: 'Flexispot',
      price: 429.99,
      rating: 4.6,
      review_count: 2847,
      category: 'Standing Desks',
      image_url: 'https://example.com/flexispot-e7.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B08D9GPMDK?tag=${settings.amazon_tag}`,
      features: ['Moteur double silencieux', 'Mémoire 4 positions', 'Anti-collision', '10 ans garantie'],
      pros: ['Très stable', 'Silencieux', 'Solide qualité'],
      cons: ['Prix élevé', 'Livraison longue']
    },
    {
      asin: 'B09NQKFMF8',
      title: 'Autonomous SmartDesk Pro 152x76cm',
      brand: 'Autonomous',
      price: 549.00,
      rating: 4.4,
      review_count: 1203,
      category: 'Standing Desks',
      image_url: 'https://example.com/autonomous-pro.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B09NQKFMF8?tag=${settings.amazon_tag}`,
      features: ['4 options mémoire', 'Hauteur 66-128cm', 'Surface XL', 'Garantie 5 ans'],
      pros: ['Large surface de travail', 'Design premium'],
      cons: ['Montage complexe', 'Lourd']
    },
    {
      asin: 'B094KFHK7N',
      title: 'IKEA TROTTEN Bureau assis-debout 120x70cm',
      brand: 'IKEA',
      price: 299.00,
      rating: 4.2,
      review_count: 892,
      category: 'Standing Desks',
      image_url: 'https://example.com/ikea-trotten.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B094KFHK7N?tag=${settings.amazon_tag}`,
      features: ['Réglage manuel', 'Design épuré', 'Compatible accessoires IKEA'],
      pros: ['Prix accessible', 'Design scandinave', 'Facile à monter'],
      cons: ['Réglage manuel', 'Moins de stabilité']
    }
  ],
  'ergonomic chair home office': [
    {
      asin: 'B09HFPV76X',
      title: 'Secretlab TITAN Evo 2022 Ergonomic Chair',
      brand: 'Secretlab',
      price: 499.00,
      rating: 4.7,
      review_count: 3421,
      category: 'Ergonomic Chairs',
      image_url: 'https://example.com/secretlab-titan.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B09HFPV76X?tag=${settings.amazon_tag}`,
      features: ['Lombaire magnétique', 'Accoudoirs 4D', 'Mécanisme multi-tilt', 'Certification SG+'],
      pros: ['Très confortable', 'Qualité premium', 'Support lombaire excellent'],
      cons: ['Prix élevé', 'Délai de livraison']
    },
    {
      asin: 'B07Z9WQVNV',
      title: 'HAG Capisco Ergonomic Office Chair',
      brand: 'HAG',
      price: 899.00,
      rating: 4.8,
      review_count: 567,
      category: 'Ergonomic Chairs',
      image_url: 'https://example.com/hag-capisco.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B07Z9WQVNV?tag=${settings.amazon_tag}`,
      features: ['Design unique selle de cheval', 'Compatible bureaux debout', 'Hauteur réglable 47-62cm', 'Garantie 10 ans'],
      pros: ['Idéale pour bureau debout', 'Posture active', 'Longévité excellente'],
      cons: ['Prix très élevé', 'Design atypique']
    },
    {
      asin: 'B08FKWD1T1',
      title: 'Ergohuman Basic ME7ERG Mesh Chair',
      brand: 'Ergohuman',
      price: 389.00,
      rating: 4.5,
      review_count: 1876,
      category: 'Ergonomic Chairs',
      image_url: 'https://example.com/ergohuman-basic.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B08FKWD1T1?tag=${settings.amazon_tag}`,
      features: ['Dossier mesh respirant', 'Appui-tête réglable', 'Accoudoirs 3D', 'Lombaire ajustable'],
      pros: ['Bon rapport qualité/prix', 'Respirant', 'Polyvalent'],
      cons: ['Assise légèrement ferme', 'Montage long']
    }
  ],
  'monitor home office 27 inch': [
    {
      asin: 'B09JGZRXMB',
      title: 'LG 27UK850-W 27" 4K USB-C Monitor',
      brand: 'LG',
      price: 449.00,
      rating: 4.6,
      review_count: 4521,
      category: 'Monitors',
      image_url: 'https://example.com/lg-27uk850.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B09JGZRXMB?tag=${settings.amazon_tag}`,
      features: ['4K UHD IPS', 'USB-C 60W', 'HDR400', 'FreeSync', 'Pied réglable'],
      pros: ['Qualité image excellente', 'USB-C pratique', 'Charge MacBook'],
      cons: ['Pas de 144Hz', 'Pied un peu plastique']
    },
    {
      asin: 'B09NK5DFGG',
      title: 'Dell UltraSharp U2722D 27" QHD',
      brand: 'Dell',
      price: 379.00,
      rating: 4.7,
      review_count: 2103,
      category: 'Monitors',
      image_url: 'https://example.com/dell-u2722d.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B09NK5DFGG?tag=${settings.amazon_tag}`,
      features: ['QHD 2560x1440', 'USB-C 90W', 'IPS Anti-éblouissement', 'Hub USB intégré'],
      pros: ['Excellent pour le travail', 'Dalle IPS parfaite', 'Connectivité top'],
      cons: ['Prix', 'Pas de 4K']
    }
  ],
  'desk lamp home office LED': [
    {
      asin: 'B07QLPVTRZ',
      title: 'BenQ ScreenBar Halo Monitor Light',
      brand: 'BenQ',
      price: 179.99,
      rating: 4.7,
      review_count: 8934,
      category: 'Desk Lamps',
      image_url: 'https://example.com/benq-screenbar-halo.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B07QLPVTRZ?tag=${settings.amazon_tag}`,
      features: ['Rétroéclairage ambient', 'Pas de reflets sur écran', 'Commande sans fil', 'CCT 2700K-6500K'],
      pros: ['Réduit fatigue oculaire', 'Design épuré', 'Rétroéclairage excellent'],
      cons: ['Prix élevé pour une lampe', 'Fixation spécifique moniteur']
    },
    {
      asin: 'B08DCMKX7C',
      title: 'Elgato Key Light Air Professional',
      brand: 'Elgato',
      price: 99.99,
      rating: 4.5,
      review_count: 5672,
      category: 'Desk Lamps',
      image_url: 'https://example.com/elgato-key-light.jpg',
      affiliate_url: `https://www.amazon.fr/dp/B08DCMKX7C?tag=${settings.amazon_tag}`,
      features: ['Contrôle app Stream Deck', 'Luminosité 800 lux', 'CCT réglable', 'Ultra-mince'],
      pros: ['Parfait pour visioconférences', 'Contrôle app', 'Lumière douce'],
      cons: ['Pas idéal comme lampe de bureau seule', 'Fixation bureau obligatoire']
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

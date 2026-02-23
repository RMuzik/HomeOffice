/**
 * amazon-paapi.js — Client Amazon Product Advertising API v5
 *
 * Implémente la signature AWS Signature Version 4 requise par PA-API.
 * Supporte un mode MOCK automatique si les credentials sont absents.
 *
 * Docs: https://webservices.amazon.com/paapi5/documentation/
 */

const https = require('https');
const crypto = require('crypto');

const REGION = 'eu-west-1';         // Europe (Amazon.fr)
const HOST = 'webservices.amazon.fr';
const PATH = '/paapi5/getitems';
const SERVICE = 'ProductAdvertisingAPI';

// ─── Mock data pour développement sans credentials ───────────────────────────

const MOCK_PRODUCTS = {
  'B09C6J4WCS': {
    asin: 'B09C6J4WCS',
    title: 'FlexiSpot E7 Pro Standing Desk',
    brand: 'FlexiSpot',
    price: 499.99,
    currency: 'EUR',
    rating: 4.8,
    reviewCount: 2847,
    imageUrl: null,
    detailPageUrl: 'https://www.amazon.fr/dp/B09C6J4WCS',
    availability: 'Available',
    isPrime: true,
    savings: 100.00,
    originalPrice: 599.99,
    lastUpdated: new Date().toISOString(),
    isMock: true,
  },
  'B001MS57O8': {
    asin: 'B001MS57O8',
    title: 'Herman Miller Aeron Chair',
    brand: 'Herman Miller',
    price: 899.00,
    currency: 'EUR',
    rating: 4.9,
    reviewCount: 8423,
    imageUrl: null,
    detailPageUrl: 'https://www.amazon.fr/dp/B001MS57O8',
    availability: 'Available',
    isPrime: true,
    savings: null,
    originalPrice: null,
    lastUpdated: new Date().toISOString(),
    isMock: true,
  },
  'B09JYRS2KP': {
    asin: 'B09JYRS2KP',
    title: 'Secretlab Titan Evo 2022',
    brand: 'Secretlab',
    price: 449.00,
    currency: 'EUR',
    rating: 4.7,
    reviewCount: 3215,
    imageUrl: null,
    detailPageUrl: 'https://www.amazon.fr/dp/B09JYRS2KP',
    availability: 'Available',
    isPrime: false,
    savings: 50.00,
    originalPrice: 499.00,
    lastUpdated: new Date().toISOString(),
    isMock: true,
  },
};

// ─── Signature AWS v4 ─────────────────────────────────────────────────────────

function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = sign('AWS4' + secretKey, dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  const kSigning = sign(kService, 'aws4_request');
  return kSigning;
}

function buildAuthHeader(accessKey, secretKey, partnerTag, payload) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:application/json; charset=utf-8`,
    `host:${HOST}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

  const canonicalRequest = [
    'POST',
    PATH,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signingKey = getSignatureKey(secretKey, dateStamp, REGION, SERVICE);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
  };
}

// ─── Parser réponse PA-API ────────────────────────────────────────────────────

function parseItem(item) {
  const info = item.ItemInfo || {};
  const offers = item.Offers?.Listings?.[0] || {};
  const images = item.Images?.Primary?.Large || {};

  const price = offers.Price?.Amount || null;
  const savings = offers.Price?.Savings?.Amount || null;
  const originalPrice = savings ? price + savings : null;

  return {
    asin: item.ASIN,
    title: info.Title?.DisplayValue || '',
    brand: info.ByLineInfo?.Brand?.DisplayValue || '',
    price,
    currency: offers.Price?.Currency || 'EUR',
    rating: null, // PA-API ne retourne pas les ratings directement
    reviewCount: null,
    imageUrl: images.URL || null,
    detailPageUrl: item.DetailPageURL || `https://www.amazon.fr/dp/${item.ASIN}`,
    availability: offers.Availability?.Message || 'Unknown',
    isPrime: offers.DeliveryInfo?.IsPrimeEligible || false,
    savings,
    originalPrice,
    lastUpdated: new Date().toISOString(),
    isMock: false,
  };
}

// ─── Client principal ─────────────────────────────────────────────────────────

async function makeRequest(payload, accessKey, secretKey) {
  return new Promise((resolve, reject) => {
    const { authorization, amzDate } = buildAuthHeader(accessKey, secretKey, null, payload);

    const options = {
      hostname: HOST,
      path: PATH,
      method: 'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        'host': HOST,
        'x-amz-date': amzDate,
        'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
        'authorization': authorization,
        'content-length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(parsed);
          } else {
            reject(new Error(`PA-API ${res.statusCode}: ${parsed.Errors?.[0]?.Message || data}`));
          }
        } catch (e) {
          reject(new Error(`PA-API parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Récupère les données de produits Amazon par ASIN.
 * Retourne automatiquement des mocks si les credentials manquent.
 *
 * @param {string[]} asins - Liste d'ASINs (max 10 par appel)
 * @param {object} opts - { accessKey, secretKey, partnerTag }
 * @returns {Promise<object[]>} - Tableau de produits normalisés
 */
async function getItems(asins, opts = {}) {
  const accessKey = opts.accessKey || process.env.AMAZON_ACCESS_KEY;
  const secretKey = opts.secretKey || process.env.AMAZON_SECRET_KEY;
  const partnerTag = opts.partnerTag || process.env.AFFILIATE_TAG || 'homeofficepr-21';

  // Mode MOCK si pas de credentials
  if (!accessKey || !secretKey || accessKey === 'MOCK') {
    console.log(`[PA-API] Mode MOCK — ${asins.length} ASINs`);
    return asins.map(asin => ({
      ...(MOCK_PRODUCTS[asin] || {
        asin,
        title: `Produit Amazon ${asin}`,
        brand: 'Amazon',
        price: 199.99,
        currency: 'EUR',
        rating: 4.5,
        reviewCount: 1000,
        imageUrl: null,
        detailPageUrl: `https://www.amazon.fr/dp/${asin}?tag=${partnerTag}`,
        availability: 'Available',
        isPrime: true,
        savings: null,
        originalPrice: null,
        lastUpdated: new Date().toISOString(),
        isMock: true,
      }),
      affiliateUrl: `https://www.amazon.fr/dp/${asin}?tag=${partnerTag}&linkCode=ogi&th=1&psc=1`,
    }));
  }

  // Appel PA-API réel — max 10 ASINs par requête
  const batches = [];
  for (let i = 0; i < asins.length; i += 10) {
    batches.push(asins.slice(i, i + 10));
  }

  const results = [];

  for (const batch of batches) {
    const payload = JSON.stringify({
      ItemIds: batch,
      Resources: [
        'Images.Primary.Large',
        'ItemInfo.Title',
        'ItemInfo.ByLineInfo',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Message',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
      ],
      PartnerTag: partnerTag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.fr',
    });

    try {
      const response = await makeRequest(payload, accessKey, secretKey);
      const items = response.ItemsResult?.Items || [];

      for (const item of items) {
        const parsed = parseItem(item);
        parsed.affiliateUrl = `https://www.amazon.fr/dp/${item.ASIN}?tag=${partnerTag}&linkCode=ogi&th=1&psc=1`;
        results.push(parsed);
      }

      // Erreurs partielles (ASINs introuvables)
      const errors = response.Errors || [];
      for (const err of errors) {
        console.warn(`[PA-API] ASIN error: ${err.Code} — ${err.Message}`);
      }

      // Rate limit PA-API : max 1 req/seconde
      if (batches.length > 1) {
        await new Promise(r => setTimeout(r, 1100));
      }

    } catch (err) {
      console.error(`[PA-API] Batch error:`, err.message);
      // Fallback mock pour ce batch en cas d'erreur
      for (const asin of batch) {
        results.push({
          asin,
          price: null,
          error: err.message,
          isMock: true,
          affiliateUrl: `https://www.amazon.fr/dp/${asin}?tag=${partnerTag}`,
        });
      }
    }
  }

  return results;
}

/**
 * Prix formaté en euros
 */
function formatPrice(amount, currency = 'EUR') {
  if (!amount) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

module.exports = { getItems, formatPrice };

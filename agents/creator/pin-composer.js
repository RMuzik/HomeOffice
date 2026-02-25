/**
 * AGENT CREATOR — pin-composer.js
 * Assemble le pin final : texte + image → objet prêt pour le PUBLISHER.
 * Gère aussi la conversion en base64 pour l'API Pinterest.
 */

const fs = require('fs');
const path = require('path');

/**
 * Assemble un pin complet depuis les données générées
 * @param {object} pinData - Pin depuis pins-queue
 * @param {object} textContent - Depuis text-generator
 * @param {string} imagePath - Chemin fichier image
 * @param {object} product - Produit associé
 * @returns {object} Pin prêt pour PUBLISHER
 */
function composeFinalPin(pinData, textContent, imagePath, product = null) {
  // Construit le lien de destination (page site → affiliate redirect)
  const destinationUrl = buildDestinationUrl(pinData, product);

  // Encode l'image en base64 pour l'API Pinterest
  let imageBase64 = null;
  let imageSize = 0;
  if (imagePath && fs.existsSync(imagePath)) {
    const imageBuffer = fs.readFileSync(imagePath);
    imageBase64 = imageBuffer.toString('base64');
    imageSize = imageBuffer.length;
  }

  const composedPin = {
    // Identifiants
    pin_id: pinData.pin_id,
    composed_at: new Date().toISOString(),

    // Contenu Pinterest
    title: textContent.title,
    description: textContent.description,
    alt_text: textContent.alt_text,

    // Image
    image_path: imagePath,
    image_base64: imageBase64,
    image_size_bytes: imageSize,
    image_status: imageBase64 ? 'ready' : 'missing',

    // Destination & affiliation
    destination_url: destinationUrl,
    affiliate_url: product?.affiliate_url || null,
    product_asin: product?.asin || null,

    // Metadata Pinterest
    board: pinData.board || 'setup_ideas',
    scheduled_time: pinData.scheduled_time,
    day: pinData.day,
    type: pinData.type,
    keyword: pinData.keyword,

    // Metadata génération
    generated_by: {
      text: textContent.generated_by,
      image: imageBase64 ? 'dall-e-3' : 'mock',
    },

    // Statut
    status: imageBase64 ? 'ready_to_publish' : 'image_missing',
  };

  return composedPin;
}

/**
 * Construit l'URL de destination selon le type de pin
 * Pinterest → page du site → affiliate redirect
 */
function buildDestinationUrl(pinData, product) {
  const baseUrl = process.env.SITE_URL || 'https://homeofficesetup.net';
  const keyword = pinData.keyword?.toLowerCase().replace(/\s+/g, '-') || 'home-office';
  const type = pinData.type;

  if (type === 'product-review' && product?.asin) {
    return `${baseUrl}/reviews/${product.asin.toLowerCase()}/?ref=pinterest`;
  }

  if (type === 'best-of-list') {
    // Mappe keyword → page "best-of"
    const categoryMap = {
      'standing desk': 'best-standing-desks',
      'ergonomic chair': 'best-ergonomic-chairs',
      'monitor': 'best-monitors-home-office',
      'desk lamp': 'best-desk-lamps',
      'webcam': 'best-webcams-home-office',
    };
    const cat = Object.entries(categoryMap).find(([k]) => keyword.includes(k));
    const slug = cat ? cat[1] : `best-${keyword}`;
    return `${baseUrl}/${slug}/?ref=pinterest`;
  }

  if (type === 'budget-guide') {
    return `${baseUrl}/budget-home-office-setup/?ref=pinterest`;
  }

  if (type === 'how-to') {
    return `${baseUrl}/guides/${keyword}/?ref=pinterest`;
  }

  // Fallback : page catégorie générale
  return `${baseUrl}/home-office-setup/?ref=pinterest`;
}

/**
 * Compose une batch complète de pins
 * @param {Array} pinsWithContent - Pins enrichis avec content et image_path
 * @returns {Array} Pins composés prêts pour PUBLISHER
 */
function composeBatch(pinsWithContent) {
  return pinsWithContent.map(pinData => {
    const composed = composeFinalPin(
      pinData,
      pinData.content || {},
      pinData.image_path || null,
      pinData.product || null
    );

    console.log(`[CREATOR/Composer] 📦 ${composed.pin_id} — ${composed.status}`);
    return composed;
  });
}

/**
 * Valide un pin composé avant publication
 */
function validatePin(pin) {
  const errors = [];

  if (!pin.title || pin.title.length < 10) errors.push('Title trop court');
  if (!pin.description || pin.description.length < 50) errors.push('Description trop courte');
  if (!pin.image_base64) errors.push('Image manquante');
  if (!pin.destination_url) errors.push('URL destination manquante');
  if (!pin.board) errors.push('Board Pinterest manquant');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Stats de la batch
 */
function getBatchStats(composedPins) {
  return {
    total: composedPins.length,
    ready: composedPins.filter(p => p.status === 'ready_to_publish').length,
    missing_image: composedPins.filter(p => p.status === 'image_missing').length,
    by_type: composedPins.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {}),
    by_board: composedPins.reduce((acc, p) => {
      acc[p.board] = (acc[p.board] || 0) + 1;
      return acc;
    }, {}),
    total_image_size_mb: parseFloat(
      (composedPins.reduce((sum, p) => sum + (p.image_size_bytes || 0), 0) / 1024 / 1024).toFixed(2)
    )
  };
}

module.exports = { composeFinalPin, composeBatch, validatePin, getBatchStats };

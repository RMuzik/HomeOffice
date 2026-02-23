/**
 * AGENT CREATOR — image-generator.js
 * Génère les visuels des pins Pinterest via DALL-E 3 + Sharp pour le compositing.
 *
 * Pipeline :
 * 1. DALL-E génère l'image de fond (setup home office photorealistic)
 * 2. Sharp ajoute l'overlay texte, gradient, logo
 * 3. Output : PNG 1000x1500px optimisé Pinterest
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ─── Prompts DALL-E par style de pin ─────────────────────────────────────────

const IMAGE_PROMPTS = {
  'best-of-list': (keyword) =>
    `Photorealistic flat lay or overhead view of premium ${keyword} products arranged beautifully on a clean white desk, natural lighting, 8k quality, professional lifestyle photography, minimalist aesthetic, no text`,

  'setup-showcase': (keyword) =>
    `Photorealistic ${keyword}, ultra-clean minimalist home office, natural daylight from window, plants, wooden desk, neutral tones (beige, white, light oak), professional photography, cinematic quality, no text, no watermark`,

  'product-review': (product) =>
    `Photorealistic product photography of modern ergonomic office ${product || 'chair'}, studio lighting, white background, professional e-commerce style, sharp focus, 8k, no text`,

  'how-to': (keyword) =>
    `Photorealistic top-down view of a well-organized ${keyword}, productivity tools visible, cable management, minimal clutter, warm natural light, lifestyle photography, no text`,

  'budget-guide': (keyword) =>
    `Photorealistic affordable but stylish ${keyword}, IKEA-style setup, clean and organized, warm lighting, cozy atmosphere, achievable home office, no text, no watermark`,
};

// ─── Palettes couleurs par style ─────────────────────────────────────────────

const COLOR_SCHEMES = {
  minimal: { bg: '#FFFFFF', text: '#1a1a2e', accent: '#4361ee', overlay: 'rgba(0,0,0,0.35)' },
  warm: { bg: '#FFF8F0', text: '#2D1B0E', accent: '#E07B39', overlay: 'rgba(45,27,14,0.4)' },
  dark: { bg: '#0d1117', text: '#FFFFFF', accent: '#58a6ff', overlay: 'rgba(13,17,23,0.6)' },
  forest: { bg: '#F1F5F0', text: '#2C3E2D', accent: '#27AE60', overlay: 'rgba(44,62,45,0.4)' },
};

// ─── Générateur image DALL-E ─────────────────────────────────────────────────

/**
 * Génère une image via DALL-E 3
 * @param {string} prompt
 * @returns {Promise<Buffer>} Image buffer PNG
 */
async function generateWithDallE(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquant — utiliser generateMockImage()');
  }

  const { default: fetch } = require('node-fetch');
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1792',  // Ratio 9:16 — proche du 2:3 Pinterest
      quality: 'standard',
      response_format: 'url'
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`DALL-E error: ${err.error?.message}`);
  }

  const data = await response.json();
  const imageUrl = data.data[0].url;

  // Download l'image
  const imgResponse = await fetch(imageUrl);
  return Buffer.from(await imgResponse.arrayBuffer());
}

/**
 * Génère une image de fond mock (gradient coloré) pour le développement
 * @param {string} pinType
 * @param {string} keyword
 * @returns {Promise<Buffer>}
 */
async function generateMockBackground(pinType, keyword) {
  const scheme = pinType === 'setup-showcase' ? COLOR_SCHEMES.warm
                : pinType === 'product-review' ? COLOR_SCHEMES.minimal
                : pinType === 'budget-guide'   ? COLOR_SCHEMES.forest
                : COLOR_SCHEMES.dark;

  // Crée un gradient SVG comme fond
  const svgBackground = `
    <svg width="1000" height="1500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#16213e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0f3460;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2d5016;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a3a0a;stop-opacity:1" />
        </linearGradient>
      </defs>
      <!-- Fond principal -->
      <rect width="1000" height="1500" fill="url(#grad)"/>
      <!-- Formes décoratives -->
      <circle cx="800" cy="200" r="300" fill="rgba(88,166,255,0.08)"/>
      <circle cx="100" cy="1300" r="250" fill="rgba(188,140,255,0.06)"/>
      <rect x="50" y="400" width="4" height="700" fill="rgba(88,166,255,0.3)" rx="2"/>
      <!-- Grid pattern subtil -->
      ${Array.from({length: 10}, (_, i) => 
        `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="1500" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`
      ).join('')}
      ${Array.from({length: 15}, (_, i) => 
        `<line x1="0" y1="${i * 100}" x2="1000" y2="${i * 100}" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`
      ).join('')}
      <!-- Icônes décoratives desk -->
      <rect x="200" y="600" width="600" height="400" rx="20" fill="rgba(255,255,255,0.03)" stroke="rgba(88,166,255,0.2)" stroke-width="1"/>
      <text x="500" y="820" font-family="Arial" font-size="80" text-anchor="middle" fill="rgba(88,166,255,0.15)">🖥️</text>
      <!-- Label catégorie -->
      <text x="500" y="1400" font-family="Arial" font-size="22" text-anchor="middle" fill="rgba(255,255,255,0.3)">homeofficesetup.pro</text>
    </svg>
  `;

  return Buffer.from(svgBackground);
}

// ─── Compositeur final (Sharp) ────────────────────────────────────────────────

/**
 * Compose l'image finale : fond + overlay gradient + texte + logo
 * @param {Buffer} backgroundBuffer
 * @param {object} textContent - { headline_overlay, title, keyword }
 * @param {object} options - { scheme, showLogo }
 * @returns {Promise<Buffer>} PNG 1000x1500
 */
async function composeFinalPin(backgroundBuffer, textContent, options = {}) {
  const { headline_overlay = 'Home Office Setup', keyword = '' } = textContent;
  const W = 1000, H = 1500;

  // Resize le fond au format Pinterest
  let bg;
  try {
    bg = await sharp(backgroundBuffer)
      .resize(W, H, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer();
  } catch {
    // Si le fond est du SVG, convertir
    bg = await sharp(Buffer.from(backgroundBuffer))
      .resize(W, H)
      .png()
      .toBuffer();
  }

  // Overlay SVG avec texte et gradient
  const truncatedHeadline = headline_overlay.slice(0, 40);
  const words = truncatedHeadline.split(' ');
  
  // Split headline en 2 lignes si trop long
  const midpoint = Math.ceil(words.length / 2);
  const line1 = words.slice(0, midpoint).join(' ');
  const line2 = words.slice(midpoint).join(' ');

  const overlaysvg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <!-- Gradient bas pour lisibilité texte -->
      <defs>
        <linearGradient id="textGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="transparent"/>
          <stop offset="45%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>
        </linearGradient>
        <!-- Badge accent -->
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#4361ee"/>
          <stop offset="100%" stop-color="#7209b7"/>
        </linearGradient>
      </defs>

      <!-- Gradient overlay bottom -->
      <rect width="${W}" height="${H}" fill="url(#textGrad)"/>

      <!-- Top badge -->
      <rect x="40" y="40" width="200" height="44" rx="22" fill="url(#badgeGrad)" opacity="0.9"/>
      <text x="140" y="68" font-family="Arial Black, Arial" font-weight="900" font-size="16" 
            text-anchor="middle" fill="white">HOME OFFICE PRO</text>

      <!-- Headline principal (grande taille) -->
      <text x="80" y="${H - 280}" 
            font-family="Arial Black, Arial" font-weight="900" font-size="${line2 ? 68 : 78}"
            fill="white" letter-spacing="-1">
        ${line1}
      </text>
      ${line2 ? `<text x="80" y="${H - 195}" 
            font-family="Arial Black, Arial" font-weight="900" font-size="68"
            fill="#58a6ff" letter-spacing="-1">
        ${line2}
      </text>` : ''}

      <!-- Keyword tag -->
      <rect x="80" y="${H - 155}" width="${Math.min(keyword.length * 13 + 40, 400)}" height="36" rx="18" 
            fill="rgba(88,166,255,0.25)" stroke="rgba(88,166,255,0.5)" stroke-width="1"/>
      <text x="${Math.min(keyword.length * 6.5 + 80, 280)}" y="${H - 131}" 
            font-family="Arial" font-size="16" text-anchor="middle" fill="rgba(200,220,255,0.9)">
        #${keyword.replace(/\s+/g, '')}
      </text>

      <!-- CTA bottom -->
      <text x="80" y="${H - 60}" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.6)">
        homeofficesetup.pro →
      </text>

      <!-- Ligne décorative -->
      <rect x="80" y="${H - 90}" width="60" height="3" rx="1.5" fill="#4361ee"/>
    </svg>
  `;

  // Composite : fond + overlay
  const finalImage = await sharp(bg)
    .composite([{
      input: Buffer.from(overlaysvg),
      top: 0,
      left: 0
    }])
    .png({ compressionLevel: 8 })
    .toBuffer();

  return finalImage;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Génère l'image complète pour un pin
 * @param {object} pin
 * @param {object} textContent - Généré par text-generator.js
 * @param {string} outputDir
 * @returns {Promise<string>} Chemin du fichier généré
 */
async function generatePinImage(pin, textContent, outputDir) {
  const pinType = pin.type || 'setup-showcase';
  const keyword = pin.keyword || 'home office setup';
  const useDallE = !!process.env.OPENAI_API_KEY;

  console.log(`[CREATOR/Image] 🎨 Génération image — "${keyword}" (${useDallE ? 'DALL-E' : 'Mock'})`);

  let backgroundBuffer;

  if (useDallE) {
    // Génère avec DALL-E
    const prompt = IMAGE_PROMPTS[pinType]?.(keyword) || IMAGE_PROMPTS['setup-showcase'](keyword);
    backgroundBuffer = await generateWithDallE(prompt);
  } else {
    // Mode mock : gradient SVG
    backgroundBuffer = await generateMockBackground(pinType, keyword);
  }

  // Compose image finale
  const finalBuffer = await composeFinalPin(backgroundBuffer, {
    headline_overlay: textContent.headline_overlay || `Best ${keyword}`,
    keyword,
    title: textContent.title
  });

  // Sauvegarde
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${pin.pin_id || `pin_${Date.now()}`}.png`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, finalBuffer);

  console.log(`[CREATOR/Image] ✅ Sauvegardé: ${filename} (${(finalBuffer.length / 1024).toFixed(0)}KB)`);
  return filepath;
}

/**
 * Génère les images pour une batch de pins
 */
async function generateBatchImages(pinsWithContent, outputDir) {
  const results = [];

  for (let i = 0; i < pinsWithContent.length; i++) {
    const { pin, content } = pinsWithContent[i] || { pin: pinsWithContent[i], content: pinsWithContent[i].content };
    try {
      const imagePath = await generatePinImage(
        pinsWithContent[i],
        pinsWithContent[i].content || {},
        outputDir
      );
      results.push({ ...pinsWithContent[i], image_path: imagePath, image_status: 'ok' });
    } catch (err) {
      console.error(`[CREATOR/Image] ❌ Pin ${i + 1}: ${err.message}`);
      results.push({ ...pinsWithContent[i], image_status: 'error', image_error: err.message });
    }

    // Pause pour éviter rate limiting DALL-E
    if (process.env.OPENAI_API_KEY && i < pinsWithContent.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return results;
}

module.exports = { generatePinImage, generateBatchImages, composeFinalPin, generateMockBackground };

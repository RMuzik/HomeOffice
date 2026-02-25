/**
 * AGENT CREATOR — text-generator.js
 * Génère titres, descriptions et alt-text pour les pins Pinterest via Claude API.
 * Optimisé pour le SEO Pinterest et le taux de clics.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Prompts par type de pin ─────────────────────────────────────────────────

const PIN_PROMPTS = {
  'best-of-list': (keyword, product) => `
Tu es un expert copywriter Pinterest spécialisé Home Office & productivité remote.
Génère du contenu pour un pin Pinterest de type "Best Of List".

Keyword cible : "${keyword}"
Produit mis en avant : "${product?.title || 'home office essentials'}" (prix : ${product?.price || ''}€)
URL affiliée : ${product?.affiliate_url || '#'}

Génère EXACTEMENT ce JSON (sans markdown, sans backticks) :
{
  "title": "titre accrocheur max 100 chars avec emoji, inclut '${keyword}', chiffre si possible (ex: 7 Best...)",
  "description": "description 400-500 chars, inclut keyword, 2-3 avantages clés du produit, CTA 'Découvrir sur [lien]', 5 hashtags pertinents en fin (#homeoffice #desksetup etc)",
  "alt_text": "description image factuelle 100 chars max pour SEO Pinterest",
  "headline_overlay": "texte court 4-6 mots pour overlay sur l'image (ex: 7 Setup Must-Haves)"
}`,

  'setup-showcase': (keyword, product) => `
Tu es un expert copywriter Pinterest spécialisé Home Office aesthetic.
Génère du contenu pour un pin Pinterest de type "Setup Showcase" (inspirationnel).

Keyword cible : "${keyword}"
Produit mis en avant : "${product?.title || 'ergonomic setup'}"

Génère EXACTEMENT ce JSON :
{
  "title": "titre inspirant max 100 chars, évoque l'émotion/l'aesthetic, inclut '${keyword}'",
  "description": "description 400-500 chars, décrit l'ambiance/le style, mentionne les produits clés, CTA vers site, 5 hashtags",
  "alt_text": "description image aesthetic 100 chars pour SEO",
  "headline_overlay": "phrase courte aesthetic 3-5 mots (ex: Your Dream Setup Awaits)"
}`,

  'product-review': (keyword, product) => `
Tu es un expert copywriter Pinterest qui fait des reviews honnêtes de produits Home Office.
Génère du contenu pour un pin "Product Review".

Produit : "${product?.title || keyword}"
Prix : ${product?.price || ''}€
Rating : ${product?.rating || 4.5}/5 (${product?.review_count || 1000}+ avis)

Génère EXACTEMENT ce JSON :
{
  "title": "titre de review max 100 chars, inclut nom produit court + verdict (ex: 'Worth It?' ou rating emoji)",
  "description": "description 400-500 chars, 3 avantages clés, 1 point faible (crédibilité), verdict final, lien review complète, 5 hashtags",
  "alt_text": "review produit factuelle 100 chars pour SEO",
  "headline_overlay": "verdict court 3-4 mots (ex: 4.7★ Must Buy ou Honest Review)"
}`,

  'how-to': (keyword, product) => `
Tu es un expert en productivité remote et Home Office setup.
Génère du contenu pour un pin "How-To / Tips".

Sujet : "${keyword}"
Produit associé : "${product?.title || 'productivity tools'}"

Génère EXACTEMENT ce JSON :
{
  "title": "titre how-to max 100 chars, commence par chiffre + action (ex: 5 Ways to... / How to...)",
  "description": "description 400-500 chars, liste 3-4 tips concrets, mentionne outil/produit naturellement, CTA ressource gratuite, 5 hashtags",
  "alt_text": "description tips home office 100 chars pour SEO",
  "headline_overlay": "action courte 4-5 mots (ex: Transform Your Desk Space)"
}`,

  'budget-guide': (keyword, product) => `
Tu es un expert en home office setup économique.
Génère du contenu pour un pin "Budget Guide".

Keyword : "${keyword}"
Produit accessible : "${product?.title || 'budget desk setup'}" — ${product?.price || ''}€

Génère EXACTEMENT ce JSON :
{
  "title": "titre budget max 100 chars, inclut montant/budget ou 'Under [X]€', très ciblé achat",
  "description": "description 400-500 chars, rassure sur le rapport qualité-prix, liste ce qu'on obtient, CTA urgent ('voir le deal'), 5 hashtags",
  "alt_text": "setup budget home office 100 chars pour SEO",
  "headline_overlay": "accroche budget 3-5 mots (ex: Full Setup Under 300€)"
}`
};

// ─── Générateur principal ────────────────────────────────────────────────────

/**
 * Génère le contenu texte pour un pin
 * @param {object} pin - Pin depuis pins-queue.json
 * @param {object} product - Produit depuis products.json
 * @returns {Promise<object>}
 */
async function generatePinText(pin, product = null) {
  const pinType = pin.type || 'setup-showcase';
  const keyword = pin.keyword || 'home office setup';

  // Vérifier fichier override d'abord (textes pré-générés par Claude Code)
  const overrideFile = path.join(__dirname, '../../data/pins-content.json');
  if (fs.existsSync(overrideFile)) {
    const overrides = JSON.parse(fs.readFileSync(overrideFile, 'utf-8'));
    if (overrides[pin.pin_id]) {
      console.log(`[CREATOR/Text] ✨ Override — "${keyword}" (${pinType})`);
      return { ...overrides[pin.pin_id], generated_by: 'claude-code-override', pin_type: pinType, keyword };
    }
  }

  // Mode mock si pas de clé API
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`[CREATOR/Text] 🔧 Mode mock — "${keyword}" (${pinType})`);
    return getMockContent(pinType, keyword, product);
  }

  const prompt = PIN_PROMPTS[pinType]?.(keyword, product) || PIN_PROMPTS['setup-showcase'](keyword, product);

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    const rawText = message.content[0].text.trim();

    // Parse JSON — robuste aux éventuels backticks
    const jsonStr = rawText.replace(/```json\n?|\n?```/g, '').trim();
    const content = JSON.parse(jsonStr);

    // Validation & trim
    return {
      title: content.title?.slice(0, 100) || `Best ${keyword}`,
      description: content.description?.slice(0, 500) || keyword,
      alt_text: content.alt_text?.slice(0, 100) || keyword,
      headline_overlay: content.headline_overlay?.slice(0, 50) || 'Shop Now',
      generated_by: 'claude-sonnet-4-6',
      pin_type: pinType,
      keyword
    };
  } catch (err) {
    console.error(`[CREATOR/Text] ❌ Erreur génération: ${err.message}`);
    return getMockContent(pinType, keyword, product);
  }
}

/**
 * Génère du contenu mock réaliste (sans API)
 */
function getMockContent(pinType, keyword, product) {
  const templates = {
    'best-of-list': {
      title: `7 Best ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Products in 2026 🖥️`,
      description: `Transform your workspace with the best ${keyword} picks for 2026! From ergonomic chairs to standing desks, these editor-tested products will boost your productivity and comfort. ${product ? `Our top pick: ${product.title} at ${product.price}€.` : ''} Check out our full guide → homeofficesetup.pro\n\n#homeoffice #desksetup #workfromhome #productivity #homeofficesetup`,
      alt_text: `Best ${keyword} products 2026 — curated guide`,
      headline_overlay: `7 Best ${keyword.split(' ')[0]} Picks`,
    },
    'setup-showcase': {
      title: `✨ ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Inspiration — Minimalist & Productive`,
      description: `Your dream ${keyword} is possible! This minimal, functional setup proves you don't need to break the bank for a gorgeous workspace. Natural light, clean cables, and carefully chosen accessories make all the difference. Find all products linked on homeofficesetup.pro\n\n#homeoffice #desksetup #minimalist #workfromhome #officeinspo`,
      alt_text: `Aesthetic ${keyword} — minimalist inspiration`,
      headline_overlay: `Your Dream Setup`,
    },
    'product-review': {
      title: `${product?.title?.slice(0, 60) || keyword} — Honest Review 2026 ⭐${product?.rating || 4.5}`,
      description: `We tested the ${product?.title || keyword} for 3 months. Here's what we found: ✅ Excellent build quality ✅ Easy assembly ✅ Worth every cent. ${product?.price ? `At ${product.price}€` : ''}, it's the best value in its category. Full review → homeofficesetup.pro\n\n#homeoffice #review #desksetup #ergonomic #workfromhome`,
      alt_text: `${product?.title?.slice(0, 70) || keyword} honest review`,
      headline_overlay: `${product?.rating || 4.5}★ Honest Review`,
    },
    'how-to': {
      title: `5 Ways to Upgrade Your ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} This Week 🚀`,
      description: `Small changes, big impact! Here are 5 easy upgrades for your ${keyword}: 1) Add a monitor arm for better posture 2) Upgrade your lighting 3) Invest in a quality chair 4) Cable management = zen desk 5) Plants for focus. All products at homeofficesetup.pro\n\n#homeoffice #productivity #desksetup #workfromhome #officetips`,
      alt_text: `5 tips to upgrade your ${keyword}`,
      headline_overlay: `5 Easy Upgrades`,
    },
    'budget-guide': {
      title: `Full ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Under 500€ — Complete Guide 💰`,
      description: `You don't need thousands to build a productive home office! This complete setup under 500€ includes everything: desk, chair, monitor, and accessories. ${product ? `Starting with the ${product.title} at just ${product.price}€.` : ''} Full shopping list at homeofficesetup.pro\n\n#homeoffice #budgetsetup #workfromhome #desksetup #affordableoffice`,
      alt_text: `Budget ${keyword} under 500€ complete guide`,
      headline_overlay: `Full Setup Under 500€`,
    }
  };

  return {
    ...templates[pinType] || templates['setup-showcase'],
    generated_by: 'mock',
    pin_type: pinType,
    keyword
  };
}

/**
 * Génère le contenu pour une batch de pins
 * @param {Array} pins
 * @param {object} productsByCategory
 * @returns {Promise<Array>}
 */
async function generateBatchContent(pins, productsByCategory = {}) {
  const results = [];
  const allProducts = Object.values(productsByCategory).flat();

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    
    // Trouve un produit pertinent
    const product = pin.target_product
      ? allProducts.find(p => p.asin === pin.target_product.asin)
      : allProducts[i % allProducts.length];

    console.log(`[CREATOR/Text] 📝 Pin ${i + 1}/${pins.length} — "${pin.keyword}" (${pin.type})`);

    const content = await generatePinText(pin, product);
    results.push({ ...pin, content, product });

    // Rate limiting : pause si vraie API
    if (process.env.ANTHROPIC_API_KEY && i < pins.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}

module.exports = { generatePinText, generateBatchContent, getMockContent };

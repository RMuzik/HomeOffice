/**
 * AGENT BUILDER — index.js
 * Génère automatiquement les pages Astro "Best Of" depuis les données SCOUT.
 *
 * Pour chaque keyword HIGH priority, génère :
 * - Une page /best-{keyword}.astro avec les produits Amazon associés
 * - Le JSON-LD schema (ItemList)
 * - Le SEO (title, description, H1)
 *
 * Usage :
 *   node agents/builder/index.js              → génère toutes les pages
 *   node agents/builder/index.js --dry-run    → preview sans écrire
 *   node agents/builder/index.js --keyword="standing desk" → une seule page
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const SITE_DIR = process.env.SITE_DIR || path.join(__dirname, '../../../homeoffice-site/src/pages');
const AFFILIATE_TAG = process.env.AFFILIATE_TAG || 'homeofficepr-21';

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * Génère le slug URL depuis un keyword
 */
function toSlug(keyword) {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Génère un titre H1 accrocheur selon le type de keyword
 */
function generateH1(keyword, count = 5) {
  const kw = keyword.toLowerCase();
  if (kw.includes('budget') || kw.includes('cheap') || kw.includes('affordable')) {
    return `Le guide complet setup home office pas cher (${new Date().getFullYear()})`;
  }
  if (kw.includes('best') || kw.includes('top') || kw.includes('meilleur')) {
    return `Les ${count} meilleurs ${keyword.replace(/^(best|top)\s+/i, '')} testés en ${new Date().getFullYear()}`;
  }
  return `Meilleur ${keyword} : comparatif ${count} modèles (${new Date().getFullYear()})`;
}

/**
 * Génère la description SEO meta
 */
function generateDescription(keyword, productCount) {
  return `Comparatif des ${productCount} meilleurs ${keyword} pour le home office en ${new Date().getFullYear()}. Tests, avis et prix mis à jour chaque semaine. Trouvez le meilleur rapport qualité/prix.`;
}

/**
 * Génère le code Astro complet d'une page Best-Of
 */
function generatePageCode(keyword, products, slug) {
  const h1 = generateH1(keyword, products.length);
  const description = generateDescription(keyword, products.length);
  const lastUpdated = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const tocItems = [
    { id: 'comparatif', label: 'Comparatif rapide' },
    { id: 'comment-choisir', label: 'Comment choisir ?' },
    ...products.map((p, i) => ({
      id: `product-${p.asin}`,
      label: `${i + 1}. ${p.name}`,
      rank: i + 1,
    })),
    { id: 'faq', label: 'Questions fréquentes' },
  ];

  const schemaItems = products.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: `${p.brand} ${p.name}`,
    url: `https://homeofficesetup.pro/${slug}#product-${p.asin}`,
  }));

  const productCards = products.map((p, i) => {
    const rank = i + 1;
    const badge = rank === 1 ? "'pick'" : rank === products.length ? "'budget'" : 'null';
    return `
  <ProductCard
    rank={${rank}}
    badge={${badge}}
    brand="${p.brand}"
    name="${p.name}"
    asin="${p.asin}"
    affiliateTag={AFFILIATE_TAG}
    price="${p.price}"
    rating={${p.rating}}
    reviewCount={${p.reviewCount}}
    img="${p.img || '📦'}"
    verdict="${(p.description || '').replace(/"/g, "'").slice(0, 200)}"
    highlight={${rank === 1}}
  />`;
  }).join('\n');

  const tableRows = products.map((p, i) => `
          <tr class="${i === 0 ? 'bg-electric/5' : 'bg-white hover:bg-oak-50'} transition-colors">
            <td class="px-4 py-3 font-semibold text-ink">
              <span class="text-electric mr-2">#{${i + 1}}</span>
              ${p.brand} ${p.name}
              ${i === 0 ? '<span class="ml-2 badge-pick text-[10px] py-0.5">⭐ Top</span>' : ''}
            </td>
            <td class="px-3 py-3 text-center font-bold text-ink">${p.price}</td>
            <td class="px-3 py-3 text-center text-amber-500">${'★'.repeat(Math.round(p.rating))} <span class="text-ink-muted text-xs">${p.rating}</span></td>
          </tr>`).join('\n');

  return `---
import BestOf from '../layouts/BestOf.astro';
import ProductCard from '../components/ProductCard.astro';

// ⚠️ Page générée automatiquement par l'Agent BUILDER
// Dernière mise à jour : ${new Date().toISOString()}
// Source : agents/builder/index.js

const AFFILIATE_TAG = import.meta.env.AFFILIATE_TAG || '${AFFILIATE_TAG}';
const LAST_UPDATED = '${lastUpdated}';

const tocItems = ${JSON.stringify(tocItems, null, 2)};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: '${h1}',
  numberOfItems: ${products.length},
  itemListElement: ${JSON.stringify(schemaItems, null, 2)},
};
---

<BestOf
  title="${h1}"
  description="${description}"
  h1="${h1}"
  intro="Nous avons analysé plus de ${products.length * 3} modèles pour sélectionner les ${products.length} meilleurs ${keyword}. Chaque produit est évalué sur ses performances réelles, sa durabilité et son rapport qualité/prix."
  lastUpdated={LAST_UPDATED}
  productsCount={${products.length}}
  tocItems={tocItems}
  schema={schema}
  breadcrumb={[{ label: '${keyword}', href: '/${slug}' }]}
>

  <!-- Comparatif rapide -->
  <section id="comparatif" class="mb-12 scroll-mt-24">
    <h2 class="font-display text-2xl font-bold text-ink mb-6">Comparatif rapide</h2>
    <div class="overflow-x-auto rounded-2xl border border-oak-200">
      <table class="w-full text-sm">
        <thead class="bg-ink text-cream">
          <tr>
            <th class="text-left px-4 py-3 font-display font-semibold">Produit</th>
            <th class="text-center px-3 py-3 font-display font-semibold">Prix</th>
            <th class="text-center px-3 py-3 font-display font-semibold">Note</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-oak-100">
          ${tableRows}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Comment choisir -->
  <section id="comment-choisir" class="mb-12 scroll-mt-24">
    <h2 class="font-display text-2xl font-bold text-ink mb-5">Comment bien choisir ?</h2>
    <div class="bg-oak-50 rounded-2xl p-6 text-sm text-ink-muted leading-relaxed space-y-3">
      <p>Avant d'acheter, définissez votre budget, votre usage (intensité, durée quotidienne) et vos priorités (durabilité, esthétique, performance).</p>
      <p>Notre recommandation : commencez par le <strong>#1 de notre liste</strong> — il offre le meilleur équilibre pour la majorité des utilisateurs.</p>
    </div>
  </section>

  <!-- Produits -->
  <section class="space-y-10 mb-12">
    <h2 class="font-display text-2xl font-bold text-ink">Les ${products.length} meilleurs ${keyword}</h2>
${productCards}
  </section>

  <!-- FAQ -->
  <section id="faq" class="scroll-mt-24 mb-12">
    <h2 class="font-display text-2xl font-bold text-ink mb-6">Questions fréquentes</h2>
    <div class="space-y-4">
      <details class="group rounded-2xl bg-oak-50 border border-oak-100 overflow-hidden">
        <summary class="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer font-semibold text-ink select-none hover:bg-oak-100 transition-colors">
          Quel est le meilleur ${keyword} rapport qualité/prix ?
          <svg class="w-5 h-5 shrink-0 text-ink-muted group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </summary>
        <div class="px-5 pb-5 text-sm text-ink-muted leading-relaxed border-t border-oak-200 pt-4">
          En 2026, le <strong>${products[0]?.brand} ${products[0]?.name}</strong> offre le meilleur rapport qualité/prix de notre sélection à ${products[0]?.price}. C'est notre choix #1 après avoir comparé plus de ${products.length * 3} modèles.
        </div>
      </details>
    </div>
  </section>

  <p class="disclosure text-center">
    Liens affiliés Amazon Associates — commissions perçues sans surcoût pour vous. Nos sélections sont indépendantes.
  </p>

</BestOf>
`;
}

// ─── Mapping keywords → produits mock (sera remplacé par vraies données Amazon) ──

function getMockProducts(keyword) {
  // Simule des produits réalistes selon le keyword
  const base = [
    { brand: 'FlexiSpot', name: 'E7 Pro', asin: 'B09C6J4WCS', price: '499€', rating: 4.8, reviewCount: 2847, img: '🖥️', description: 'Le meilleur de sa catégorie pour le home office en 2026.' },
    { brand: 'Ergotron', name: 'LX Arm', asin: 'B0033EEXY0', price: '149€', rating: 4.7, reviewCount: 8234, img: '💪', description: 'Référence des bras de moniteur depuis 10 ans.' },
    { brand: 'Logitech', name: 'MX Keys Advanced', asin: 'B07W6JRBSD', price: '119€', rating: 4.6, reviewCount: 15234, img: '⌨️', description: 'Le clavier premium pour les télétravailleurs exigeants.' },
    { brand: 'Secretlab', name: 'Titan Evo', asin: 'B09JYRS2KP', price: '449€', rating: 4.7, reviewCount: 3215, img: '🪑', description: 'La chaise gaming qui a conquis les pros.' },
    { brand: 'LG', name: '27UK850-W 4K', asin: 'B07D5GRNCJ', price: '399€', rating: 4.6, reviewCount: 3102, img: '📺', description: 'IPS 4K 27" avec USB-C — le moniteur universel.' },
  ];
  return base.slice(0, 4 + Math.floor(Math.random() * 2));
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetKeyword = args.find(a => a.startsWith('--keyword='))?.split('=')[1];

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🏗️  AGENT BUILDER — Astro Pages    ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN' : 'WRITE'} | Site: ${SITE_DIR.split('/').slice(-3).join('/')} ║`);
  console.log('╚══════════════════════════════════════╝\n');

  // Charge keywords depuis SCOUT
  const keywordsPath = path.join(DATA_DIR, 'keywords.json');
  if (!fs.existsSync(keywordsPath)) {
    console.error('❌ keywords.json manquant. Lance: npm run scout');
    process.exit(1);
  }

  const { keywords } = JSON.parse(fs.readFileSync(keywordsPath, 'utf-8'));
  const highPriority = keywords.filter(k => k.priority === 'HIGH');

  let targets = highPriority;
  if (targetKeyword) {
    targets = highPriority.filter(k => k.keyword.includes(targetKeyword));
  }

  console.log(`📋 ${targets.length} pages à générer (sur ${highPriority.length} keywords HIGH)\n`);

  let generated = 0;
  let skipped = 0;

  for (const kwData of targets) {
    const keyword = kwData.keyword;
    const slug = toSlug(keyword.replace(/^(best|top|meilleur[s]?)\s+/i, 'best-'));
    const pagePath = path.join(SITE_DIR, `${slug}.astro`);

    // Skip si la page existe déjà et n'est pas générée par le builder
    if (fs.existsSync(pagePath)) {
      const content = fs.readFileSync(pagePath, 'utf-8');
      if (!content.includes('Agent BUILDER')) {
        console.log(`⏭️  ${slug}.astro — page manuelle, skip`);
        skipped++;
        continue;
      }
    }

    process.stdout.write(`🏗️  ${slug}.astro... `);

    const products = getMockProducts(keyword);
    const code = generatePageCode(keyword, products, slug);

    if (!dryRun) {
      fs.writeFileSync(pagePath, code);
    }

    generated++;
    console.log(`✅ ${products.length} produits | Score: ${kwData.score}`);
  }

  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║       🏗️  BUILDER TERMINÉ             ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`\n   Générées : ${generated} pages ✅`);
  console.log(`   Ignorées  : ${skipped} pages (manuelles) ⏭️`);
  if (dryRun) console.log(`\n   💡 DRY RUN — aucun fichier écrit`);
  else console.log(`\n   📁 Pages dans: ${SITE_DIR}`);
  console.log('');
}

run().catch(err => {
  console.error('❌ BUILDER FAILED:', err.message);
  process.exit(1);
});

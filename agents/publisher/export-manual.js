/**
 * AGENT PUBLISHER — export-manual.js
 * Exporte les pins vers un dossier prêt pour publication manuelle ou
 * via outil tiers (Tailwind App, Buffer, Pinterest Bulk Creator).
 *
 * Génère dans data/export/YYYY-MM-DD/ :
 *   images/          → tous les PNGs du batch (1000×1500px)
 *   pins.csv         → format Tailwind/Buffer pour import direct
 *   descriptions.txt → texte prêt à copier-coller par pin
 *   README.txt       → instructions d'upload
 *
 * Usage :
 *   node agents/publisher/export-manual.js
 *   node agents/publisher/export-manual.js --limit=10
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadPinsReady() {
  const filepath = path.join(DATA_DIR, 'pins-ready.json');
  if (!fs.existsSync(filepath)) {
    throw new Error('pins-ready.json manquant. Lance d\'abord: npm run creator');
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return data.pins || [];
}

function loadPublishState() {
  const filepath = path.join(DATA_DIR, 'publish-state.json');
  if (!fs.existsSync(filepath)) return { published: [] };
  const state = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  // published peut être un objet {pin_id: {...}} ou un array — normaliser en array
  if (state.published && !Array.isArray(state.published)) {
    state.published = Object.entries(state.published).map(([pin_id, data]) => ({ pin_id, ...data }));
  }
  return state;
}

/**
 * Échappe les champs CSV (guillemets, virgules)
 */
function csvField(value) {
  const str = String(value || '').replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Mappe la clé board interne → nom lisible Pinterest
 */
const BOARD_NAMES = {
  setup_ideas:      'Home Office Setup Ideas',
  ergonomic_office: 'Ergonomic Office Furniture',
  minimalist_desk:  'Minimalist Desk Aesthetic',
  budget_office:    'Budget Home Office Ideas',
  gaming_setup:     'Gaming Desk Setup Ideas',
};

// ─── Génération export ────────────────────────────────────────────────────────

async function exportPins(options = {}) {
  const { limit = 0 } = options;

  const today = new Date().toISOString().split('T')[0];
  const exportDir = path.join(DATA_DIR, 'export', today);
  const imagesDir = path.join(exportDir, 'images');

  fs.mkdirSync(imagesDir, { recursive: true });

  const allPins = loadPinsReady();
  const state   = loadPublishState();
  const publishedIds = new Set((state.published || []).map(p => p.pin_id));

  let pins = allPins.filter(p => !publishedIds.has(p.pin_id));
  if (limit > 0) pins = pins.slice(0, limit);

  if (pins.length === 0) {
    console.log('✅ Aucun pin à exporter (tous déjà publiés ou file vide).');
    return;
  }

  console.log(`\n📦 Export de ${pins.length} pins → ${exportDir}\n`);

  // ── 1. Copie des images ──────────────────────────────────────────────────
  let imagesOk = 0;
  for (const pin of pins) {
    if (pin.image_path && fs.existsSync(pin.image_path)) {
      const destName = `${pin.pin_id}.png`;
      fs.copyFileSync(pin.image_path, path.join(imagesDir, destName));
      pin._export_image = destName;
      imagesOk++;
    } else if (pin.image_base64) {
      // Décoder le base64 si l'image n'est pas sur disque
      const destName = `${pin.pin_id}.png`;
      fs.writeFileSync(
        path.join(imagesDir, destName),
        Buffer.from(pin.image_base64, 'base64')
      );
      pin._export_image = destName;
      imagesOk++;
    } else {
      pin._export_image = null;
    }
  }
  console.log(`  🖼️  ${imagesOk}/${pins.length} images copiées`);

  // ── 2. CSV (format Tailwind App) ─────────────────────────────────────────
  // Colonnes Tailwind : Image URL,Board,Title,Note (description),Link,Alt Text
  const csvLines = [
    ['Media URL', 'Pinterest board', 'Title', 'Description', 'Link'].map(csvField).join(',')
  ];

  for (const pin of pins) {
    if (!pin._export_image) continue;
    const boardName = BOARD_NAMES[pin.board] || BOARD_NAMES.setup_ideas;
    csvLines.push([
      pin._export_image,
      boardName,
      pin.title || '',
      pin.description || '',
      pin.destination_url || '',
    ].map(csvField).join(','));
  }

  const csvPath = path.join(exportDir, 'pins.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`  📊 CSV exporté : pins.csv (${csvLines.length - 1} pins)`);

  // ── 3. Descriptions texte ────────────────────────────────────────────────
  const lines = [
    `HOMEOFFICESETUP.PRO — Export Pinterest du ${today}`,
    `${pins.length} pins prêts à publier`,
    '='.repeat(60),
    ''
  ];

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    const boardName = BOARD_NAMES[pin.board] || BOARD_NAMES.setup_ideas;
    lines.push(`── PIN ${String(i + 1).padStart(2, '0')} ──────────────────────────────`);
    lines.push(`Image    : images/${pin._export_image || 'MANQUANTE'}`);
    lines.push(`Board    : ${boardName}`);
    lines.push(`Titre    : ${pin.title || ''}`);
    lines.push('');
    lines.push(`Desc     : ${pin.description || ''}`);
    lines.push(`Lien     : ${pin.destination_url || ''}`);
    lines.push(`Alt text : ${pin.alt_text || pin.title || ''}`);
    if (pin.scheduled_at) {
      lines.push(`Horaire  : ${pin.scheduled_at}`);
    }
    lines.push('');
  }

  const txtPath = path.join(exportDir, 'descriptions.txt');
  fs.writeFileSync(txtPath, lines.join('\n'), 'utf-8');
  console.log(`  📝 Descriptions : descriptions.txt`);

  // ── 4. README instructions ───────────────────────────────────────────────
  const siteUrl = process.env.SITE_URL || 'https://homeofficesetup.pro';
  const readme = `HOMEOFFICESETUP.PRO — Guide de publication Pinterest
======================================================
Export généré le ${today} | ${pins.length} pins

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ÉTAPE 1 — CRÉER LES TABLEAUX SUR PINTEREST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Avant d'importer le CSV, crée ces 3 tableaux sur ton compte Pinterest
(noms EXACTS, respecter la casse et les espaces) :

  → "Home Office Setup Ideas"     (24 pins)
  → "Ergonomic Office Furniture"  (8 pins)
  → "Budget Home Office Ideas"    (3 pins)

Sur Pinterest : pinterest.com → "Créer" → "Tableau"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 1 — PINTEREST BULK CREATOR (natif, recommandé)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Créer un fichier ZIP contenant :
   - pins.csv (ce fichier CSV)
   - tous les PNGs du dossier images/ (35 fichiers)
2. Aller sur : ads.pinterest.com → Créer → Plusieurs épingles
3. Uploader le fichier .zip
4. Pinterest mappe automatiquement les images via la colonne "Media URL"
5. Vérifier les aperçus et publier

Note : Le CSV utilise les noms de fichier PNG comme "Media URL".
       Pinterest les associe aux images uploadées dans le même ZIP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 2 — TAILWIND APP (programmation automatique)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Va sur https://www.tailwindapp.com/ → créer un compte gratuit
2. Connecte ton compte Pinterest Business
3. Clique "Publisher" → "Bulk Upload"
4. Upload les images depuis images/ + coller le contenu de descriptions.txt
5. Programme les créneaux → Tailwind optimise les heures automatiquement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 3 — PINTEREST ÉPINGLE PAR ÉPINGLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Va sur pinterest.com → "Créer une épingle"
2. Upload image depuis images/
3. Copie-colle titre + description depuis descriptions.txt
4. Ajoute le lien de destination
5. Sélectionne le tableau et programme le créneau

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 4 — API PINTEREST (quand l'app est approuvée)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Une fois ton app Pinterest approuvée :
1. Ajouter PINTEREST_ACCESS_TOKEN dans .env
2. Lancer : npm run publish
→ Publication 100% automatique

Site : ${siteUrl}
Affiliation : Amazon Associates — tag zeroalc-21
`;

  const readmePath = path.join(exportDir, 'README.txt');
  fs.writeFileSync(readmePath, readme, 'utf-8');
  console.log(`  📖 README : README.txt`);

  // ── Résumé ───────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════╗
║     ✅ EXPORT TERMINÉ                ║
╚══════════════════════════════════════╝

📁 Dossier : data/export/${today}/
   ├── images/     (${imagesOk} PNGs 1000×1500px)
   ├── pins.csv    (import Tailwind/Buffer)
   ├── descriptions.txt
   └── README.txt

Prochaine étape → README.txt pour les instructions.
`);

  return { exportDir, pins: pins.length, images: imagesOk };
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

exportPins({ limit }).catch(err => {
  console.error('\n❌ EXPORT FAILED:', err.message);
  process.exit(1);
});

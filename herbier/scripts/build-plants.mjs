#!/usr/bin/env node
// Enrichit src/data/plants.json depuis l'API GBIF.
// Usage : node scripts/build-plants.mjs [genre1 genre2 ...]
// Sans argument, requête tous les genres déjà présents dans le dataset
// et complète les espèces manquantes. Avec arguments, ajoute toutes les
// espèces des genres donnés.
//
// Exemples :
//   node scripts/build-plants.mjs Gentiana Saxifraga Primula
//   node scripts/build-plants.mjs            # rafraîchit l'existant

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data", "plants.json");

const FAMILY_FR = {
  Asteraceae: "Astéracées", Fabaceae: "Fabacées", Rosaceae: "Rosacées",
  Lamiaceae: "Lamiacées", Apiaceae: "Apiacées", Ranunculaceae: "Renonculacées",
  Liliaceae: "Liliacées", Orchidaceae: "Orchidacées", Brassicaceae: "Brassicacées",
  Geraniaceae: "Géraniacées", Primulaceae: "Primulacées", Saxifragaceae: "Saxifragacées",
  Ericaceae: "Éricacées", Caryophyllaceae: "Caryophyllacées", Boraginaceae: "Boraginacées",
  Campanulaceae: "Campanulacées", Violaceae: "Violacées", Onagraceae: "Onagracées",
  Polygonaceae: "Polygonacées", Plantaginaceae: "Plantaginacées", Gentianaceae: "Gentianacées",
  Orobanchaceae: "Orobanchacées", Crassulaceae: "Crassulacées", Cyperaceae: "Cypéracées",
  Poaceae: "Poacées", Salicaceae: "Salicacées", Betulaceae: "Bétulacées",
  Pinaceae: "Pinacées", Cupressaceae: "Cupressacées", Iridaceae: "Iridacées",
  Amaryllidaceae: "Amaryllidacées", Asparagaceae: "Asparagacées",
  Melanthiaceae: "Mélanthiacées", Colchicaceae: "Colchicacées",
  Papaveraceae: "Papavéracées", Cistaceae: "Cistacées", Thymelaeaceae: "Thyméléacées",
  Oxalidaceae: "Oxalidacées", Urticaceae: "Urticacées", Adoxaceae: "Adoxacées",
  Caprifoliaceae: "Caprifoliacées", Apocynaceae: "Apocynacées",
  Lentibulariaceae: "Lentibulariacées", Hypericaceae: "Hypéricacées",
  Polygalacées: "Polygalacées", Tofieldiaceae: "Tofieldiacées",
  Euphorbiaceae: "Euphorbiacées", Juncaceae: "Joncacées",
};

const existing = JSON.parse(readFileSync(DATA, "utf-8"));
const byLatin = new Map(existing.map((p) => [p.l.toLowerCase(), p]));

async function gbifSearch(query, opts = {}) {
  const url =
    "https://api.gbif.org/v1/species/search?" +
    new URLSearchParams({
      q: query,
      rank: "SPECIES",
      kingdom: "Plantae",
      status: "ACCEPTED",
      limit: "100",
      ...opts,
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GBIF ${res.status}`);
  return (await res.json()).results || [];
}

async function vernacular(speciesKey) {
  try {
    const res = await fetch(
      `https://api.gbif.org/v1/species/${speciesKey}/vernacularNames?limit=50`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const fr = (data.results || []).find((v) => v.language === "fra");
    return fr ? fr.vernacularName : "";
  } catch {
    return "";
  }
}

const args = process.argv.slice(2);
const genera =
  args.length > 0
    ? args
    : [...new Set(existing.map((p) => p.l.split(" ")[0]))];

console.log(`Interrogation GBIF pour ${genera.length} genre(s)…`);
let added = 0;

for (const genus of genera) {
  process.stdout.write(`  ${genus}… `);
  try {
    const results = await gbifSearch(genus);
    let localAdded = 0;
    for (const r of results) {
      const latin = r.canonicalName || r.scientificName;
      if (!latin || !latin.startsWith(genus + " ")) continue;
      const key = latin.toLowerCase();
      if (byLatin.has(key)) continue;
      const fam = FAMILY_FR[r.family] || r.family || "";
      const n = await vernacular(r.key);
      const entry = { n, l: latin, f: fam };
      byLatin.set(key, entry);
      localAdded++;
      added++;
    }
    console.log(`+${localAdded}`);
  } catch (e) {
    console.log(`× ${e.message}`);
  }
}

const merged = [...byLatin.values()].sort((a, b) =>
  (a.n || a.l).localeCompare(b.n || b.l, "fr")
);

writeFileSync(DATA, JSON.stringify(merged, null, 2) + "\n");
console.log(`\n${merged.length} entrées au total (${added} ajoutées).`);

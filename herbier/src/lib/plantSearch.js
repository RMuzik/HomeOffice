import plants from "../data/plants.json";

const FAMILY_LATIN_TO_FR = {
  Asteraceae: "Astéracées",
  Compositae: "Astéracées",
  Fabaceae: "Fabacées",
  Leguminosae: "Fabacées",
  Rosaceae: "Rosacées",
  Lamiaceae: "Lamiacées",
  Labiatae: "Lamiacées",
  Apiaceae: "Apiacées",
  Umbelliferae: "Apiacées",
  Ranunculaceae: "Renonculacées",
  Liliaceae: "Liliacées",
  Orchidaceae: "Orchidacées",
  Brassicaceae: "Brassicacées",
  Cruciferae: "Brassicacées",
  Geraniaceae: "Géraniacées",
  Primulaceae: "Primulacées",
  Saxifragaceae: "Saxifragacées",
  Ericaceae: "Éricacées",
  Caryophyllaceae: "Caryophyllacées",
  Boraginaceae: "Boraginacées",
  Campanulaceae: "Campanulacées",
  Violaceae: "Violacées",
  Onagraceae: "Onagracées",
  Polygonaceae: "Polygonacées",
  Plantaginaceae: "Plantaginacées",
  Gentianaceae: "Gentianacées",
  Orobanchaceae: "Orobanchacées",
  Scrophulariaceae: "Scrophulariacées",
  Crassulaceae: "Crassulacées",
  Cyperaceae: "Cypéracées",
  Poaceae: "Poacées",
  Gramineae: "Poacées",
  Salicaceae: "Salicacées",
  Betulaceae: "Bétulacées",
  Pinaceae: "Pinacées",
  Cupressaceae: "Cupressacées",
  Iridaceae: "Iridacées",
  Amaryllidaceae: "Amaryllidacées",
  Asparagaceae: "Asparagacées",
  Melanthiaceae: "Mélanthiacées",
  Colchicaceae: "Colchicacées",
  Papaveraceae: "Papavéracées",
  Hypericaceae: "Hypéricacées",
  Cistaceae: "Cistacées",
  Thymelaeaceae: "Thyméléacées",
  Oxalidaceae: "Oxalidacées",
  Urticaceae: "Urticacées",
  Adoxaceae: "Adoxacées",
  Caprifoliaceae: "Caprifoliacées",
  Apocynaceae: "Apocynacées",
  Lentibulariaceae: "Lentibulariacées",
  Equisetaceae: "Équisétacées",
  Dryopteridaceae: "Dryoptéridacées",
  Polygalaceae: "Polygalacées",
  Tofieldiaceae: "Tofieldiacées",
  Euphorbiaceae: "Euphorbiacées",
  Juncaceae: "Joncacées",
};

export const norm = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const INDEX = plants.map((p) => ({
  ...p,
  _n: norm(p.n),
  _l: norm(p.l),
}));

export function searchLocal(q, limit = 8) {
  const qn = norm(q);
  if (qn.length < 2) return [];
  const startsCommon = [];
  const startsLatin = [];
  const contains = [];
  for (const p of INDEX) {
    if (p._n.startsWith(qn)) startsCommon.push(p);
    else if (p._l.startsWith(qn)) startsLatin.push(p);
    else if (p._n.includes(qn) || p._l.includes(qn)) contains.push(p);
    if (startsCommon.length + startsLatin.length + contains.length >= limit * 3) break;
  }
  return [...startsCommon, ...startsLatin, ...contains]
    .slice(0, limit)
    .map(({ _n, _l, ...rest }) => ({ ...rest, source: "local" }));
}

let gbifCache = new Map();

export async function searchGBIF(q, { limit = 6, signal } = {}) {
  const qn = q.trim();
  if (qn.length < 3) return [];
  const cacheKey = qn.toLowerCase();
  if (gbifCache.has(cacheKey)) return gbifCache.get(cacheKey);

  try {
    const url =
      "https://api.gbif.org/v1/species/search?" +
      new URLSearchParams({
        q: qn,
        rank: "SPECIES",
        kingdom: "Plantae",
        status: "ACCEPTED",
        limit: String(limit),
      });
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const results = (data.results || [])
      .filter((r) => r.canonicalName || r.scientificName)
      .map((r) => {
        const vernacular =
          r.vernacularNames?.find((v) => v.language === "fra")?.vernacularName ||
          "";
        const familyLatin = r.family || "";
        return {
          n: vernacular,
          l: r.canonicalName || r.scientificName,
          f: FAMILY_LATIN_TO_FR[familyLatin] || familyLatin || "",
          gbifKey: r.key,
          source: "gbif",
        };
      });
    gbifCache.set(cacheKey, results);
    return results;
  } catch (e) {
    if (e.name !== "AbortError") console.warn("GBIF lookup failed:", e);
    return [];
  }
}

export function mergeResults(local, remote, limit = 10) {
  const seen = new Set(local.map((p) => norm(p.l)));
  const merged = [...local];
  for (const r of remote) {
    const key = norm(r.l);
    if (!seen.has(key)) {
      merged.push(r);
      seen.add(key);
    }
    if (merged.length >= limit) break;
  }
  return merged;
}

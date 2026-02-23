# CLAUDE.md — Contexte Global Projet HomeOffice Setup Pro

> Ce fichier est le point d'entrée pour Claude Code. Il contient tout le contexte nécessaire pour travailler sur ce projet sans historique de conversation.

---

## 🎯 Vision du projet

**HomeOffice Setup Pro** est un site affilié Amazon automatisé dans la niche "Home Office & Productivité".
Objectif : générer 1000€+/mois de revenu passif via commissions Amazon Associates (tag : `zeroalc-21`).

Le système est entièrement automatisé via un pipeline de 7 agents GitHub Actions.

---

## 📁 Structure des repos

```
GitHub: RMuzik/HomeOffice        → Les 7 agents (automation pipeline)
GitHub: RMuzik/HomeOffice-Site   → Le site Astro (frontend)
Live:   https://home-office-site-two.vercel.app/
```

---

## 🏗️ Architecture — 2 repos

### Repo 1 : homeoffice-affiliate (agents)
```
homeoffice-affiliate/
├── .github/workflows/
│   ├── weekly-scout.yml         # Lun 00h — recherche keywords
│   ├── weekly-creator.yml       # Lun 02h — génération contenu
│   ├── price-updater.yml        # Lun 03h30 — màj prix PA-API
│   ├── weekly-builder.yml       # Lun 04h — build pages Astro
│   ├── weekly-publisher.yml     # Mar-Dim 09h — publication Pinterest
│   ├── weekly-tracker.yml       # Ven 18h — analytics
│   └── weekly-revenue.yml       # Ven 19h — analyse ROI
├── agents/
│   ├── scout/index.js           # Keyword research (GSC + Anthropic)
│   ├── creator/index.js         # Génération articles SEO
│   ├── builder/
│   │   ├── index.js             # Génère pages Astro + commit
│   │   ├── amazon-paapi.js      # Client PA-API v5 (signature AWS v4)
│   │   └── price-updater.js     # Màj prix depuis PA-API
│   ├── publisher/index.js       # Publication Pinterest
│   ├── tracker/index.js         # Analytics Pinterest + GSC
│   └── revenue/
│       ├── index.js             # Analyse ROI par keyword (RPM, tiers)
│       ├── associates-scraper.js # Parse CSV Amazon Associates
│       └── report.js            # Génère rapport Markdown
├── config/
│   └── keywords.json            # Seeds keywords initiaux
└── data/                        # Générés par les agents (gitignored logs)
    ├── keywords.json            # Output SCOUT
    ├── articles.json            # Output CREATOR
    ├── prices.json              # Output PRICE UPDATER
    ├── analytics.json           # Output TRACKER
    └── revenue.json             # Output REVENUE
```

### Repo 2 : homeoffice-site (Astro)
```
homeoffice-site/
├── src/
│   ├── layouts/
│   │   ├── Base.astro           # Layout principal (nav + footer)
│   │   └── BestOf.astro         # Layout pages comparatifs
│   ├── components/
│   │   ├── ProductCard.astro    # Carte produit avec lien affilié
│   │   ├── PriceDisplay.astro   # Prix temps réel depuis prices.json
│   │   └── TableOfContents.astro
│   ├── pages/
│   │   ├── index.astro          # Homepage
│   │   ├── best-standing-desks.astro
│   │   ├── best-ergonomic-chairs.astro
│   │   ├── budget-home-office-setup.astro
│   │   ├── home-office-setup.astro  # Guide complet
│   │   ├── affiliate-disclosure.astro
│   │   ├── privacy.astro
│   │   └── sitemap.astro
│   └── styles/global.css
├── public/
│   ├── robots.txt
│   └── favicon.svg
├── astro.config.mjs             # @astrojs/sitemap configuré
├── tailwind.config.mjs
└── vercel.json
```

---

## 🎨 Design System — "Warm Oak"

Palette Tailwind configurée dans `tailwind.config.mjs` :
```js
colors: {
  oak: { 50: '#faf6f0', 100: '#f0e8d8', 200: '#ddd0b8', ... },
  ink: { DEFAULT: '#1a1a18', soft: '#3d3d38', muted: '#6b6b63' },
  accent: '#b45309',  // amber-700
}
fonts: {
  display: ['Playfair Display', 'serif'],
  body: ['Inter', 'sans-serif'],
}
```

Classes utilitaires clés :
- `font-display` → Playfair Display
- `text-ink` / `text-ink-soft` / `text-ink-muted`
- `text-accent` → couleur CTA (amber)
- `bg-oak-50` → fond chaud

---

## 🔗 Liens affiliés Amazon — PROBLÈME CONNU

**Bug actuel :** Les liens produits dans les pages manuelles pointent vers des ASINs fictifs qui donnent des 404.

**Format correct d'un lien affilié Amazon FR :**
```
https://www.amazon.fr/dp/{ASIN}?tag=zeroalc-21
```

**Tag affilié :** `zeroalc-21`

**Action requise :** Remplacer tous les ASINs fictifs par de vrais ASINs Amazon FR vérifiés.

Pages concernées :
- `src/pages/best-standing-desks.astro`
- `src/pages/best-ergonomic-chairs.astro`
- `src/pages/budget-home-office-setup.astro`
- `src/pages/home-office-setup.astro`

**Méthode :** Chercher les vrais ASINs sur amazon.fr en recherchant chaque produit, copier l'ASIN depuis l'URL (`/dp/XXXXXXXXXX/`).

---

## 💰 Amazon Associates

- **Tag :** `zeroalc-21`
- **Compte :** actif (affiliate-program.amazon.fr)
- **PA-API :** credentials disponibles mais accès bloqué (besoin 3 ventes qualifiées)
- **PA-API Access Key :** `AKPA5ZKBUX1771798398`
- **Marketplace :** amazon.fr (FR)
- **Mode actuel :** Mock (prix hardcodés) — prix réels après 3 ventes

**Commissions par catégorie :**
- Bureaux assis-debout : 6%
- Moniteurs : 2.5%
- Chaises, accessoires : 4%

---

## ⚙️ GitHub Secrets configurés (repo HomeOffice)

| Secret | Statut | Usage |
|--------|--------|-------|
| `GH_PAT` | ✅ | Push vers HomeOffice-Site |
| `ANTHROPIC_API_KEY` | ✅ | Agents CREATOR, SCOUT |
| `AFFILIATE_TAG` | ✅ | `zeroalc-21` |
| `AMAZON_ACCESS_KEY` | ✅ | PA-API (bloqué 403) |
| `AMAZON_SECRET_KEY` | ✅ | PA-API (bloqué 403) |
| `VERCEL_DEPLOY_HOOK` | ✅ | Trigger redéploiement |
| `PINTEREST_ACCESS_TOKEN` | ❌ | En attente approbation |
| `DISCORD_WEBHOOK_URL` | ❌ | Optionnel |
| `OPENAI_API_KEY` | ❌ | Optionnel (DALL-E images) |

---

## 📅 Planning automatique (GitHub Actions)

| Heure (UTC) | Agent | Action |
|-------------|-------|--------|
| Lun 00h | SCOUT | Analyse GSC + priorité keywords REVENUE |
| Lun 02h | CREATOR | Génère articles SEO via Anthropic |
| Lun 03h30 | PRICE UPDATER | Màj prix via PA-API → prices.json |
| Lun 04h | BUILDER | Génère pages Astro + commit + Vercel deploy |
| Mar-Dim 09h | PUBLISHER | Publie pins Pinterest |
| Ven 18h | TRACKER | Collecte analytics Pinterest + GSC |
| Ven 19h | REVENUE | Calcule RPM, tiers S/A/B/C/D, boost SCOUT |

---

## 📊 Agent REVENUE — Logique de tiers

```
Tier S : RPM ≥ 5€/1000 impressions → SCOUT priorité HIGH forcée
Tier A : RPM ≥ 2€                   → SCOUT priorité HIGH
Tier B : RPM ≥ 0.5€                 → SCOUT priorité MEDIUM
Tier C : RPM ≥ 0.1€                 → SCOUT priorité LOW
Tier D : RPM < 0.1€                 → SCOUT priorité LOW, abandon candidat
```

---

## 🔧 Stack technique

- **Frontend :** Astro 4.x + Tailwind CSS + Vanilla JS
- **Hosting :** Vercel (auto-deploy sur push main)
- **Agents :** Node.js 22 + GitHub Actions
- **AI :** Anthropic Claude (CREATOR, SCOUT) 
- **Pinterest API :** v5 (accès en attente approbation développeur)
- **Amazon :** PA-API v5 avec signature AWS v4 manuelle

---

## ✅ État actuel du projet

### Terminé
- [x] 7 agents codés et workflows configurés
- [x] Site Astro avec design "Warm Oak"
- [x] Pages : homepage, best-standing-desks, best-ergonomic-chairs, budget, home-office-setup, affiliate-disclosure, privacy
- [x] Composants : ProductCard, PriceDisplay, TableOfContents
- [x] Sitemap XML + robots.txt
- [x] Push GitHub (2 repos)
- [x] Vercel déployé et live
- [x] 6/9 secrets GitHub configurés

### En cours / À faire
- [ ] **Corriger les ASINs fictifs** → vrais ASINs Amazon FR (PRIORITÉ)
- [ ] Construire pages manquantes : `/about`, `/guides/ergonomie-bureau`, `/guides/lumiere-naturelle`
- [ ] Attendre approbation Pinterest Developer → configurer `PINTEREST_ACCESS_TOKEN`
- [ ] Attendre 3 ventes → débloquer PA-API (prix temps réel)
- [ ] Configurer domaine `homeofficesetup.pro` sur Vercel
- [ ] Premier run complet pipeline agents

---

## 🚀 Prochaines actions immédiates

1. **Corriger les ASINs** dans toutes les pages (recherche manuelle sur amazon.fr)
2. **Construire `/about`** et pages guides
3. **Setup domaine** homeofficesetup.pro sur Vercel
4. **Attendre Pinterest** approval puis configurer PUBLISHER

---

## 📝 Notes pour Claude Code

- Les workflows GitHub Actions sont dans `homeoffice-affiliate/.github/workflows/`
- Le BUILDER génère des pages dans `homeoffice-site/src/pages/generated/` (dossier créé au runtime)
- `prices.json` est lu au build Astro — si absent, PriceDisplay affiche le fallback
- Toujours utiliser `tag=zeroalc-21` dans les liens Amazon
- Le design utilise exclusivement les classes Tailwind du thème "Warm Oak" — ne pas sortir de cette palette

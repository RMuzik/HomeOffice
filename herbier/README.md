# Mon Herbier — PWA botanique

Carnet personnel pour répertorier ses observations de flore (alpine et autre).
Stack : **React + Vite + Firebase** (Auth Google, Firestore, Storage), installable
en PWA sur mobile et desktop.

## Fonctionnalités

- Connexion Google (Firebase Auth)
- CRUD complet des fiches (ajouter / modifier / supprimer)
- Upload photo avec compression côté client (≤ 1200 px, JPEG 80 %)
- Stockage des photos sur Firebase Storage, URL persistée dans Firestore
- Galerie filtrable (famille, massif, habitat, recherche plein texte)
- Fiche détail (modal)
- Mode hors-ligne (cache IndexedDB Firestore + Service Worker pour les photos)
- PWA installable (manifest + service worker via `vite-plugin-pwa`)
- UI botanique vintage sépia (esthétique reprise du JSX d'origine)

## Démarrage

```bash
cd herbier
cp .env.example .env
# remplir les 6 valeurs VITE_FIREBASE_* depuis la console Firebase
npm install
npm run dev
```

Build production :

```bash
npm run build
npm run preview
```

## Configuration Firebase

1. Créer un projet sur <https://console.firebase.google.com/>.
2. **Authentication** → activer le provider **Google**.
3. **Firestore Database** → créer une base (mode production).
4. **Storage** → activer.
5. **Project settings** → ajouter une app Web → copier la config dans `.env`.
6. **Authorized domains** (Auth) → ajouter le domaine de déploiement.

### Règles de sécurité

Déposer `firestore.rules` et `storage.rules` puis :

```bash
firebase deploy --only firestore:rules,storage
```

Les règles imposent qu'un utilisateur ne puisse lire/écrire que sous
`users/{son uid}/…` — isolation stricte par compte.

## Structure des données

### Firestore

```
users/{uid}/fleurs/{fleurId}
  ├── nom              string
  ├── nomLatin         string
  ├── famille          string
  ├── lieu             string
  ├── massif           string
  ├── mois             string ("1".."12")
  ├── annee            number
  ├── etage            string
  ├── habitat          string[]
  ├── specificites     string
  ├── photo            string|null   (downloadURL)
  ├── photoPath        string|null   (chemin Storage, sert au delete)
  ├── createdAt        Timestamp
  └── updatedAt        Timestamp
```

### Storage

```
users/{uid}/herbier/{timestamp}-{random}.jpg
```

## Déploiement

L'app est statique après build (`dist/`) — déployable sur Vercel, Netlify,
Firebase Hosting, ou tout CDN. Ne pas oublier d'ajouter le domaine de prod
aux **Authorized domains** de Firebase Auth.

## Icônes PWA

`public/icon.svg` est utilisé par le manifest. Pour une compatibilité totale
(stores PWA, Android), générer également des PNG 192/512 :

```bash
npx pwa-asset-generator public/icon.svg public --icon-only --background "#3a2e1e"
```

et ajouter `icon-192.png` / `icon-512.png` à côté de `icon.svg`.

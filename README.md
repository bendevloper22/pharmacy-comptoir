# Fiche Comptoir — Next.js + SQLite (libSQL / Turso)

Nomenclature nationale des produits pharmaceutiques (Algérie, version août 2026),
servie par une vraie base **SQLite côté serveur** via **Next.js** (App Router) et
**@libsql/client**. Favoris, statut Chifa, ruptures de stock et notes personnelles
sont de vraies lignes en base — pas du `localStorage`.

## Pourquoi @libsql/client

Le même code fonctionne dans deux configurations, sans rien changer :

- **En local (ou sur un serveur avec disque)** : `@libsql/client` écrit dans un
  simple fichier `data/pharmacy.db`. Zéro compte, zéro configuration.
- **Déployé sur Vercel (ou tout hébergeur "serverless")** : en définissant les
  variables d'environnement `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN`, exactement
  le même code se connecte à une base **Turso** hébergée (service géré,
  compatible SQLite) au lieu du fichier local. C'est la seule différence.

Tout le SQL (`lib/products.js`, les routes `app/api/*`) est identique dans les
deux cas.

## Installation en local

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
cd pharmacy-app
npm install       # télécharge Next.js, React, @libsql/client...
npm run seed      # construit data/pharmacy.db à partir des fichiers officiels
npm run dev       # démarre le serveur de développement
```

Ouvrez ensuite **http://localhost:3000**.

`npm run dev` reconstruit automatiquement la base si `data/pharmacy.db`
n'existe pas encore.

## Déployer en ligne (accès depuis votre téléphone) — voir DEPLOY.md

En résumé : créez une base gratuite sur [turso.tech](https://turso.tech),
définissez `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` sur Vercel, lancez
`npm run seed` une fois en pointant vers Turso, puis déployez normalement.
Détails complets dans `DEPLOY.md`.

## Structure du projet

```
app/
  page.js              — l'interface (recherche, onglets, filtres, favoris...)
  layout.js, globals.css
  api/
    products/route.js     — GET  recherche + filtres
    equivalents/route.js  — GET  produits partageant la même DCI
    favorites/route.js    — POST bascule un favori
    chifa/route.js        — POST fait avancer le statut Chifa
    rupture/route.js      — POST bascule rupture de stock
    notes/route.js        — POST enregistre une note
    meta/route.js         — GET  compteurs par onglet + familles
    subfamilies/route.js  — GET  sous-familles d'une famille donnée
    recent/route.js       — GET/POST recherches récentes
lib/
  db.js         — connexion @libsql/client (fichier local ou Turso)
  products.js   — requêtes SQL partagées, 100% async
  labels.js     — libellés des familles, listes, cibles
scripts/
  seed-db.mjs   — (re)construit la base depuis data/seed/*.json
data/
  seed/*.json   — catalogue officiel déjà nettoyé (source : Ministère de
                  l'Industrie Pharmaceutique, nomenclature août 2026)
  pharmacy.db   — généré par `npm run seed` en local (pas versionné dans git)
```

## Recherche multiple et autocomplétion

- **🔎 Recherche multiple** : collez les médicaments d'une ordonnance (un par ligne
  ou séparés par des virgules) ; chaque nom obtient sa propre section de résultats.
- **Autocomplétion** dans la barre de recherche *et* dans la zone de recherche
  multiple : suggestions en direct (marques d'abord, puis quelques DCI, les noms les
  plus courts en premier). Flèches ↑/↓ + Entrée (ou Tab) pour choisir, Échap pour
  fermer. Dans la zone multiple, seul le nom en cours de saisie est remplacé — les
  autres lignes / éléments séparés par des virgules ne sont pas touchés.
  Endpoint : `GET /api/suggest?tab=...&q=...`.

## Non repris dans cette version

Le comparateur côte-à-côte et l'export/import manuel en `.zip` — moins
utiles maintenant qu'il y a un vrai serveur partagé, mais faisables si vous
les voulez, dites-le-moi.

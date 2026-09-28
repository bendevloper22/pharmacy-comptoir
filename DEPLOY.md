# Déployer en ligne (accès depuis votre téléphone)

Grâce à `@libsql/client`, aucun changement de code n'est nécessaire — juste
une base Turso et deux variables d'environnement.

## 1. Créer une base Turso (gratuite)

```bash
npm install -g @tursodatabase/cli   # ou : curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup                   # ou "turso auth login" si vous avez déjà un compte
turso db create pharmacy-comptoir
turso db show pharmacy-comptoir --url          # → TURSO_DATABASE_URL
turso db tokens create pharmacy-comptoir       # → TURSO_AUTH_TOKEN
```

(Vous pouvez aussi faire tout ça depuis l'interface web sur turso.tech, sans CLI.)

## 2. Charger les données dans Turso

En local, dans le dossier du projet :

```bash
export TURSO_DATABASE_URL="libsql://pharmacy-comptoir-xxxx.turso.io"
export TURSO_AUTH_TOKEN="eyJ..."
npm run seed
```

Ceci construit les tables et charge le catalogue directement dans Turso (pas
dans le fichier local, puisque `TURSO_DATABASE_URL` est défini).

## 3. Déployer sur Vercel

1. Poussez ce projet sur un dépôt GitHub.
2. Sur [vercel.com](https://vercel.com), "New Project" → importez le dépôt.
3. Dans les paramètres du projet, section **Environment Variables**, ajoutez :
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
4. Déployez. Vercel utilise automatiquement `npm run build` (donc
   `prebuild` ne tentera pas de recréer un fichier local — il regarde
   `TURSO_DATABASE_URL` et ne touche à rien si elle est définie).
5. Vous obtenez une URL `https://....vercel.app`, accessible depuis votre
   téléphone comme n'importe quel site.

## Redéploiements suivants

Chaque déploiement sur Vercel relance `npm run build`, qui déclenche
automatiquement le script de seed (`prebuild`). Il est protégé : s'il détecte
que la base Turso contient déjà des produits, il ne touche à rien — vos
favoris, statuts Chifa, notes et ruptures survivent aux redéploiements normaux.
Pour forcer un rechargement complet du catalogue (par exemple après une mise à
jour de la nomenclature officielle) : `npm run seed -- --force` en pointant
vers Turso — attention, ça efface aussi les favoris/Chifa/notes/ruptures.

## Garder le développement local ET la version en ligne

Ne définissez **pas** `TURSO_DATABASE_URL` dans votre `.env.local` — comme ça,
`npm run dev` en local continue d'utiliser le fichier `data/pharmacy.db`
(rapide, hors-ligne, aucun compte requis), pendant que Vercel utilise Turso
via ses propres variables d'environnement. Les deux sont indépendants : vos
favoris/Chifa/notes en local ne sont pas les mêmes que ceux de la version en
ligne, sauf si vous pointez volontairement le local vers Turso aussi.

## Alternative sans Turso : un hébergeur avec disque persistant

Si vous préférez éviter un service tiers, **Railway** ou **Render** font
tourner l'app comme un vrai petit serveur avec un disque qui persiste — le
fichier `data/pharmacy.db` local fonctionne alors tel quel, sans Turso ni
variables d'environnement. Build : `npm install && npm run build`. Start :
`npm run start`. Ajoutez juste un volume persistant monté sur `data/`.

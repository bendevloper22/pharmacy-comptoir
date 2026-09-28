// Builds the database (data/pharmacy.db locally, or a Turso database if
// TURSO_DATABASE_URL is set) from the JSON files in data/seed/.
// Run manually with `npm run seed`, or automatically before dev/build with
// --if-missing. Against a remote Turso database, re-seeding is additionally
// guarded by checking whether the `products` table already has rows — see
// the comment further down for why (short version: every Vercel deploy runs
// this script, and without the guard it would wipe user data on redeploy).
// Pass --force to rebuild a remote database anyway (destructive: wipes
// favoris/Chifa/notes/ruptures along with the catalog).

import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'pharmacy.db');
const SEED_DIR = path.join(DATA_DIR, 'seed');

const ifMissing = process.argv.includes('--if-missing');
const force = process.argv.includes('--force');
const usingRemote = !!process.env.TURSO_DATABASE_URL;

if (ifMissing && !usingRemote && fs.existsSync(DB_PATH)) {
  console.log('[seed] pharmacy.db already exists, skipping (run `npm run seed` to force a rebuild).');
  process.exit(0);
}

if (!usingRemote && fs.existsSync(DB_PATH)) {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = DB_PATH + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

const url = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function main() {
  console.log(`[seed] cible : ${usingRemote ? url : DB_PATH}`);

  // Vercel runs `npm run build` on every deploy, which triggers `prebuild`
  // (`node scripts/seed-db.mjs --if-missing`). Against a remote Turso database
  // there's no local file to check, so without this guard every redeploy would
  // silently DROP and rebuild every table below — wiping everyone's favoris,
  // statuts Chifa, notes and ruptures along with the catalog. Skip unless the
  // database is actually empty (first run) or --force was passed explicitly.
  if (usingRemote && !force) {
    try {
      const check = await db.execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='products'");
      const tableExists = Number(check.rows[0].n) > 0;
      if (tableExists) {
        const countRs = await db.execute('SELECT COUNT(*) AS n FROM products');
        if (Number(countRs.rows[0].n) > 0) {
          console.log('[seed] La base Turso contient déjà des produits — on ne touche à rien.');
          console.log('[seed] Pour forcer un rechargement complet (efface aussi favoris/Chifa/notes/ruptures) : npm run seed -- --force');
          return;
        }
      }
    } catch (e) {
      console.log('[seed] Impossible de vérifier l\u2019état de la base distante, on continue prudemment :', e.message);
    }
  }

  await db.executeMultiple(`
    DROP TABLE IF EXISTS variants;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS favorites;
    DROP TABLE IF EXISTS chifa;
    DROP TABLE IF EXISTS notes;
    DROP TABLE IF EXISTS rupture;
    DROP TABLE IF EXISTS recent_searches;

    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      tab TEXT NOT NULL,
      marque TEXT NOT NULL,
      dci TEXT NOT NULL,
      liste TEXT,
      type TEXT,
      cat TEXT,
      sub TEXT,
      subl TEXT,
      gender TEXT,
      UNIQUE(tab, marque, dci)
    );

    CREATE TABLE variants (
      id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      forme TEXT,
      dosage TEXT,
      conditionnement TEXT,
      laboratoire TEXT,
      motif TEXT,
      date_retrait TEXT
    );

    CREATE TABLE favorites (
      tab TEXT NOT NULL, marque TEXT NOT NULL, dci TEXT NOT NULL,
      PRIMARY KEY (tab, marque, dci)
    );
    CREATE TABLE chifa (
      tab TEXT NOT NULL, marque TEXT NOT NULL, dci TEXT NOT NULL, status TEXT NOT NULL,
      PRIMARY KEY (tab, marque, dci)
    );
    CREATE TABLE notes (
      tab TEXT NOT NULL, marque TEXT NOT NULL, dci TEXT NOT NULL, text TEXT NOT NULL,
      PRIMARY KEY (tab, marque, dci)
    );
    CREATE TABLE rupture (
      tab TEXT NOT NULL, marque TEXT NOT NULL, dci TEXT NOT NULL,
      PRIMARY KEY (tab, marque, dci)
    );
    CREATE TABLE recent_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX idx_products_tab ON products(tab);
    CREATE INDEX idx_products_dci ON products(dci);
    CREATE INDEX idx_products_marque ON products(marque);
    CREATE INDEX idx_products_cat ON products(cat);
    CREATE INDEX idx_variants_product ON variants(product_id);
  `);

  const files = [
    ['active', 'active.json'],
    ['nr', 'nr.json'],
    ['rt', 'rt.json'],
  ];

  let productId = 1;
  let variantId = 1;
  const BATCH_SIZE = 300;
  let batch = [];
  let totalProducts = 0;

  async function flush() {
    if (batch.length === 0) return;
    await db.batch(batch, 'write');
    batch = [];
  }

  for (const [tab, filename] of files) {
    const items = JSON.parse(fs.readFileSync(path.join(SEED_DIR, filename), 'utf-8'));
    for (const item of items) {
      const pid = productId++;
      batch.push({
        sql: `INSERT INTO products (id, tab, marque, dci, liste, type, cat, sub, subl, gender)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [pid, tab, item.m, item.d, item.l || null, item.t || null, item.cat || null, item.sub || null, item.subl || null, item.g || null],
      });
      for (const v of item.variants || []) {
        batch.push({
          sql: `INSERT INTO variants (id, product_id, forme, dosage, conditionnement, laboratoire, motif, date_retrait)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [variantId++, pid, v.f || null, v.do || null, v.c || null, v.lab || null, v.motif || null, v.date || null],
        });
      }
      if (batch.length >= BATCH_SIZE) await flush();
    }
    totalProducts += items.length;
    console.log(`[seed] ${tab}: ${items.length} produits`);
  }
  await flush();

  console.log(`[seed] Terminé — ${totalProducts} produits, ${variantId - 1} variantes.`);
}

main()
  .catch((err) => {
    console.error('[seed] Échec :', err);
    process.exit(1);
  })
  .finally(() => db.close());

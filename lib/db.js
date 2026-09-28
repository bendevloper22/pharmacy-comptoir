import { createClient } from '@libsql/client';
import path from 'path';

// Local dev (or any host with a persistent disk): a plain file, zero setup.
// Hosted on Vercel/serverless: set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) and
// the exact same code talks to a hosted libSQL (Turso) database instead —
// no other file in this project needs to change.
const globalForDb = globalThis;

export function getDb() {
  if (!globalForDb.__pharmacyDb) {
    const url =
      process.env.TURSO_DATABASE_URL ||
      `file:${path.join(process.cwd(), 'data', 'pharmacy.db')}`;
    const authToken = process.env.TURSO_AUTH_TOKEN; // undefined is fine for a local file: URL

    globalForDb.__pharmacyDb = createClient({ url, authToken });
  }
  return globalForDb.__pharmacyDb;
}

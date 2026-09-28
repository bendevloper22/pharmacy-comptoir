import { getDb } from '../../../lib/db';

export async function GET() {
  const db = getDb();
  const rs = await db.execute('SELECT query FROM recent_searches ORDER BY ts DESC LIMIT 8');
  return Response.json({ recent: rs.rows.map((r) => r.query) });
}

export async function POST(request) {
  const { query } = await request.json();
  const q = (query || '').trim();
  if (!q) return Response.json({ recent: [] });

  const db = getDb();
  await db.batch(
    [
      { sql: 'DELETE FROM recent_searches WHERE query = ? COLLATE NOCASE', args: [q] },
      { sql: 'INSERT INTO recent_searches (query, ts) VALUES (?, ?)', args: [q, Date.now()] },
      {
        sql: `DELETE FROM recent_searches WHERE id NOT IN (
                SELECT id FROM recent_searches ORDER BY ts DESC LIMIT 8
              )`,
        args: [],
      },
    ],
    'write'
  );

  const rs = await db.execute('SELECT query FROM recent_searches ORDER BY ts DESC LIMIT 8');
  return Response.json({ recent: rs.rows.map((r) => r.query) });
}

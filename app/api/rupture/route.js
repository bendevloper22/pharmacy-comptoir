import { getDb } from '../../../lib/db';

export async function POST(request) {
  const { tab, marque, dci } = await request.json();
  if (!tab || !marque || !dci) {
    return Response.json({ error: 'tab, marque et dci sont requis' }, { status: 400 });
  }
  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT 1 FROM rupture WHERE tab=? AND marque=? AND dci=?',
    args: [tab, marque, dci],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM rupture WHERE tab=? AND marque=? AND dci=?',
      args: [tab, marque, dci],
    });
    return Response.json({ isRupture: false });
  } else {
    await db.execute({
      sql: 'INSERT INTO rupture (tab, marque, dci) VALUES (?, ?, ?)',
      args: [tab, marque, dci],
    });
    return Response.json({ isRupture: true });
  }
}

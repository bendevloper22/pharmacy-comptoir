import { getDb } from '../../../lib/db';

const CYCLE = {
  'Non vérifié': 'Remboursable',
  'Remboursable': 'Non remboursable',
  'Non remboursable': 'Non vérifié',
};

export async function POST(request) {
  const { tab, marque, dci } = await request.json();
  if (!tab || !marque || !dci) {
    return Response.json({ error: 'tab, marque et dci sont requis' }, { status: 400 });
  }
  const db = getDb();
  const existing = await db.execute({
    sql: 'SELECT status FROM chifa WHERE tab=? AND marque=? AND dci=?',
    args: [tab, marque, dci],
  });
  const current = existing.rows.length ? existing.rows[0].status : 'Non vérifié';
  const next = CYCLE[current] || 'Non vérifié';

  if (next === 'Non vérifié') {
    await db.execute({
      sql: 'DELETE FROM chifa WHERE tab=? AND marque=? AND dci=?',
      args: [tab, marque, dci],
    });
  } else {
    await db.execute({
      sql: `
        INSERT INTO chifa (tab, marque, dci, status) VALUES (?, ?, ?, ?)
        ON CONFLICT(tab, marque, dci) DO UPDATE SET status = excluded.status
      `,
      args: [tab, marque, dci, next],
    });
  }
  return Response.json({ chifaStatus: next });
}

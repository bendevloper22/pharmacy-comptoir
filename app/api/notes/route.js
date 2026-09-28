import { getDb } from '../../../lib/db';

export async function POST(request) {
  const { tab, marque, dci, text } = await request.json();
  if (!tab || !marque || !dci) {
    return Response.json({ error: 'tab, marque et dci sont requis' }, { status: 400 });
  }
  const db = getDb();
  const trimmed = (text || '').trim();

  if (trimmed) {
    await db.execute({
      sql: `
        INSERT INTO notes (tab, marque, dci, text) VALUES (?, ?, ?, ?)
        ON CONFLICT(tab, marque, dci) DO UPDATE SET text = excluded.text
      `,
      args: [tab, marque, dci, text],
    });
  } else {
    await db.execute({
      sql: 'DELETE FROM notes WHERE tab=? AND marque=? AND dci=?',
      args: [tab, marque, dci],
    });
  }
  return Response.json({ note: trimmed });
}

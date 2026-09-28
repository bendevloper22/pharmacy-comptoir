import { getDb } from './db';

const VARIANTS_SUBQUERY = `
  (SELECT json_group_array(json_object(
      'forme', v.forme, 'dosage', v.dosage, 'conditionnement', v.conditionnement,
      'laboratoire', v.laboratoire, 'motif', v.motif, 'date_retrait', v.date_retrait
    ))
   FROM variants v WHERE v.product_id = p.id) AS variants_json
`;

const STATE_JOINS = `
  LEFT JOIN favorites f ON f.tab = p.tab AND f.marque = p.marque AND f.dci = p.dci
  LEFT JOIN chifa     c ON c.tab = p.tab AND c.marque = p.marque AND c.dci = p.dci
  LEFT JOIN rupture   r ON r.tab = p.tab AND r.marque = p.marque AND r.dci = p.dci
  LEFT JOIN notes     n ON n.tab = p.tab AND n.marque = p.marque AND n.dci = p.dci
`;

const SELECT_FIELDS = `
  p.id, p.tab, p.marque, p.dci, p.liste, p.type, p.cat, p.sub, p.subl, p.gender,
  CASE WHEN f.tab IS NOT NULL THEN 1 ELSE 0 END AS is_fav,
  COALESCE(c.status, 'Non vérifié') AS chifa_status,
  CASE WHEN r.tab IS NOT NULL THEN 1 ELSE 0 END AS is_rupture,
  n.text AS note,
  ${VARIANTS_SUBQUERY}
`;

function rowToProduct(row) {
  return {
    id: Number(row.id),
    tab: row.tab,
    marque: row.marque,
    dci: row.dci,
    liste: row.liste,
    type: row.type,
    cat: row.cat,
    sub: row.sub,
    subl: row.subl,
    gender: row.gender,
    isFav: !!row.is_fav,
    chifaStatus: row.chifa_status,
    isRupture: !!row.is_rupture,
    note: row.note || '',
    variants: row.variants_json ? JSON.parse(row.variants_json) : [],
  };
}

// tab === 'fav' is a virtual tab: favorites across every real tab.
export async function queryProducts({ tab, q, cat, sub, liste, gender, ruptureOnly, limit }) {
  const db = getDb();
  const qTrim = (q || '').trim();
  const qlike = `%${qTrim}%`;
  const catV = cat || '';
  const subV = sub || '';
  const listeV = liste || '';
  const genderV = gender || '';
  const ruptureV = ruptureOnly ? 1 : 0;
  const lim = Math.min(Number(limit) || 200, 1000);

  const tabClause = tab === 'fav' ? 'f.tab IS NOT NULL' : 'p.tab = ?';

  const sql = `
    SELECT ${SELECT_FIELDS}
    FROM products p
    ${STATE_JOINS}
    WHERE ${tabClause}
      AND (? = '' OR p.marque LIKE ? OR p.dci LIKE ?)
      AND (? = '' OR p.cat = ?)
      AND (? = '' OR p.sub = ?)
      AND (? = '' OR p.liste = ?)
      AND (? = '' OR p.gender = ?)
      AND (? = 0 OR r.tab IS NOT NULL)
    ORDER BY p.marque COLLATE NOCASE
    LIMIT ?
  `;

  const args = [];
  if (tab !== 'fav') args.push(tab);
  args.push(
    qTrim, qlike, qlike,
    catV, catV,
    subV, subV,
    listeV, listeV,
    genderV, genderV,
    ruptureV,
    lim
  );

  const rs = await db.execute({ sql, args });
  return rs.rows.map(rowToProduct);
}

export async function queryEquivalents(dci) {
  const db = getDb();
  const sql = `
    SELECT ${SELECT_FIELDS}
    FROM products p
    ${STATE_JOINS}
    WHERE p.tab = 'active' AND p.dci = ? COLLATE NOCASE
    ORDER BY p.marque COLLATE NOCASE
  `;
  const rs = await db.execute({ sql, args: [dci] });
  return rs.rows.map(rowToProduct);
}

export async function countByTab() {
  const db = getDb();
  const rs = await db.execute('SELECT tab, COUNT(*) AS n FROM products GROUP BY tab');
  const counts = { active: 0, nr: 0, rt: 0 };
  for (const r of rs.rows) counts[r.tab] = Number(r.n);
  const favRs = await db.execute('SELECT COUNT(*) AS n FROM favorites');
  counts.fav = Number(favRs.rows[0].n);
  return counts;
}

export async function categoryList() {
  const db = getDb();
  const rs = await db.execute(`
    SELECT cat, COUNT(*) AS n FROM products
    WHERE cat IS NOT NULL AND cat != '' GROUP BY cat ORDER BY cat
  `);
  return rs.rows.map(r => ({ cat: r.cat, n: Number(r.n) }));
}

export async function suggestTerms({ tab, q, limit }) {
  const db = getDb();
  const term = (q || '').trim();
  if (!term) return [];
  const prefix = `${term}%`;
  const lim = Math.min(Number(limit) || 8, 20);
  // Mostly brand names (what people type), plus a few DCIs. Shortest match first,
  // since the official DCI strings can be very long.
  const brandLim = Math.ceil(lim * 0.625);
  const dciLim = Math.max(lim - brandLim, 1);

  const sql = `
    SELECT label, kind FROM (
      SELECT label, kind, 0 AS grp FROM (
        SELECT DISTINCT marque AS label, 'marque' AS kind FROM products
        WHERE tab = ? AND marque LIKE ?
        ORDER BY length(label), label COLLATE NOCASE
        LIMIT ?
      )
      UNION ALL
      SELECT label, kind, 1 AS grp FROM (
        SELECT DISTINCT dci AS label, 'dci' AS kind FROM products
        WHERE tab = ? AND dci LIKE ?
        ORDER BY length(label), label COLLATE NOCASE
        LIMIT ?
      )
    )
    ORDER BY grp, length(label), label COLLATE NOCASE
  `;
  const rs = await db.execute({ sql, args: [tab, prefix, brandLim, tab, prefix, dciLim] });
  return rs.rows.map(r => ({ label: r.label, kind: r.kind }));
}

export async function subfamilyList(cat) {
  const db = getDb();
  const rs = await db.execute({
    sql: `
      SELECT DISTINCT sub, subl FROM products
      WHERE cat = ? AND sub IS NOT NULL AND sub != '' ORDER BY subl COLLATE NOCASE
    `,
    args: [cat],
  });
  return rs.rows.map(r => ({ sub: r.sub, subl: r.subl }));
}

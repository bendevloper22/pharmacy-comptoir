import { queryProducts } from '../../../lib/products';

export async function POST(request) {
  const { terms, tab } = await request.json();
  const list = Array.isArray(terms) ? terms : [];
  const cleaned = [...new Set(list.map((t) => (t || '').trim()).filter(Boolean))].slice(0, 30);

  if (cleaned.length === 0) return Response.json({ results: [] });

  try {
    const results = await Promise.all(
      cleaned.map(async (term) => {
        const products = await queryProducts({ tab: tab || 'active', q: term, limit: 8 });
        return { term, products };
      })
    );
    return Response.json({ results });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

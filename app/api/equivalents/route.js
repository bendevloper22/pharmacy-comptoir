import { queryEquivalents } from '../../../lib/products';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dci = searchParams.get('dci') || '';
  if (!dci) return Response.json({ products: [] });
  try {
    const products = await queryEquivalents(dci);
    return Response.json({ products });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

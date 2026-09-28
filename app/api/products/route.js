import { queryProducts } from '../../../lib/products';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  try {
    const products = await queryProducts({
      tab: searchParams.get('tab') || 'active',
      q: searchParams.get('q') || '',
      cat: searchParams.get('cat') || '',
      sub: searchParams.get('sub') || '',
      liste: searchParams.get('liste') || '',
      gender: searchParams.get('gender') || '',
      ruptureOnly: searchParams.get('rupture') === '1',
      limit: searchParams.get('limit') || 200,
    });
    return Response.json({ products });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

import { suggestTerms } from '../../../lib/products';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'active';
  const q = searchParams.get('q') || '';
  if (!q.trim()) return Response.json({ suggestions: [] });
  try {
    // 'fav' is a virtual tab; suggest from the real catalog instead.
    const suggestions = await suggestTerms({ tab: tab === 'fav' ? 'active' : tab, q, limit: 8 });
    return Response.json({ suggestions });
  } catch (err) {
    console.error(err);
    return Response.json({ suggestions: [] });
  }
}

import { subfamilyList } from '../../../lib/products';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cat = searchParams.get('cat') || '';
  if (!cat) return Response.json({ subfamilies: [] });
  const rows = (await subfamilyList(cat)).map((r) => ({ code: r.sub, label: r.subl }));
  return Response.json({ subfamilies: rows });
}

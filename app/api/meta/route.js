import { countByTab, categoryList } from '../../../lib/products';
import { CAT_LABELS } from '../../../lib/labels';

export async function GET() {
  const counts = await countByTab();
  const cats = (await categoryList()).map((c) => ({
    code: c.cat,
    label: CAT_LABELS[c.cat] || c.cat,
    count: c.n,
  }));
  return Response.json({ counts, categories: cats });
}

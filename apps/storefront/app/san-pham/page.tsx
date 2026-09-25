import { CatalogExplorer } from '../components/catalog-view';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return <div className="container"><CatalogExplorer initialQuery={params.toString()} /></div>;
}

import { ProductDetail } from '../../components/product-detail';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params;
  return <ProductDetail handle={handle} />;
}

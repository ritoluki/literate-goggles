import test from 'node:test';
import assert from 'node:assert/strict';

test('P0 fixture contract keeps VND amounts as integer values', async () => {
  const fixture = await import('../../fixtures/catalog.seed.json', { with: { type: 'json' } });
  const products = fixture.default.products ?? fixture.default;
  assert.ok(Array.isArray(products));
  let excludedWithoutPrice = 0;
  for (const product of products.filter((item) => item.status === 'published')) {
    assert.ok(Array.isArray(product.variants));
    for (const variant of product.variants) {
      if (variant.priceVnd === null) { excludedWithoutPrice += 1; continue; }
      assert.equal(Number.isInteger(variant.priceVnd), true);
    }
  }
  assert.ok(excludedWithoutPrice > 0, 'fixture should cover published products without a price');
});

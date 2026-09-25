import { safeProductImageUrl } from '../../src/products/images'

describe('product image URL safety', () => {
  it('keeps safe raster image URLs and drops unsafe or unsupported media', () => {
    expect(safeProductImageUrl('https://cdn.example.test/item.webp?size=800')).toBe('https://cdn.example.test/item.webp?size=800')
    expect(safeProductImageUrl('https://cdn.example.test/item.svg')).toBeNull()
    expect(safeProductImageUrl('https://cdn.example.test/item.svg?format=png')).toBeNull()
    expect(safeProductImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeProductImageUrl('https://user:password@cdn.example.test/item.jpg')).toBeNull()
    expect(safeProductImageUrl('https://cdn.example.test/item.exe')).toBeNull()
    expect(safeProductImageUrl('not a URL')).toBeNull()
    expect(safeProductImageUrl('https://cdn.example.test/' + 'x'.repeat(2048))).toBeNull()
  })
})

import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.APP_MODE !== 'live' || process.env.ROBOTS_INDEXING_ALLOWED !== 'true') return []
  const siteUrl = process.env.SITE_URL
  if (!siteUrl) return []
  let origin: URL
  try { origin = new URL(siteUrl) } catch { return [] }
  if (origin.protocol !== 'https:' || origin.username || origin.password) return []
  return ['', '/san-pham', '/chinh-sach'].map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
  }))
}

import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const indexAllowed = process.env.APP_MODE === 'live' &&
    process.env.ROBOTS_INDEXING_ALLOWED === 'true'
  if (!indexAllowed) return { rules: { userAgent: '*', disallow: '/' } }
  const siteUrl = process.env.SITE_URL
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(siteUrl ? { sitemap: new URL('/sitemap.xml', siteUrl).toString() } : {}),
  }
}

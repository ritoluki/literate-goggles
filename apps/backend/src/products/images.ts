const RASTER_IMAGE = /\.(?:avif|gif|jpe?g|png|webp)$/i

export function safeProductImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      !RASTER_IMAGE.test(url.pathname)) return null
    return url.toString()
  } catch { return null }
}

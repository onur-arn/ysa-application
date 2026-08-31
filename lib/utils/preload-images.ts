const cache = new Set<string>()

export function preloadImages(urls: string[]) {
  for (const url of urls) {
    if (!url || cache.has(url)) continue
    cache.add(url)
    const img = new Image()
    img.decoding = "async"
    img.src = url
  }
}

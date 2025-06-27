// Утилита для извлечения первой ссылки из HTML/текста
function extractFirstLink(html) {
  if (!html) return null
  const match = html.match(/<a [^>]*href=["']([^"']+)["'][^>]*>/i)
  return match ? match[1] : null
}

module.exports = extractFirstLink

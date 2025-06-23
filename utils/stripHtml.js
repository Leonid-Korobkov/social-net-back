/**
 * Функция для очистки HTML от тегов и получения только текста
 * @param html HTML-строка для обработки
 * @returns Очищенный текст
 */
export function stripHtml(html) {
  // Если пришла пустая строка или не строка, возвращаем пустую строку
  if (!html || typeof html !== 'string') return ''

  // Заменяем тег <p> и </p> на перевод строки
  let text = html.replace(/<\/?p>/g, '\n').replace(/<p [^>]*>/g, '\n')

  // Заменяем горизонтальные линии на строку из дефисов
  text = text.replace(/<hr[^>]*>/g, '\n-----------------\n')

  // Заменяем заголовки на текст с переводом строки
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, '$1\n')

  // Заменяем списки на текст с маркерами
  text = text.replace(/<li[^>]*>(.*?)<\/li>/g, '• $1\n')

  // Обрабатываем контейнеры списков
  text = text.replace(/<\/?ul[^>]*>/g, '\n').replace(/<\/?ol[^>]*>/g, '\n')

  // Заменяем блоки кода
  text = text.replace(/<pre[^>]*>(.*?)<\/pre>/g, 'Код: $1\n')

  // Обрабатываем теги для форматирования текста
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/g, '*$1*')
  text = text.replace(/<b[^>]*>(.*?)<\/b>/g, '*$1*')
  text = text.replace(/<em[^>]*>(.*?)<\/em>/g, '_$1_')
  text = text.replace(/<i[^>]*>(.*?)<\/i>/g, '_$1_')
  text = text.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')

  // Заменяем блоки цитат
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/g, '> $1\n')

  // Обрабатываем теги изображений
  text = text.replace(/<img [^>]*alt="([^"]*)"[^>]*>/g, '[Изображение: $1]')
  text = text.replace(/<img [^>]*>/g, '[Изображение]')

  // Обрабатываем теги ссылок
  text = text.replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2 ($1)')

  // Удаляем все остальные HTML-теги
  text = text.replace(/<[^>]*>/g, '')

  // Заменяем HTML-сущности на соответствующие символы
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')

  // Удаляем лишние переводы строк и пробелы
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  // Убираем множественные пробелы
  text = text.replace(/ {2,}/g, ' ')

  return text
}

/**
 * Проверяет, что пост не пустой: либо есть текст, либо есть медиа
 * @param html HTML-строка
 * @param mediaUrls массив ссылок на медиа
 */
export function isPostEmpty(html, mediaUrls) {
  const text = stripAllHtmlTags(html).trim()
  return !text && mediaUrls.length === 0
}

/**
 * Удаляет все HTML-теги, не заменяя их на текст, возвращает только "сырой" текст
 * @param html HTML-строка для обработки
 * @returns Очищенный текст
 */
export function stripAllHtmlTags(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

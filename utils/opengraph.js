const ogs = require('open-graph-scraper')
const axios = require('axios')

async function fetchOpenGraphData(url) {
  if (!url) return null

  // YouTube обработка
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/
  )
  if (youtubeMatch) {
    const videoId = youtubeMatch[1]
    let ytTitle = ''
    let ytDescription = ''
    let youtubesrcurl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    const apiKey = process.env.YOUTUBE_API_KEY
    if (apiKey) {
      const ytApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
      try {
        const ytRes = await axios.get(ytApiUrl)
        const ytData = ytRes.data
        if (ytData.items && ytData.items.length > 0) {
          ytTitle = ytData.items[0].snippet.title
          ytDescription = ytData.items[0].snippet.description
        }
      } catch (e) {}
    }
    return {
      ogImageUrl: youtubesrcurl,
      ogTitle: ytTitle,
      ogDescr: ytDescription,
      ogUrl: url
    }
  }

  // Обычный OG
  try {
    const { result } = await ogs({ url, timeout: 7000 })
    return {
      ogImageUrl: result.ogImage[0]?.url || result.ogImage || null,
      ogTitle: result.ogTitle || null,
      ogDescr: result.ogDescription || null,
      ogUrl: result.ogUrl || url || null
    }
  } catch (e) {
    return null
  }
}

module.exports = fetchOpenGraphData

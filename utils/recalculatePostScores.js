const { prisma } = require('../prisma/prisma-client')
const cron = require('node-cron')

const BATCH_SIZE = 500

async function recalculateScores () {
  let skip = 0
  let totalProcessed = 0
  const now = new Date()

  while (true) {
    const posts = await prisma.post.findMany({
      skip,
      take: BATCH_SIZE,
      select: {
        id: true,
        likeCount: true,
        viewCount: true,
        commentCount: true,
        shareCount: true,
        createdAt: true,
        authorId: true
      }
    })
    if (posts.length === 0) break

    const authorIds = posts.map(p => p.authorId)
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, followers: true }
    })
    const authorFollowers = Object.fromEntries(
      authors.map(a => [a.id, a.followers.length])
    )

    // Получаем все взаимные подписки между авторами этого батча
    const follows = await prisma.follows.findMany({
      where: {
        OR: [
          { followerId: { in: authorIds }, followingId: { in: authorIds } },
          { followerId: { in: authorIds }, followingId: { in: authorIds } }
        ]
      }
    })
    const mutuals = new Set()
    follows.forEach(f => {
      if (
        follows.some(
          f2 =>
            f2.followerId === f.followingId && f2.followingId === f.followerId
        )
      ) {
        mutuals.add(`${f.followerId}_${f.followingId}`)
        mutuals.add(`${f.followingId}_${f.followerId}`)
      }
    })

    await Promise.all(
      posts.map(async post => {
        const daysAgo = Math.floor(
          (now - post.createdAt) / (1000 * 60 * 60 * 24)
        )
        const freshness = Math.max(0, 30 - daysAgo) * 3
        const followers = authorFollowers[post.authorId] || 0
        const isMutual = mutuals.has(`${post.authorId}_${post.authorId}`)
        const score =
          (post.likeCount || 0) * 3 +
          (post.viewCount || 0) * 1 +
          (post.commentCount || 0) * 2 +
          (post.shareCount || 0) * 2 +
          followers * 2 +
          (isMutual ? 5 : 0) +
          freshness
        await prisma.post.update({
          where: { id: post.id },
          data: {
            score,
            updatedScoreAt: new Date()
          }
        })
        console.log(`Post ${post.id} score updated: ${score}`)
      })
    )

    skip += BATCH_SIZE
    totalProcessed += posts.length
    console.log(`Batch processed: ${totalProcessed}`)
  }
  await prisma.$disconnect()
}

// Если файл запущен напрямую, запускаем cron
// if (require.main === module) {
//   cron.schedule('*/30 * * * *', async () => {
//     console.log('Запуск пересчёта score для всех постов (cron)')
//     try {
//       await recalculateScores()
//       console.log('Пересчёт завершён')
//     } catch (e) {
//       console.error('Ошибка при пересчёте:', e)
//     }
//   })
//   console.log('node-cron: задача для пересчёта score запущена')
// }

function startScoreRecalculationCron () {
  startCronTask()
  cron.schedule('*/30 * * * *', startCronTask)
  console.log('node-cron: задача для пересчёта score запущена')
}

async function startCronTask () {
  console.log('Запуск пересчёта score для всех постов (cron)')
  try {
    await recalculateScores()
    console.log('Пересчёт завершён')
  } catch (e) {
    console.error('Ошибка при пересчёте:', e)
  }
}

module.exports = { recalculateScores, startScoreRecalculationCron }

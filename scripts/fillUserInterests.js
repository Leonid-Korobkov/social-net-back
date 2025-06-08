const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Веса для различных действий
const ACTION_WEIGHTS = {
  POST_CREATION: 1.0,    // Создание поста
  LIKE: 0.8,            // Лайк поста
  COMMENT: 0.7,         // Комментарий к посту
  VIEW: 0.3,            // Просмотр поста
  SHARE: 0.9,           // Репост поста
  COMMENT_LIKE: 0.4,    // Лайк комментария
}

async function fillUserInterests() {
  try {
    console.log('Начинаем заполнение интересов пользователей...')

    // Получаем всех пользователей
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userName: true,
      },
    })

    console.log(`Найдено ${users.length} пользователей`)

    for (const user of users) {
      console.log(`\nОбработка пользователя ${user.userName || user.id}...`)

      // Получаем все действия пользователя
      const [
        userPosts,
        userLikes,
        userComments,
        userViews,
        userShares,
        userCommentLikes
      ] = await Promise.all([
        // Посты пользователя
        prisma.post.findMany({
          where: { authorId: user.id },
          include: { categories: true },
        }),
        // Лайки пользователя
        prisma.like.findMany({
          where: { userId: user.id },
          include: {
            post: {
              include: { categories: true },
            },
          },
        }),
        // Комментарии пользователя
        prisma.comment.findMany({
          where: { userId: user.id },
          include: {
            post: {
              include: { categories: true },
            },
          },
        }),
        // Просмотры пользователя
        prisma.postView.findMany({
          where: { userId: user.id },
          include: {
            post: {
              include: { categories: true },
            },
          },
        }),
        // Репосты пользователя
        prisma.postShare.findMany({
          where: { userId: user.id },
          include: {
            post: {
              include: { categories: true },
            },
          },
        }),
        // Лайки комментариев пользователя
        prisma.commentLike.findMany({
          where: { userId: user.id },
          include: {
            comment: {
              include: {
                post: {
                  include: { categories: true },
                },
              },
            },
          },
        }),
      ])

      // Считаем вес категорий на основе действий
      const categoryWeights = {}
      let totalWeight = 0

      // Обработка постов
      userPosts.forEach(post => {
        post.categories.forEach(category => {
          const weight = ACTION_WEIGHTS.POST_CREATION * category.confidence
          categoryWeights[category.id] = (categoryWeights[category.id] || 0) + weight
          totalWeight += weight
        })
      })

      // Обработка лайков
      userLikes.forEach(like => {
        like.post.categories.forEach(category => {
          const weight = ACTION_WEIGHTS.LIKE * category.confidence
          categoryWeights[category.id] = (categoryWeights[category.id] || 0) + weight
          totalWeight += weight
        })
      })

      // Обработка комментариев
      userComments.forEach(comment => {
        comment.post.categories.forEach(category => {
          const weight = ACTION_WEIGHTS.COMMENT * category.confidence
          categoryWeights[category.id] = (categoryWeights[category.id] || 0) + weight
          totalWeight += weight
        })
      })

      // Обработка просмотров
      userViews.forEach(view => {
        view.post.categories.forEach(category => {
          const weight = ACTION_WEIGHTS.VIEW * category.confidence
          categoryWeights[category.id] = (categoryWeights[category.id] || 0) + weight
          totalWeight += weight
        })
      })

      // Обработка репостов
      userShares.forEach(share => {
        share.post.categories.forEach(category => {
          const weight = ACTION_WEIGHTS.SHARE * category.confidence
          categoryWeights[category.id] = (categoryWeights[category.id] || 0) + weight
          totalWeight += weight
        })
      })

      // Обработка лайков комментариев
      userCommentLikes.forEach(commentLike => {
        commentLike.comment.post.categories.forEach(category => {
          const weight = ACTION_WEIGHTS.COMMENT_LIKE * category.confidence
          categoryWeights[category.id] = (categoryWeights[category.id] || 0) + weight
          totalWeight += weight
        })
      })

      // Удаляем существующие интересы пользователя
      await prisma.userInterest.deleteMany({
        where: {
          userId: user.id,
        },
      })

      // Создаем новые интересы
      const interests = Object.entries(categoryWeights)
        .map(([categoryId, weight]) => ({
          userId: user.id,
          categoryId: parseInt(categoryId),
          weight: weight / totalWeight, // Нормализуем веса
        }))
        .sort((a, b) => b.weight - a.weight) // Сортируем по убыванию веса
        .slice(0, 10) // Берем топ-10 интересов

      if (interests.length > 0) {
        await prisma.userInterest.createMany({
          data: interests,
        })
        console.log(`Добавлено ${interests.length} интересов для пользователя ${user.userName || user.id}`)
        console.log('Топ-3 интереса:')
        interests.slice(0, 3).forEach(interest => {
          console.log(`- Категория ${interest.categoryId}: ${(interest.weight * 100).toFixed(2)}%`)
        })
      } else {
        console.log(`Не найдено категорий для пользователя ${user.userName || user.id}`)
      }
    }

    console.log('\nЗаполнение интересов пользователей завершено')
  } catch (error) {
    console.error('Ошибка при заполнении интересов:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fillUserInterests() 
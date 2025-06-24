const { prisma } = require('../prisma/prisma-client')
const { stripHtml } = require('../utils/stripHtml')

const LikeController = {
  async likePost(req, res) {
    let { postId } = req.body
    postId = parseInt(postId)
    const userId = req.user.id

    if (!postId) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const existingLike = await prisma.like.findFirst({
        where: {
          postId,
          userId
        }
      })

      if (existingLike) {
        return res.status(400).json({ error: 'Вы уже лайкнули этот пост' })
      }

      const [like, updatedPost] = await prisma.$transaction([
        prisma.like.create({
          data: {
            postId,
            userId
          }
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } }
        })
      ])

      res.json({ message: 'Пост успешно лайкнут' })

      // Уведомления — после ответа, асинхронно
      ;(async () => {
        // Получаем автора поста и лайкнувшего одним запросом
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: {
            createdAt: true,
            content: true,
            author: {
              select: {
                id: true,
                email: true,
                userName: true,
                avatarUrl: true,
                enablePushNotifications: true,
                enableEmailNotifications: true,
                notifyOnLikePush: true,
                notifyOnLikeEmail: true
              }
            }
          }
        })
        if (!post || !post.author || post.author.id === userId) return
        const liker = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, userName: true, avatarUrl: true }
        })
        const { FRONTEND_URL } = require('../contstants')
        // Email
        if (
          post.author.enableEmailNotifications &&
          post.author.notifyOnLikeEmail &&
          post.author.email
        ) {
          // Здесь можно использовать emailService.sendNewLikeEmail
          // await emailService.sendNewLikeEmail(post.author.email, liker.userName, liker.name)
        }
        // Push
        if (
          post.author.enablePushNotifications &&
          post.author.notifyOnLikePush
        ) {
          const pushSubscriptions = await prisma.pushSubscription.findMany({
            where: { userId: post.author.id }
          })
          const webpush = require('../services/webpush.service')
          const loginTime = new Date(post.createdAt).toLocaleString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Moscow'
          })
          for (const sub of pushSubscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys
                },
                JSON.stringify({
                  title: `@${liker.userName || liker.name || 'Пользователь'} поставил лайк вашему посту!`,
                  body: `Пользователю @${followerUser.userName} (${followerUser.name}) понравился ваш пост - ${stripHtml(post.content).slice(0, 50)}`,
                  url: `${FRONTEND_URL}/${liker.userName}`,
                  icon:
                    liker.avatarUrl ||
                    'https://res.cloudinary.com/djsmqdror/image/upload/v1750155232/pvqgftwlzvt6p24auk7u.png'
                })
              )
            } catch (err) {
              console.log('Ошибка при отправке пуша: ', err)
            }
          }
        }
      })()
    } catch (error) {
      console.error('Error in likePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async unlikePost(req, res) {
    let { postId } = req.body
    postId = parseInt(postId)
    const userId = req.user.id

    if (!postId) {
      return res
        .status(400)
        .json({ error: 'Лайк еще не поставлен, чтобы его убирать' })
    }

    try {
      const existingLike = await prisma.like.findFirst({
        where: {
          postId: postId,
          userId
        }
      })

      if (!existingLike) {
        return res.status(400).json({ error: 'Уже и так убран лайк' })
      }

      const [deletedLike, updatedPost] = await prisma.$transaction([
        prisma.like.deleteMany({
          where: { postId: postId, userId }
        }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } }
        })
      ])

      res.json({ message: 'Лайк успешно удален' })
    } catch (error) {
      console.error('Error in unlikePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getLikes(req, res) {
    const currentUserId = req.user.id
    const { postId } = req.params

    try {
      const likes = await prisma.like.findMany({
        where: { postId: parseInt(postId) },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              userName: true,
              avatarUrl: true,
              followers: {
                where: {
                  followerId: currentUserId
                }
              },
              _count: {
                select: { followers: true, following: true }
              }
            }
          }
        },
        orderBy: {
          user: {
            followers: {
              _count: 'desc'
            }
          }
        }
      })

      const sortedLikes = likes
        .map((like) => {
          return {
            ...like,
            user: {
              ...like.user,
              isFollowing: like.user.followers.length > 0
            }
          }
        })
        .sort((a, b) => b.user.isFollowing - a.user.isFollowing)

      return res.json(sortedLikes)
    } catch (error) {
      console.error('Error in getLikes:', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = LikeController

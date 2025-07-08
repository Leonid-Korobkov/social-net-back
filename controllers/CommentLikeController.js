const { prisma } = require('../prisma/prisma-client')

const CommentLikeController = {
  async toggleLike(req, res) {
    const commentId = parseInt(req.params.commentId)
    const userId = req.user.id

    try {
      const comment = await prisma.comment.findUnique({
        where: { id: parseInt(commentId) }
      })

      if (!comment) {
        return res.status(404).json({ error: 'Комментарий не найден' })
      }

      const existingLike = await prisma.commentLike.findUnique({
        where: {
          commentId_userId: {
            commentId: parseInt(commentId),
            userId: userId
          }
        }
      })

      if (existingLike) {
        await prisma.$transaction([
          prisma.commentLike.delete({
            where: { commentId_userId: { commentId, userId } }
          }),
          prisma.comment.update({
            where: { id: commentId },
            data: { likeCount: { decrement: 1 } },
            select: { likeCount: true }
          })
        ])
        return res.json({ message: 'Лайк удален' })
      } else {
        await prisma.$transaction([
          prisma.commentLike.create({ data: { commentId, userId } }),
          prisma.comment.update({
            where: { id: commentId },
            data: { likeCount: { increment: 1 } },
            select: { likeCount: true }
          })
        ])
        res.json({ message: 'Лайк добавлен' })

        // Push-уведомление автору комментария
        ;(async () => {
          // Получаем автора комментария и лайкнувшего
          const commentWithAuthor = await prisma.comment.findUnique({
            where: { id: commentId },
            select: {
              content: true,
              userId: true,
              postId: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  userName: true,
                  avatarUrl: true,
                  enablePushNotifications: true,
                  notifyOnCommentLikePush: true
                }
              }
            }
          })
          if (
            !commentWithAuthor ||
            !commentWithAuthor.user ||
            commentWithAuthor.user.id === userId
          )
            return
          const liker = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, userName: true, avatarUrl: true }
          })
          const { FRONTEND_URL } = require('../contstants')
          if (
            commentWithAuthor.user.enablePushNotifications &&
            commentWithAuthor.user.notifyOnCommentLikePush
          ) {
            const pushSubscriptions = await prisma.pushSubscription.findMany({
              where: { userId: commentWithAuthor.user.id }
            })
            const webpush = require('../services/webpush.service')
            for (const sub of pushSubscriptions) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                  },
                  JSON.stringify({
                    title: `@${liker.userName || liker.name || 'Пользователь'} лайкнул ваш комментарий!`,
                    body: `Пользователю @${liker.userName} (${liker.name}) понравился ваш комментарий: ${commentWithAuthor.content.slice(0, 50)}`,
                    url: `${FRONTEND_URL}/${liker.userName}/post/${commentWithAuthor.postId}`,
                    icon:
                      liker.avatarUrl ||
                      'https://res.cloudinary.com/djsmqdror/image/upload/v1750155232/pvqgftwlzvt6p24auk7u.png'
                  })
                )
              } catch (err) {
                console.log(
                  'Ошибка при отправке пуша на лайк комментария: ',
                  err
                )
              }
            }
          }
        })()
        return
      }
    } catch (error) {
      console.error('Error in toggleCommentLike:', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getLikes(req, res) {
    const { commentId } = req.params

    try {
      const likes = await prisma.commentLike.findMany({
        where: { commentId: parseInt(commentId) },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true
            }
          }
        }
      })

      return res.json(likes)
    } catch (error) {
      console.error('Error in getCommentLikes:', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = CommentLikeController

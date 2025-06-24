const { prisma } = require('../prisma/prisma-client')
const { stripHtml } = require('../utils/stripHtml')
const { optimizeCloudinaryImage } = require('../utils/cloudinary')
const emailService = require('../services/email.service')
const { FRONTEND_URL } = require('../contstants')

const CommentController = {
  async createComment(req, res) {
    let { content, postId, media } = req.body
    postId = parseInt(postId)
    const userId = req.user.id

    if (
      (!content || content.trim() === '') &&
      (!media || !Array.isArray(media) || media.length === 0)
    ) {
      return res.status(400).json({ error: 'Комментарий не может быть пустым' })
    }

    try {
      // Создаем комментарий и увеличиваем commentCount
      const [comment, updatedPost] = await prisma.$transaction([
        prisma.comment.create({
          data: {
            postId,
            userId,
            content,
            media: Array.isArray(media) ? media : []
          }
        }),
        prisma.post.update({
          where: { id: postId },
          data: { commentCount: { increment: 1 } },
          select: { commentCount: true }
        })
      ])

      res.json({ updatedPost, comment })

      // Уведомления — после ответа, асинхронно
      ;(async () => {
        // Получаем все нужные данные одним запросом
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: {
            id: true,
            content: true,
            media: true,
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                userName: true,
                avatarUrl: true,
                enableEmailNotifications: true,
                enablePushNotifications: true,
                notifyOnNewCommentPush: true,
                notifyOnNewCommentEmail: true
              }
            }
          }
        })
        if (!post || !post.author || post.author.id === userId) return
        const commenter = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, userName: true, email: true, avatarUrl: true }
        })
        let postPreviewImage = undefined
        if (Array.isArray(post.media) && post.media.length > 0) {
          postPreviewImage = post.media[0]
        } else if (post.imageUrl) {
          postPreviewImage = post.imageUrl
        }
        // Email уведомление
        if (
          post.author.enableEmailNotifications &&
          post.author.notifyOnNewCommentEmail &&
          post.author.email
        ) {
          await emailService.sendNewCommentEmail(
            post.author.email,
            commenter.userName || commenter.name || 'Пользователь',
            stripHtml(content),
            post.id,
            post.author.userName,
            post.author.email,
            stripHtml(post.content),
            optimizeCloudinaryImage(postPreviewImage)
          )
        }
        // Web Push
        if (
          post.author.enablePushNotifications &&
          post.author.notifyOnNewCommentPush
        ) {
          const pushSubscriptions = await prisma.pushSubscription.findMany({
            where: { userId: post.author.id }
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
                  title: `@${commenter.userName || commenter.name || 'Пользователь'} оставил комментарий к вашему посту!`,
                  body: `Пользователь @${commenter.userName || commenter.name || 'Пользователь'}: ${stripHtml(content).slice(0, 100)}`,
                  url: `${FRONTEND_URL}/${post.author.userName}/post/${post.id}`,
                  icon:
                    commenter.avatarUrl ||
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
      console.error('Error in createComment', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async deleteComment(req, res) {
    let { id } = req.params
    id = parseInt(id)
    const userId = req.user.id

    try {
      const comment = await prisma.comment.findUnique({
        where: { id: id }
      })

      if (!comment) {
        return res.status(404).json({ error: 'Комментарий не найден' })
      }
      if (comment.userId !== userId) {
        return res.status(403).json({ error: 'Отказано в доступе' })
      }

      // Удаляем комментарий и уменьшаем счетчик
      const transactions = await prisma.$transaction([
        prisma.commentLike.deleteMany({ where: { commentId: id } }),
        prisma.comment.delete({ where: { id } }),
        prisma.post.update({
          where: { id: comment.postId },
          data: { commentCount: { decrement: 1 } },
          select: { commentCount: true }
        })
      ])

      return res.json({
        message: 'Комментарий успешно удалён'
      })
    } catch (error) {
      console.error('Error in deleteComment', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getComments(req, res) {
    const { postId } = req.params
    const userId = req.user.id
    const page = parseInt(req.query.page)
    const limit = parseInt(req.query.limit)
    const skip = (page - 1) * limit

    try {
      const totalComments = await prisma.comment.count({
        where: { postId: parseInt(postId) }
      })

      const comments = await prisma.comment.findMany({
        skip: skip || 0,
        take: limit || undefined,
        where: { postId: parseInt(postId) },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              userName: true
            }
          },
          likes: {
            include: {
              user: true
            }
          }
        }
      })

      const commentsWithLikeInfo = comments.map(({ likes, ...comment }) => ({
        ...comment,
        likedByUser: likes.some((like) => like.userId === userId),
        media: comment.media || []
      }))

      res.setHeader('x-total-count', totalComments.toString())
      res.setHeader('Access-Control-Expose-Headers', 'x-total-count')

      const result = {
        data: commentsWithLikeInfo,
        total: totalComments
      }

      res.json(result)
    } catch (error) {
      console.error('Error in getComments:', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getCommentLikes(req, res) {
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

module.exports = CommentController

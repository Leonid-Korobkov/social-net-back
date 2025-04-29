const { prisma } = require('../prisma/prisma-client')

const CommentController = {
  async createComment (req, res) {
    let { content, postId } = req.body
    postId = parseInt(postId)
    const userId = req.user.userId

    if (!content || !postId) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const comment = await prisma.comment.create({
        data: {
          content,
          postId,
          userId: userId
        }
      })

      res.json(comment)
    } catch (error) {
      console.error('Error in createComment', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async deleteComment (req, res) {
    let { id } = req.params
    id = parseInt(id)
    const userId = req.user.userId

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

      const transactions = await prisma.$transaction([
        prisma.commentLike.deleteMany({ where: { commentId: id } }),
        prisma.comment.delete({ where: { id } })
      ])

      res.json({ message: 'Комментарий успешно удален', transactions })
    } catch (error) {
      console.error('Error in deleteComment', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getComments (req, res) {
    const { postId } = req.params
    const userId = req.user.userId
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
              avatarUrl: true
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
        likedByUser: likes.some(like => like.userId === userId),
        likeCount: likes.length
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

  async getCommentLikes (req, res) {
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

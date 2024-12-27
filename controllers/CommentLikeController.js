const { prisma } = require('../prisma/prisma-client')

const CommentLikeController = {
  async toggleLike (req, res) {
    const { commentId } = req.params
    const userId = req.user.userId

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
        // Если лайк существует - удаляем его
        await prisma.commentLike.delete({
          where: {
            commentId_userId: {
              commentId: parseInt(commentId),
              userId: userId
            }
          }
        })
        return res.json({ message: 'Лайк удален' })
      } else {
        // Если лайка нет - создаем новый
        const like = await prisma.commentLike.create({
          data: {
            commentId: parseInt(commentId),
            userId: userId
          }
        })
        return res.json({ message: 'Лайк добавлен', like })
      }
    } catch (error) {
      console.error('Error in toggleCommentLike:', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getLikes (req, res) {
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

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
  }
}

module.exports = CommentController

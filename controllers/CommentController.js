const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { ObjectId } = require('mongodb')

const CommentController = {
  async createComment (req, res) {
    const { content, postId } = req.body
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
    const { id } = req.params
    const userId = req.user.userId

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID поста' })
    }

    const objId = new ObjectId(id)

    try {
      const comment = await prisma.comment.findUnique({
        where: { id: objId }
      })

      if (!comment) {
        return res.status(404).json({ error: 'Комментарий не найден' })
      }
      if (comment.userId !== userId) {
        return res.status(403).json({ error: 'Отказано в доступе' })
      }

      const deletedComment = await prisma.comment.delete({ where: { id } })

      res.json({ message: 'Комментарий успешно удален', deletedComment })
    } catch (error) {
      console.error('Error in deleteComment', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = CommentController

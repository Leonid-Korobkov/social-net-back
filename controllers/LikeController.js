const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { ObjectId } = require('mongodb')

const LikeController = {
  async likePost (req, res) {
    const { postId } = req.body
    const userId = req.user.userId

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
        return res.status(400).json({ error: 'Вы уже лайкнули этот пост' })
      }

      const like = await prisma.like.create({
        data: {
          postId,
          userId
        }
      })

      res.json({ message: 'Пост успешно лайкнут', like })
    } catch (error) {
      console.error('Error in likePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async unlikePost (req, res) {
    const { postId } = req.body
    const userId = req.user.userId

    if (!postId) {
      return res
        .status(400)
        .json({ error: 'Лайк еще не поставлен, чтобы его убирать' })
    }

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ error: 'Некорректный ID поста' })
    }

    const objId = new ObjectId(postId)

    try {
      const existingLike = await prisma.like.findFirst({
        where: {
          postId: objId,
          userId
        }
      })

      if (!existingLike) {
        return res.status(400).json({ error: 'Уже и так убран лайк' })
      }

      const deletedLike = await prisma.like.deleteMany({
        where: { postId: objId, userId }
      })

      res.json({ message: 'Лайк успешно удален', deletedLike })
    } catch (error) {
      console.error('Error in unlikePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = LikeController

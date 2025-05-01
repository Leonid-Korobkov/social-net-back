const { prisma } = require('../prisma/prisma-client')

const LikeController = {
  async likePost (req, res) {
    let { postId } = req.body
    postId = parseInt(postId)
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
    } catch (error) {
      console.error('Error in likePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async unlikePost (req, res) {
    let { postId } = req.body
    postId = parseInt(postId)
    const userId = req.user.userId

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

  async getLikes (req, res) {
    const { postId } = req.params

    try {
      const likes = await prisma.like.findMany({
        where: { postId: parseInt(postId) },
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
      console.error('Error in getLikes:', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = LikeController

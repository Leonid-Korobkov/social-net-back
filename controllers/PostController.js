const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { ObjectId } = require('mongodb')

const PostController = {
  async createPost (req, res) {
    const { content, title } = req.body
    const userId = req.user.userId

    if (!content) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const post = await prisma.post.create({
        data: {
          content,
          authorId: userId
        }
      })

      res.json({ message: 'Пост успешно создан', post })
    } catch (error) {
      console.error('Error in createPost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getAllPosts (req, res) {
    const userId = req.user.userId

    try {
      const posts = await prisma.post.findMany({
        where: { authorId: userId },
        include: {
          likes: true,
          author: true,
          comments: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      const postsWithLikesUserInfo = posts.map(post => ({
        ...post,
        likedByUser: post.likes.some(like => like.userId === userId)
      }))

      res.json(postsWithLikesUserInfo)
    } catch (error) {
      console.error('Error in getAllPosts', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async getPostById (req, res) {
    const { id } = req.params
    const userId = req.user.userId

    try {
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Некорректный ID поста' })
      }

      const objId = new ObjectId(id)

      const post = await prisma.post.findUnique({
        where: { id: objId },
        include: {
          comments: {
            include: {
              user: true
            }
          },
          likes: true,
          author: true
        }
      })

      if (!post) {
        return res.status(404).json({ error: 'Пост не найден' })
      }

      const postWithLikesUserInfo = {
        ...post,
        likedByUser: post.likes.some(like => like.userId === userId)
      }

      res.json(postWithLikesUserInfo)
    } catch (error) {
      console.error('Error in getAllPosts', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async deletePost (req, res) {
    const { id } = req.params
    const userId = req.user.userId

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID поста' })
    }

    const objId = new ObjectId(id)

    const post = await prisma.post.findUnique({
      where: { id: objId }
    })

    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' })
    }
    if (post.authorId !== userId) {
      return res.status(403).json({ error: 'Отказано в доступе' })
    }

    try {
      const transactions = await prisma.$transaction([
        prisma.comment.deleteMany({ where: { postId: id } }),
        prisma.like.deleteMany({ where: { postId: id } }),
        prisma.post.delete({ where: { id } })
      ])

      res.json({ message: 'Пост удален', transactions })
    } catch (error) {
      console.error('Error in deletePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = PostController

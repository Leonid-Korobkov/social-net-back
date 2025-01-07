const { prisma } = require('../prisma/prisma-client')

const PostController = {
  async createPost (req, res) {
    const { content } = req.body
    const userId = req.user.userId

    if (!content) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const post = await prisma.post.create({
        data: {
          content,
          authorId: userId,
          imageUrl: req.file?.cloudinaryUrl || undefined
        }
      })

      res.json(post)
    } catch (error) {
      console.error('Error in createPost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getAllPosts (req, res) {
    const userId = req.user.userId
    const page = parseInt(req.query.page)
    const limit = parseInt(req.query.limit)
    const skip = (page - 1) * limit

    await new Promise(resolve => setTimeout(resolve, 1000))

    try {
      // Получаем общее количество постов
      const totalPosts = await prisma.post.count()

      // Получаем посты с пагинацией
      const posts = await prisma.post.findMany({
        skip: skip ? skip : 0,
        take: limit ? limit : undefined,
        include: {
          likes: {
            include: {
              user: true
            }
          },
          author: {
            include: {
              followers: {
                where: { followerId: userId }
              }
            }
          },
          comments: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // Добавляем поля isFollowing и likedByUser
      const postsWithLikesUserInfo = posts.map(post => ({
        ...post,
        likedByUser: post.likes.some(like => like.userId === userId),
        isFollowing: post.author.followers.length > 0
      }))

      // Устанавливаем заголовок с общим количеством постов
      res.setHeader('x-total-count', totalPosts.toString())
      res.setHeader('Access-Control-Expose-Headers', 'x-total-count')

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
      const post = await prisma.post.findUnique({
        where: { id: parseInt(id) },
        include: {
          comments: {
            include: {
              user: true,
              likes: {
                include: {
                  user: true
                }
              }
            }
          },
          likes: {
            include: {
              user: true
            }
          },
          author: {
            include: {
              followers: {
                where: { followerId: userId } // Проверяем подписку в том же запросе
              }
            }
          }
        }
      })

      if (!post) {
        return res.status(404).json({ error: 'Пост не найден' })
      }

      const postWithLikesUserInfo = {
        ...post,
        comments: post.comments.map(comment => ({
          ...comment,
          likedByUser: comment.likes.some(like => like.userId === userId)
        })),
        likedByUser: post.likes.some(like => like.userId === userId),
        isFollowing: post.author.followers.length > 0 // Проверяем, есть ли текущий пользователь среди подписчиков
      }

      res.json(postWithLikesUserInfo)
    } catch (error) {
      console.error('Error in getPostById', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async deletePost (req, res) {
    let { id } = req.params
    id = parseInt(id)
    const userId = req.user.userId

    try {
      const post = await prisma.post.findUnique({
        where: { id: id }
      })

      if (!post) {
        return res.status(404).json({ error: 'Пост не найден' })
      }
      if (post.authorId !== userId) {
        return res.status(403).json({ error: 'Отказано в доступе' })
      }

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
  },
}

module.exports = PostController

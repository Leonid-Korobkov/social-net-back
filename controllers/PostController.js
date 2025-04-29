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
        },
        include: {
          author: true
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
        },
      },
    )

      // Добавляем поля isFollowing и likedByUser
      const postsWithLikesUserInfo = posts.map(({ likes, author, comments, ...post }) => (
      {
        ...post,
        author: {
          id: author.id,
          name: author.name,
          avatarUrl: author.avatarUrl
        },
        likedByUser: likes.some(like => like.userId === userId),
        isFollowing: author.followers.length > 0,
        likeCount: likes.length,
        commentCount: comments.length
      }))

      // Устанавливаем заголовок с общим количеством постов
      res.setHeader('x-total-count', totalPosts.toString())
      res.setHeader('Access-Control-Expose-Headers', 'x-total-count')

      const result = {
        data: postsWithLikesUserInfo,
        total: totalPosts,
      }

      res.json(result)
    } catch (error) {
      console.error('Error in getAllPosts', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async getPostsByUserId (req, res) {
    const params = req.params
    const userId = parseInt(params.userId)
    const page = parseInt(req.query.page)
    const limit = parseInt(req.query.limit)
    const skip = (page - 1) * limit

    try {
      const totalPosts = await prisma.post.count({
        where: { authorId: userId },
      })

      // Получаем посты с пагинацией
      const posts = await prisma.post.findMany({
        skip: skip ? skip : 0,
        take: limit ? limit : undefined,
        where: { authorId: userId },
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
        },
      },
    )

      // Добавляем поля isFollowing и likedByUser
      const postsWithLikesUserInfo = posts.map(({ likes, author, comments, ...post }) => (
      {
        ...post,
        author: {
          id: author.id,
          name: author.name,
          avatarUrl: author.avatarUrl
        },
        likedByUser: likes.some(like => like.userId === userId),
        isFollowing: author.followers.length > 0,
        likeCount: likes.length,
        commentCount: comments.length
      }))

      // Устанавливаем заголовок с общим количеством постов
      res.setHeader('x-total-count', totalPosts.toString())
      res.setHeader('Access-Control-Expose-Headers', 'x-total-count')

      const result = {
        data: postsWithLikesUserInfo,
        total: totalPosts,
      }

      res.json(result)
    } catch (error) {
      console.error('Error in getPostsByUserId', error)
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
          likes: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true
                }
              }
            }
          },
          comments: true,
          author: {
            include: {
              followers: {
                where: { followerId: userId }
              }
            }
          }
        }
      })

      if (!post) {
        return res.status(404).json({ error: 'Пост не найден' })
      }

      const postWithLikesUserInfo = {
        id: post.id,
        content: post.content,
        postId: post.postId,
        userId: post.userId,
        createdAt: post.createdAt,
        likeCount: post.likes.length,
        commentCount: post.comments.length,
        authorId: post.authorId,
        author: {
          id: post.author.id,
          name: post.author.name,
          avatarUrl: post.author.avatarUrl
        },
        likedByUser: post.likes.some(like => like.userId === userId),
        isFollowing: post.author.followers.length > 0
      }

      res.json(postWithLikesUserInfo)
    } catch (error) {
      console.error('Error in getPostById', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async deletePost (req, res) {
    let { id } = req.params
    console.log(id)
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

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
        select: {
          id: true,
          content: true,
          authorId: true,
          commentCount: true,
          content: true,
          createdAt: true,
          likeCount: true,
          shareCount: true,
          title: true,
          viewCount: true,
          author: {
            select: {
              id: true,
              name: true,
              userName: true,
              avatarUrl: true,
            }
          }
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
          userName: author.userName,
          avatarUrl: author.avatarUrl
        },
        likedByUser: likes.some(like => like.userId === userId),
        isFollowing: author.followers.length > 0,
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
    let userId = params.userId
    const page = parseInt(req.query.page)
    const limit = parseInt(req.query.limit)
    const skip = (page - 1) * limit

    let username
    let userWithUsername
    
    try {
      if (userId.toString().startsWith('@')) {
        username = userId.slice(1)
        userWithUsername = await prisma.user.findUnique({
          where: {userName: username},
        })
        userId = userWithUsername.id
      } else if (isNaN(userId)) {
        username = userId
        userWithUsername = await prisma.user.findUnique({
          where: {userName: username},
        })
        userId = userWithUsername.id
      } else {
        userId = parseInt(userId)
      }

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
          userName: author.userName,
          avatarUrl: author.avatarUrl
        },
        likedByUser: likes.some(like => like.userId === userId),
        isFollowing: author.followers.length > 0,
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
        ...post,
        author: {
          id: post.author.id,
          name: post.author.name,
          userName: post.author.userName,
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
        prisma.postView.deleteMany({ where: { postId: id } }),
        prisma.postShare.deleteMany({ where: { postId: id } }),
        prisma.post.delete({ where: { id } })
      ])

      res.json({ message: 'Пост удален', transactions })
    } catch (error) {
      console.error('Error in deletePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async incrementViewCount(req, res) {
    const { id } = req.params
    const userId = req.user.userId

    try {
      // Проверяем, смотрел ли пользователь уже этот пост
      const alreadyViewed = await prisma.postView.findUnique({
        where: { userId_postId: { userId, postId: parseInt(id) } }
      })

      if (alreadyViewed) {
        // Уже смотрел — не увеличиваем счетчик
        return res.json({ id: parseInt(id), viewed: true })
      }

      // Увеличиваем счетчик и сохраняем просмотр
      const [post] = await prisma.$transaction([
        prisma.post.update({
          where: { id: parseInt(id) },
          data: { viewCount: { increment: 1 } },
          select: { id: true, viewCount: true }
        }),
        prisma.postView.create({
          data: { userId, postId: parseInt(id) }
        })
      ])

      res.json({message: "Пост успешно просмотрен"})
    } catch (error) {
      console.error('Error in incrementViewCount', error)
      return res.status(500).json({ error: 'Не удалось увеличить viewCount' })
    }
  },
  async incrementShareCount(req, res) {
    const { id } = req.params
    const userId = req.user.userId

    try {
      // Проверяем, делился ли пользователь уже этим постом
      const alreadyShared = await prisma.postShare.findUnique({
        where: { userId_postId: { userId, postId: parseInt(id) } }
      })

      if (alreadyShared) {
        // Уже делился — не увеличиваем счетчик
        return res.json({ id: parseInt(id), shared: true })
      }

      // Увеличиваем счетчик и сохраняем факт шаринга
      const [post] = await prisma.$transaction([
        prisma.post.update({
          where: { id: parseInt(id) },
          data: { shareCount: { increment: 1 } },
          select: { id: true, shareCount: true }
        }),
        prisma.postShare.create({
          data: { userId, postId: parseInt(id) }
        })
      ])

      res.json({message: "Запись о шеринге сохранена"})
    } catch (error) {
      console.error('Error in incrementShareCount', error)
      return res.status(500).json({ error: 'Не удалось увеличить shareCount' })
    }
  },
  async incrementViewsBatch(req, res) {
    const userId = req.user.userId
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids должен быть непустым массивом' })
    }
    try {
      // Получаем id постов, которые уже были просмотрены этим пользователем
      const alreadyViewed = await prisma.postView.findMany({
        where: {
          userId,
          postId: { in: ids.map(Number) }
        },
        select: { postId: true }
      })
      const alreadyViewedIds = new Set(alreadyViewed.map(v => v.postId))
      // Оставляем только те id, которые ещё не были просмотрены
      const toView = ids.map(Number).filter(id => !alreadyViewedIds.has(id))
      if (toView.length === 0) return res.json({ viewed: [] })
      // Увеличиваем viewCount и сохраняем просмотры
      await prisma.$transaction([
        prisma.post.updateMany({
          where: { id: { in: toView } },
          data: { viewCount: { increment: 1 } }
        }),
        ...toView.map(postId => prisma.postView.create({ data: { userId, postId } }))
      ])
      res.json({ viewed: toView })
    } catch (error) {
      console.error('Error in incrementViewsBatch', error)
      return res.status(500).json({ error: 'Не удалось увеличить просмотры' })
    }
  },
}

module.exports = PostController

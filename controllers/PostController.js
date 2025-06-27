const { prisma } = require('../prisma/prisma-client')
const cloudinary = require('cloudinary').v2
const emailService = require('../services/email.service')
const { stripHtml } = require('../utils/stripHtml')
const { optimizeCloudinaryImage } = require('../utils/cloudinary')
const { FRONTEND_URL } = require('../contstants')
const extractFirstLink = require('../utils/extractFirstLink')
const fetchOpenGraphData = require('../utils/opengraph')

const PostController = {
  async createPost(req, res) {
    const { content, media } = req.body
    const userId = req.user.id

    try {
      // Убедимся, что media является массивом
      const mediaArray = Array.isArray(media) ? media : []

      // Извлекаем первую ссылку и получаем OG-данные
      let ogData = {}
      const firstLink = extractFirstLink(content)
      if (firstLink) {
        ogData = (await fetchOpenGraphData(firstLink)) || {}
      }

      const post = await prisma.post.create({
        data: {
          content,
          authorId: userId,
          media: mediaArray, // Гарантированно передаем массив
          imageUrl: req.file?.cloudinaryUrl || undefined,
          ogImageUrl: ogData.ogImageUrl || null,
          ogTitle: ogData.ogTitle || null,
          ogDescr: ogData.ogDescr || null,
          ogUrl: ogData.ogUrl || null
        },
        select: {
          id: true,
          content: true,
          authorId: true,
          commentCount: true,
          createdAt: true,
          likeCount: true,
          shareCount: true,
          title: true,
          viewCount: true,
          media: true, // Выбираем media из созданного поста
          ogImageUrl: true,
          ogTitle: true,
          ogDescr: true,
          ogUrl: true,
          author: {
            select: {
              id: true,
              name: true,
              userName: true,
              avatarUrl: true,
              email: true
            }
          }
        }
      })

      res.json(post)

      // Уведомления — после ответа, асинхронно
      ;(async () => {
        // Получаем email и настройки всех подписчиков автора одним запросом
        const followers = await prisma.follows.findMany({
          where: { followingId: userId },
          select: {
            follower: {
              select: {
                id: true,
                email: true,
                enablePushNotifications: true,
                enableEmailNotifications: true,
                notifyOnNewPostPush: true,
                notifyOnNewPostEmail: true
              }
            }
          }
        })
        // Фильтруем только тех, у кого включены email-уведомления для новых постов
        const subscriberEmails = followers
          .filter(
            (f) =>
              f.follower?.enableEmailNotifications &&
              f.follower?.notifyOnNewPostEmail
          )
          .map((f) => f.follower?.email)
          .filter((email) => !!email)
        let postPreviewImage = undefined
        if (Array.isArray(post.media) && post.media.length > 0) {
          postPreviewImage = post.media[0]
        } else if (post.imageUrl) {
          postPreviewImage = post.imageUrl
        }
        if (subscriberEmails.length > 0) {
          Promise.allSettled(
            subscriberEmails.map((email) =>
              emailService.sendNewPostEmail(
                email,
                post.author.userName || post.author.name || 'Автор',
                stripHtml(post.content),
                post.id,
                optimizeCloudinaryImage(postPreviewImage)
              )
            )
          )
        }
        // Web Push: отправляем push-уведомления подписчикам только если включено для новых постов
        const followerIds = followers
          .filter(
            (f) =>
              f.follower?.enablePushNotifications &&
              f.follower?.notifyOnNewPostPush
          )
          .map((f) => f.follower?.id)
        if (followerIds.length > 0) {
          const pushSubscriptions = await prisma.pushSubscription.findMany({
            where: { userId: { in: followerIds } }
          })
          const webpush = require('../services/webpush.service')
          for (const sub of pushSubscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys
                },
                JSON.stringify({
                  title: `@${post.author.userName || post.author.name} опубликовал новый пост!`,
                  body: stripHtml(post.content).slice(0, 100),
                  url: `${FRONTEND_URL}/${post.author.userName}/post/${post.id}`,
                  icon:
                    post.author.avatarUrl ||
                    'https://res.cloudinary.com/djsmqdror/image/upload/v1750155232/pvqgftwlzvt6p24auk7u.png'
                })
              )
            } catch (err) {
              console.log('Ошибка при отправке пуша: ', err)
            }
          }
        }
      })()
    } catch (error) {
      console.error('Error in createPost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async getAllPosts(req, res) {
    const userId = req.user.id
    const page = parseInt(req.query.page)
    const limit = parseInt(req.query.limit)
    const feedType = req.query.feed || 'new' // По умолчанию показываем новые посты
    const skip = (page - 1) * limit

    try {
      // Базовые условия для запроса
      let whereCondition = {}
      let orderBy = { createdAt: 'desc' }

      // Создаем условия запроса в зависимости от типа ленты
      if (feedType === 'following') {
        // Получаем список ID пользователей, на которых подписан текущий пользователь
        const following = await prisma.follows.findMany({
          where: { followerId: userId },
          select: { followingId: true }
        })
        const followingIds = following.map((f) => f.followingId).filter(Boolean)

        // Показываем посты только от пользователей, на которых подписан
        whereCondition.authorId = { in: followingIds }
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }]
      } else if (feedType === 'viewed') {
        // Показываем только просмотренные посты
        whereCondition.PostView = {
          some: { userId }
        }
      } else if (feedType === 'for-you') {
        // Просто сортируем непросмотренные посты по score, updatedScoreAt и createdAt
        whereCondition.PostView = { none: { userId } }
        whereCondition.authorId = { not: userId }
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }]
      } else if (feedType === 'top') {
        orderBy = [{ score: 'desc' }, { createdAt: 'desc' }]
      }
      // Для 'new' оставляем пустые условия, чтобы показать все посты

      // Получаем общее количество постов с примененными фильтрами
      const totalPosts = await prisma.post.count({
        where: whereCondition
      })

      // Получаем посты с пагинацией и примененными фильтрами
      const posts = await prisma.post.findMany({
        skip: skip ? skip : 0,
        take: limit ? limit : undefined,
        where: whereCondition,
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
          comments: true,
          PostView: {
            where: { userId }
          }
        },
        orderBy: orderBy
      })

      // Если это лента for-you, сортируем посты по порядку в finalIds
      let postsSorted = posts
      if (feedType === 'for-you' && typeof finalIds !== 'undefined') {
        postsSorted = finalIds
          .map((id) => posts.find((p) => p.id === id))
          .filter(Boolean)
      }

      // Добавляем поля isFollowing и likedByUser
      const postsWithLikesUserInfo = postsSorted.map(
        ({ likes, author, comments, PostView, ...post }) => ({
          ...post,
          author: {
            id: author.id,
            name: author.name,
            userName: author.userName,
            avatarUrl: author.avatarUrl
          },
          likedByUser: likes.some((like) => like.userId === userId),
          isFollowing: author.followers.length > 0,
          viewed: PostView ? PostView.length > 0 : false
        })
      )

      // Флаг "все просмотрено" для feedType 'for-you'
      let allViewed = false
      if (feedType === 'for-you') {
        // Если всего непосмотренных постов 0 — значит все просмотрено
        allViewed = totalPosts === 0
      }

      // Устанавливаем заголовок с общим количеством постов
      res.setHeader('x-total-count', totalPosts.toString())
      res.setHeader('Access-Control-Expose-Headers', 'x-total-count')

      const result = {
        data: postsWithLikesUserInfo,
        total: totalPosts,
        allViewed
      }

      res.json(result)
    } catch (error) {
      console.error('Error in getAllPosts', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async getPostsByUserId(req, res) {
    const currentUser = req.user.id
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
          where: { userName: username }
        })
        userId = userWithUsername.id
      } else if (isNaN(userId)) {
        username = userId
        userWithUsername = await prisma.user.findUnique({
          where: { userName: username }
        })
        userId = userWithUsername.id
      } else {
        userId = parseInt(userId)
      }

      const totalPosts = await prisma.post.count({
        where: { authorId: userId }
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
        }
      })

      // Добавляем поля isFollowing и likedByUser
      const postsWithLikesUserInfo = posts.map(
        ({ likes, author, comments, ...post }) => ({
          ...post,
          author: {
            id: author.id,
            name: author.name,
            userName: author.userName,
            avatarUrl: author.avatarUrl
          },
          likedByUser: likes.some((like) => like.userId === currentUser),
          isFollowing: author.followers.length > 0
        })
      )

      // Устанавливаем заголовок с общим количеством постов
      res.setHeader('x-total-count', totalPosts.toString())
      res.setHeader('Access-Control-Expose-Headers', 'x-total-count')

      const result = {
        data: postsWithLikesUserInfo,
        total: totalPosts
      }

      res.json(result)
    } catch (error) {
      console.error('Error in getPostsByUserId', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async getPostById(req, res) {
    const { id } = req.params
    const userId = req.user.id

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
        likedByUser: post.likes.some((like) => like.userId === userId),
        isFollowing: post.author.followers.length > 0
      }

      res.json(postWithLikesUserInfo)
    } catch (error) {
      console.error('Error in getPostById', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async deletePost(req, res) {
    let { id } = req.params
    id = parseInt(id)
    const userId = req.user.id

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
    const userId = req.user.id

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

      res.json({ message: 'Пост успешно просмотрен' })
    } catch (error) {
      console.error('Error in incrementViewCount', error)
      return res.status(500).json({ error: 'Не удалось увеличить viewCount' })
    }
  },
  async incrementShareCount(req, res) {
    const { id } = req.params
    const userId = req.user.id

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
          select: { id: true, authorId: true }
        }),
        prisma.postShare.create({
          data: { userId, postId: parseInt(id) }
        })
      ])

      // Уведомления — после ответа, асинхронно
      ;(async () => {
        // Получаем автора поста и репостера одним запросом
        const [postAuthor, reposter] = await prisma.$transaction([
          prisma.user.findUnique({
            where: { id: post.authorId },
            select: {
              email: true,
              enablePushNotifications: true,
              enableEmailNotifications: true,
              notifyOnRepostPush: true,
              notifyOnRepostEmail: true
            }
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, userName: true, avatarUrl: true }
          })
        ])
        // Email
        if (
          postAuthor?.enableEmailNotifications &&
          postAuthor?.notifyOnRepostEmail &&
          postAuthor.email
        ) {
          // Здесь можно использовать emailService.sendNewRepostEmail
          // await emailService.sendNewRepostEmail(postAuthor.email, reposter.userName, reposter.name)
        }
        // Push
        if (
          postAuthor?.enablePushNotifications &&
          postAuthor?.notifyOnRepostPush
        ) {
          const pushSubscriptions = await prisma.pushSubscription.findMany({
            where: { userId: post.authorId }
          })
          const webpush = require('../services/webpush.service')
          for (const sub of pushSubscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys
                },
                JSON.stringify({
                  title: `Новый репост вашего поста!`,
                  body: `Пользователь @${followerUser.userName} (${followerUser.name}) сделал репост вашего поста`,
                  url: `${FRONTEND_URL}/${reposter.userName}`,
                  icon:
                    reposter.avatarUrl ||
                    'https://res.cloudinary.com/djsmqdror/image/upload/v1750155232/pvqgftwlzvt6p24auk7u.png'
                })
              )
            } catch (err) {
              console.log('Ошибка при отправке пуша: ', err)
            }
          }
        }
      })()

      res.json({ message: 'Запись о шеринге сохранена' })
    } catch (error) {
      console.error('Error in incrementShareCount', error)
      return res.status(500).json({ error: 'Не удалось увеличить shareCount' })
    }
  },
  async incrementViewsBatch(req, res) {
    const userId = req.user.id
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: 'ids должен быть непустым массивом' })
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
      const alreadyViewedIds = new Set(alreadyViewed.map((v) => v.postId))
      // Оставляем только те id, которые ещё не были просмотрены
      const toView = ids.map(Number).filter((id) => !alreadyViewedIds.has(id))
      if (toView.length === 0) return res.json({ viewed: [] })
      // Увеличиваем viewCount и сохраняем просмотры
      await prisma.$transaction([
        prisma.post.updateMany({
          where: { id: { in: toView } },
          data: { viewCount: { increment: 1 } }
        }),
        ...toView.map((postId) =>
          prisma.postView.create({ data: { userId, postId } })
        )
      ])
      res.json({ viewed: toView })
    } catch (error) {
      console.error('Error in incrementViewsBatch', error)
      return res
        .status(500)
        .json({ error: 'Не удалось увеличить просмотры', errorMessage: error })
    }
  },
  async updatePost(req, res) {
    const { id } = req.params
    const { content, media } = req.body
    const userId = req.user.id

    if (!content) {
      return res.status(400).json({ error: 'Контент не может быть пустым' })
    }

    try {
      const post = await prisma.post.findUnique({
        where: { id: parseInt(id) }
      })

      if (!post) {
        return res.status(404).json({ error: 'Пост не найден' })
      }

      if (post.authorId !== userId) {
        return res.status(403).json({ error: 'Отказано в доступе' })
      }

      const updateData = {
        idEdited: true,
        content,
        imageUrl: req.file?.cloudinaryUrl || post.imageUrl
      }

      // Добавляем media только если передан новый массив
      if (media) {
        updateData.media = media
      }

      const updatedPost = await prisma.post.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              userName: true,
              avatarUrl: true
            }
          }
        }
      })

      res.json(updatedPost)
    } catch (error) {
      console.error('Error in updatePost', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async uploadMedia(req, res) {
    // Проверяем наличие mediaUrls
    if (!req.mediaUrls) {
      return res
        .status(400)
        .json({ error: 'Не удалось загрузить файл: mediaUrls не найден' })
    }

    // Проверяем, что это массив и в нем есть элементы
    if (!Array.isArray(req.mediaUrls) || req.mediaUrls.length === 0) {
      return res.status(400).json({
        error: 'Не удалось загрузить файл: пустой массив или неверный формат'
      })
    }

    // Возвращаем первый URL из загруженных (так как uploadMultiple ограничен одним файлом)
    const url = req.mediaUrls[0]

    return res.json({ url })
  },
  async deleteMedia(req, res) {
    try {
      const { url } = req.body

      if (!url) {
        return res.status(400).json({ error: 'URL файла не указан' })
      }

      // Проверяем, является ли URL действительным URL Cloudinary
      if (!url.includes('cloudinary.com') || !url.includes('/upload/')) {
        return res.status(400).json({ error: 'Неверный формат URL Cloudinary' })
      }

      // Извлекаем public_id из URL
      // Формат URL: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{format}
      // Пример: https://res.cloudinary.com/djsmqdror/image/upload/v1746799257/zling/25/dcq0ytx6yqwyc1qpu040.webp
      try {
        // Получаем все части после /upload/
        const uploadIndex = url.indexOf('/upload/')
        if (uploadIndex === -1) {
          throw new Error('Не удалось найти /upload/ в URL')
        }

        // Отрезаем всё до /upload/ включительно
        const pathAfterUpload = url.substring(uploadIndex + 8) // +8 = длина "/upload/"

        // Разбираем оставшийся путь
        const pathParts = pathAfterUpload.split('/')

        // Первая часть - это обычно версия (v1234567890)
        // Пропускаем её, если она начинается с 'v'
        let startIndex = 0
        if (pathParts[0].startsWith('v') && /^v\d+$/.test(pathParts[0])) {
          startIndex = 1
        }

        // Объединяем все оставшиеся части пути, кроме расширения файла
        const remainingPath = pathParts.slice(startIndex).join('/')

        // Удаляем расширение файла (.webp, .jpg и т.д.)
        const lastDotIndex = remainingPath.lastIndexOf('.')
        const publicId =
          lastDotIndex !== -1
            ? remainingPath.substring(0, lastDotIndex)
            : remainingPath

        // Определяем тип ресурса (image или video)
        const resourceType = url.includes('/video/') ? 'video' : 'image'

        // Используем метод delete_resources вместо destroy
        const result = await cloudinary.api.delete_resources([publicId], {
          type: 'upload',
          resource_type: resourceType
        })

        return res.json({
          success: true,
          message: 'Файл успешно удален',
          result
        })
      } catch (cloudinaryError) {
        // Пробуем альтернативный метод, если первый не сработал
        try {
          // Извлекаем public_id из URL (старый способ)
          const urlParts = url.split('/')
          const fileNameWithExt = urlParts[urlParts.length - 1] // Последний сегмент URL
          const publicIdParts = fileNameWithExt.split('.')
          const publicIdWithoutExt = publicIdParts.slice(0, -1).join('.')
          const folderPath = urlParts[urlParts.length - 2] // Предпоследний сегмент URL
          const fullPublicId = `${folderPath}/${publicIdWithoutExt}`

          // Определяем тип ресурса
          const resourceType = url.includes('/video/') ? 'video' : 'image'

          // Пробуем метод destroy
          const result = await cloudinary.uploader.destroy(fullPublicId, {
            resource_type: resourceType,
            invalidate: true
          })

          if (result.result === 'ok' || result.result === 'not found') {
            return res.json({
              success: true,
              message: 'Файл успешно удален (альтернативный метод)',
              result
            })
          } else {
            return res.status(500).json({
              error: 'Не удалось удалить файл альтернативным методом',
              details: result
            })
          }
        } catch (alternativeError) {
          return res.status(500).json({
            error: 'Не удалось удалить файл никакими методами',
            originalError: cloudinaryError.message,
            alternativeError: alternativeError.message
          })
        }
      }
    } catch (error) {
      return res.status(500).json({ error: 'Ошибка удаления медиафайла' })
    }
  }
}

module.exports = PostController

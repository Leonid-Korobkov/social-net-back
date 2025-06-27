const { prisma } = require('../prisma/prisma-client')
const fetchOpenGraphData = require('../utils/opengraph')

const OpenGraphController = {
  async getPostData(req, res) {
    const { id } = req.params

    try {
      const post = await prisma.post.findUnique({
        where: { id: parseInt(id) },
        select: {
          id: true,
          content: true,
          createdAt: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
          viewCount: true,
          media: true,
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

      if (!post) {
        return res.status(404).json({ error: 'Пост не найден' })
      }

      res.json(post)
    } catch (error) {
      console.error('Error in getPostData for OpenGraph', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getLinkPreview(req, res) {
    const { url, postId } = req.body
    if (!url) {
      return res.status(400).json({ error: 'No url provided' })
    }

    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: Number(postId) }
      })
      if (post) {
        if (post.ogImageUrl || post.ogTitle || post.ogDescr || post.ogUrl) {
          return res.json({
            ogImageUrl: post.ogImageUrl,
            ogTitle: post.ogTitle,
            ogDescr: post.ogDescr,
            ogUrl: post.ogUrl
          })
        }
      }
      const ogData = await fetchOpenGraphData(url)
      if (ogData) {
        await prisma.post.update({
          where: { id: Number(postId) },
          data: {
            ogImageUrl: ogData.ogImageUrl,
            ogTitle: ogData.ogTitle,
            ogDescr: ogData.ogDescr,
            ogUrl: ogData.ogUrl
          }
        })
        return res.json(ogData)
      }
      return res.status(404).json({ error: 'No OpenGraph data found' })
    }

    const ogData = await fetchOpenGraphData(url)
    if (ogData) return res.json(ogData)
    return res.status(404).json({ error: 'No OpenGraph data found' })
  },

  async getUserData(req, res) {
    const { username } = req.params

    try {
      const user = await prisma.user.findUnique({
        where: { userName: username },
        select: {
          id: true,
          name: true,
          userName: true,
          avatarUrl: true,
          bio: true,
          showBio: true,
          _count: {
            select: {
              followers: true,
              following: true,
              posts: true
            }
          },
          followers: {
            take: 9,
            include: {
              follower: {
                select: {
                  id: true,
                  name: true,
                  userName: true,
                  avatarUrl: true
                }
              }
            }
          },
          following: {
            take: 9,
            include: {
              following: {
                select: {
                  id: true,
                  name: true,
                  userName: true,
                  avatarUrl: true
                }
              }
            }
          }
        }
      })

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      // Форматируем данные для OpenGraph
      const formattedUser = {
        ...user,
        bio: user.showBio ? user.bio : null,
        followers: user.followers.map((f) => f.follower),
        following: user.following.map((f) => f.following),
        stats: {
          followers: user._count.followers,
          following: user._count.following,
          posts: user._count.posts
        }
      }

      // Удаляем _count из ответа, так как мы уже использовали эти данные
      delete formattedUser._count

      res.json(formattedUser)
    } catch (error) {
      console.error('Error in getUserData for OpenGraph', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = OpenGraphController

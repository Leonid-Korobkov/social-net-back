const { prisma } = require('../prisma/prisma-client')

const SearchController = {
  async search(req, res) {
    try {
      const { query, type = 'all', page = 1, limit = 10 } = req.query
      const currentUserId = req.user.id
      const skip = (page - 1) * limit

      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' })
      }

      const searchResults = {
        users: [],
        posts: [],
        comments: []
      }

      if (type === 'all' || type === 'users') {
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { userName: { contains: query, mode: 'insensitive' } },
              { bio: { contains: query, mode: 'insensitive' } },
              { location: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          },
          select: {
            id: true,
            name: true,
            userName: true,
            avatarUrl: true,
            bio: true,
            location: true,
            dateOfBirth: true,
            email: true,
            showBio: true,
            showLocation: true,
            showDateOfBirth: true,
            showEmail: true,
            followers: {
              where: {
                followerId: currentUserId
              }
            },
            _count: {
              select: {
                followers: true
              }
            }
          },
          orderBy: {
            followers: {
              _count: 'desc'
            }
          },
          skip,
          take: parseInt(limit)
        })

        searchResults.users = users
          .filter((user) => {
            // Если showEmail разрешён — всегда показываем
            if (user.showEmail) return true
            // Если showEmail запрещён — проверяем, было ли совпадение по другим полям
            const queryLower = query.toLowerCase()
            return (
              (user.name && user.name.toLowerCase().includes(queryLower)) ||
              (user.userName &&
                user.userName.toLowerCase().includes(queryLower)) ||
              (user.bio &&
                user.showBio &&
                user.bio.toLowerCase().includes(queryLower)) ||
              (user.location &&
                user.showLocation &&
                user.location.toLowerCase().includes(queryLower))
            )
          })
          .map((user) => {
            return {
              id: user.id,
              name: user.name,
              userName: user.userName,
              avatarUrl: user.avatarUrl,
              bio: user.showBio ? user.bio : null,
              location: user.showLocation ? user.location : null,
              dateOfBirth: user.showDateOfBirth ? user.dateOfBirth : null,
              email: user.showEmail ? user.email : null,
              isFollowing: user.followers.length > 0,
              _count: user._count
            }
          })
          .sort((a, b) => b.isFollowing - a.isFollowing)
      }

      if (type === 'all' || type === 'posts') {
        searchResults.posts = await prisma.post.findMany({
          where: {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } }
            ]
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                userName: true,
                avatarUrl: true
              }
            },
            _count: {
              select: {
                likes: true,
                comments: true
              }
            }
          },
          skip,
          take: parseInt(limit)
        })
      }

      if (type === 'all' || type === 'comments') {
        searchResults.comments = await prisma.comment.findMany({
          where: {
            content: { contains: query, mode: 'insensitive' }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                userName: true,
                avatarUrl: true
              }
            },
            post: {
              select: {
                id: true,
                title: true,
                content: true,
                author: {
                  select: {
                    userName: true
                  }
                }
              }
            },
            _count: {
              select: {
                likes: true
              }
            }
          },
          skip,
          take: parseInt(limit)
        })
      }

      res.json(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

module.exports = SearchController

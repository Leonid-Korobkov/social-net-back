const { prisma } = require('../prisma/prisma-client')

const SearchController = {
  async search (req, res) {
    try {
      const { query, type = 'all', page = 1, limit = 10 } = req.query
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
        searchResults.users = await prisma.user.findMany({
          where: {
            OR: [{ name: { contains: query, mode: 'insensitive' } }]
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            bio: true,
            location: true
          },
          skip,
          take: parseInt(limit)
        })
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
                avatarUrl: true
              }
            },
            post: {
              select: {
                id: true,
                title: true,
                content: true
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

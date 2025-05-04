const { prisma } = require('../prisma/prisma-client')

const FollowController = {
  async followUser (req, res) {
    let { followingId } = req.body
    const userId = req.user.userId

    let username
    let userWithUsername

    if (followingId.toString().startsWith('@')) {
      username = followingId.slice(1)
      userWithUsername = await prisma.user.findUnique({
        where: { userName: username }
      })
      followingId = userWithUsername.id
    } else if (isNaN(followingId)) {
      username = followingId
      userWithUsername = await prisma.user.findUnique({
        where: { userName: username }
      })
      followingId = userWithUsername.id
    } else {
      followingId = parseInt(followingId)
    }

    if (!followingId) {
      return res.status(400).json({ error: 'Пользователь не найден' })
    }
    if (followingId === userId) {
      return res.status(400).json({ error: 'Нельзя подписаться на себя' })
    }

    try {
      const existignSubscription = await prisma.follows.findFirst({
        where: {
          AND: [{ followerId: userId }, { followingId }]
        }
      })

      if (existignSubscription) {
        return res
          .status(400)
          .json({ error: 'Вы уже подписаны на этого пользователя' })
      }

      const follow = await prisma.follows.create({
        data: {
          follower: { connect: { id: userId } },
          following: { connect: { id: followingId } }
        }
      })

      res.status(201).json({ message: 'Подписка создана', follow })
    } catch (error) {
      console.error('Error in followUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async unfollowUser (req, res) {
    let { followingId } = req.body
    const userId = req.user.userId

    let username
    let userWithUsername

    if (followingId.toString().startsWith('@')) {
      username = followingId.slice(1)
      userWithUsername = await prisma.user.findUnique({
        where: { userName: username }
      })
      followingId = userWithUsername.id
    } else if (isNaN(followingId)) {
      username = followingId
      userWithUsername = await prisma.user.findUnique({
        where: { userName: username }
      })
      followingId = userWithUsername.id
    } else {
      followingId = parseInt(followingId)
    }

    if (!followingId) {
      return res.status(400).json({ error: 'Пользователь не найден' })
    }
    if (followingId === userId) {
      return res
        .status(400)
        .json({ error: 'Нельзя подписаться/отписаться на/от себя' })
    }

    try {
      const follows = await prisma.follows.findFirst({
        where: {
          AND: [{ followerId: userId }, { followingId }]
        }
      })

      if (!follows) {
        return res
          .status(400)
          .json({ error: 'Вы не подписаны на этого пользователя' })
      }

      const deletedFollow = await prisma.follows.delete({
        where: {
          id: follows.id
        }
      })

      return res
        .status(201)
        .json({ message: 'Подписка удалена', deletedFollow })
    } catch (error) {
      console.error('Error in unfollowUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = FollowController

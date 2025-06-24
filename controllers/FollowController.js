const { prisma } = require('../prisma/prisma-client')

const FollowController = {
  async followUser(req, res) {
    let { followingId } = req.body
    const userId = req.user.id

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

      // Уведомления — после ответа, асинхронно
      ;(async () => {
        // Получаем данные о подписываемом и подписчике одним запросом
        const [followedUser, followerUser] = await prisma.$transaction([
          prisma.user.findUnique({
            where: { id: followingId },
            select: {
              _count: {
                select: {
                  followers: true
                }
              },
              email: true,
              enablePushNotifications: true,
              enableEmailNotifications: true,
              notifyOnNewFollowerPush: true,
              notifyOnNewFollowerEmail: true
            }
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, userName: true, avatarUrl: true }
          })
        ])
        // Email
        if (
          followedUser?.enableEmailNotifications &&
          followedUser?.notifyOnNewFollowerEmail &&
          followedUser.email
        ) {
          // Здесь можно использовать emailService.sendNewFollowerEmail
          // await emailService.sendNewFollowerEmail(followedUser.email, followerUser.userName, followerUser.name)
        }
        // Push
        if (
          followedUser?.enablePushNotifications &&
          followedUser?.notifyOnNewFollowerPush
        ) {
          const pushSubscriptions = await prisma.pushSubscription.findMany({
            where: { userId: followingId }
          })
          const { FRONTEND_URL } = require('../contstants')
          const webpush = require('../services/webpush.service')
          for (const sub of pushSubscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: sub.keys
                },
                JSON.stringify({
                  title: `Новый подписчик!`,
                  body: `Пользователь @${followerUser.userName || followerUser.name} подписался на вас. Теперь у вас ${followedUser._count.followers} подписчиков`,
                  url: `${FRONTEND_URL}/${followerUser.userName}`,
                  icon:
                    followerUser.avatarUrl ||
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
      console.error('Error in followUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async unfollowUser(req, res) {
    let { followingId } = req.body
    const userId = req.user.id

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

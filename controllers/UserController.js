const { prisma } = require('../prisma/prisma-client')
const bcrypt = require('bcryptjs')
const jdenticon = require('jdenticon')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const cloudinary = require('cloudinary').v2

const UserController = {
  async register(req, res) {
    const { email, password, name, userName} = req.body

    if (!email || !password || !name || !userName) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const isExistUserEmail = await prisma.user.findUnique({
        where: { email }
      })

      const isExistUserName = await prisma.user.findUnique({
        where: { userName }
      })

      if (isExistUserEmail) {
        return res
          .status(400)
          .json({ error: 'Пользователь с таким email уже существует' })
      }
      else if (isExistUserName) {
        return res
          .status(400)
          .json({ error: 'Пользователь с таким username уже существует' })
      }

      const hashPassword = await bcrypt.hash(password, 10)

      // Генерируем аватар и загружаем его в Cloudinary
      const size = 400
      const generatedImage = jdenticon.toPng(name, size)
      
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: 'social-net',
            resource_type: 'auto',
            format: 'webp',
            transformation: [{ quality: 'auto:best' }]
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(generatedImage)
      })

      const user = await prisma.user.create({
        data: {
          email: email,
          userName: userName,
          password: hashPassword,
          name: name,
          avatarUrl: result.secure_url
        }
      })

      res.json({
        id: user.id,
        message: 'Пользователь успешно зарегистрирован'
      })
    } catch (error) {
      console.error('Error in register', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async login(req, res) {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return res.status(400).json({ error: 'Неверная почта или пароль' })
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Неверная почта или пароль' })
      }

      const token = jwt.sign({ userId: user.id }, process.env.SECRET_KEY)

      res.json({ token })
    } catch (error) {
      console.error('Error in login', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере. Не удалось подключится к базе данных' })
    }
  },

  async updateUser(req, res) {
    let { id } = req.params
    const { name, email, bio, location, dateOfBirth, userName } = req.body
    id = parseInt(id)

    if (id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    try {
      if (email) {
        const isExistUser = await prisma.user.findFirst({
          where: { id: req.user.userId }
        })

        if (isExistUser && isExistUser.id !== id) {
          return res.status(400).json({
            error: 'Пользователь не найден'
          })
        }

        const existingEmail = await prisma.user.findFirst({
          where: { email }
        })

        const existingUserName = await prisma.user.findFirst({
          where: { userName }
        })

        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({
            error:
              'Пользователь с таким email уже существует. Не получилось обновить данные'
          })
        }

        else if (existingUserName && existingUserName.id !== id) {
          return res.status(400).json({
            error:
              'Пользователь с таким username уже существует. Не получилось обновить данные'
          })
        }
      }

      const user = await prisma.user.update({
        where: { id: id },
        data: {
          name: name || undefined,
          email: email || undefined,
          userName: userName || undefined,
          bio: bio || '',
          location: location || '',
          dateOfBirth: dateOfBirth || null,
          avatarUrl: req.file?.cloudinaryUrl || undefined
        }
      })
      res.json(user)
    } catch (error) {
      console.error('Error in updateUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async currentUser(req, res) {

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          password: false,
          followers: {
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
          },
          posts: false
        },
      })
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }
      res.json(user)
    } catch (error) {
      console.error('Error in currentUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getUserById(req, res) {
    let { id } = req.params // ID из параметров маршрута
    const userId = req.user.userId // ID текущего пользователя
    id = parseInt(id)

    try {
      // Получаем всю необходимую информацию в одном запросе
      const [user, currentUserFollowing, postCount] = await prisma.$transaction([
        prisma.user.findUnique({
          where: { id },
          include: {
            followers: {
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
            },
            posts: false
          }
        }),
        // Получаем список всех пользователей, на которых подписан текущий пользователь
        prisma.follows.findMany({
          where: {
            followerId: userId
          },
          select: {
            followingId: true
          }
        }),
        // Получаем количество постов пользователя
        prisma.post.count({
          where: {
            authorId: id
          }
        })
      ])

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      // Создаем Set для быстрого поиска
      const followingIds = new Set(currentUserFollowing.map(f => f.followingId))

      // Обрабатываем подписчиков
      const followersWithInfo = user.followers.map(f => {
        if (!f.follower) return f
        return {
          ...f,
          follower: {
            ...f.follower,
            isFollowing: followingIds.has(f.follower.id)
          }
        }
      })

      // Обрабатываем подписки
      const followingWithInfo = user.following.map(f => {
        if (!f.following) return f
        return {
          ...f,
          following: {
            ...f.following,
            isFollowing: followingIds.has(f.following.id)
          }
        }
      })

      // Возвращаем данные пользователя и статус подписки
      res.json({
        ...user,
        isFollowing: followingIds.has(id),
        followers: followersWithInfo,
        following: followingWithInfo,
        postCount
      })
    } catch (error) {
      console.error('Error in getUserById', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = UserController

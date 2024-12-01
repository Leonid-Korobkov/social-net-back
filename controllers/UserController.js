const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const bcrypt = require('bcryptjs')
const jdenticon = require('jdenticon')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { ObjectId } = require('mongodb')
require('dotenv').config()

const UserController = {
  async register (req, res) {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      const isExistUser = await prisma.user.findUnique({ where: { email } })

      if (isExistUser) {
        return res
          .status(400)
          .json({ error: 'Пользователь с таким email уже существует' })
      }

      const hashPassword = await bcrypt.hash(password, 10)

      const size = 200
      const generatedImage = jdenticon.toPng(name, size)
      const avatarName = `${email}_${Date.now()}.png`
      const pathToFile = path.join(__dirname, '/../uploads', avatarName)
      fs.writeFileSync(pathToFile, generatedImage)

      const user = await prisma.user.create({
        data: {
          email: email,
          password: hashPassword,
          name: name,
          avatarUrl: `/uploads/${avatarName}`
        }
      })

      res.json(user)
    } catch (error) {
      console.error('Error in register', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async login (req, res) {
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
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getUserById (req, res) {
    const { id } = req.params // ID из параметров маршрута
    const userId = req.user.userId // ID текущего пользователя

    try {
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' })
      }

      const objId = new ObjectId(id)

      // Ищем пользователя в базе
      const user = await prisma.user.findUnique({
        where: { id: objId },
        include: {
          followers: true,
          following: true
        }
      })

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      // Проверяем, подписан ли текущий пользователь на данного
      const isFollowing = await prisma.follows.findFirst({
        where: {
          AND: [{ followerId: userId }, { followingId: objId }]
        }
      })

      // Возвращаем данные пользователя и статус подписки
      res.json({ ...user, isFollowing: Boolean(isFollowing) })
    } catch (error) {
      console.error('Error in getUserById', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async updateUser (req, res) {
    const { id } = req.params
    const { name, email, bio, location, dateOfBirth } = req.body

    let filePath

    if (req.file && req.file.path) {
      filePath = req.file.path
    }
    if (id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    try {
      // Проверяем, является ли ID валидным ObjectId для mongodb
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' })
      }

      // Преобразуем id в ObjectId для поиска
      const objId = new ObjectId(id)

      if (email) {
        const isExistUser = await prisma.user.findFirst({ where: { email } })

        if (isExistUser && isExistUser.id !== objId) {
          return res
            .status(400)
            .json({ error: 'Пользователь с таким email уже существует' })
        }
      }

      const user = await prisma.user.update({
        where: { id: objId },
        data: {
          name: name || undefined,
          email: email || undefined,
          bio: bio || undefined,
          location: location || undefined,
          dateOfBirth: dateOfBirth || undefined,
          avatarUrl: filePath ? `/${filePath}` : undefined
        }
      })
      res.json(user)
    } catch (error) {
      console.error('Error in updateUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async currentUser (req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: {
          followers: {
            include: {
              follower: true
            }
          },
          following: {
            include: {
              following: true
            }
          },
          posts: true
        }
      })
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }
      res.json(user)
    } catch (error) {
      console.error('Error in currentUser', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = UserController

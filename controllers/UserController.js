const { prisma } = require('../prisma/prisma-client')
const bcrypt = require('bcryptjs')
const jdenticon = require('jdenticon')
const jwt = require('jsonwebtoken')
const cloudinary = require('cloudinary').v2
const uuid = require('uuid')
const emailService = require('../services/email.service')
const {
  generateVerificationCode,
  parseUserAgent
} = require('../utils/auth.utils')
const { userCache } = require('../middleware/auth')
const requestIp = require('request-ip')
const dns = require('dns')
const { promisify } = require('util')

// Helper function to validate email format and check MX records
const validateEmail = async (email) => {
  const domain = email.split('@')[1]

  try {
    // Check MX records for the domain
    const resolveMx = promisify(dns.resolveMx)
    const mxRecords = await resolveMx(domain)
    
    if (!mxRecords || mxRecords.length === 0) {
      throw new Error('Домен не имеет настроенных почтовых серверов')
    }
    
    return true
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      throw new Error('Домен не существует')
    }
    throw error
  }
}

// Helper function for token generation and device info
const generateTokensAndDeviceInfo = async (
  user,
  req,
  res,
  existingTokenId = null
) => {
  // Генерируем токены
  const accessToken = jwt.sign({ userId: user.id }, process.env.SECRET_KEY, {
    expiresIn: '30m'
  })

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_SECRET_KEY,
    { expiresIn: '30d' }
  )

  // Парсим информацию об устройстве
  const userAgent = req.headers['user-agent'] || 'Unknown device'
  const ipAddress = requestIp.getClientIp(req)
  const deviceInfo = {
    ...parseUserAgent(userAgent),
    ipAddress,
    timestamp: new Date().toISOString()
  }

  // Сохраняем или обновляем refresh token
  if (existingTokenId) {
    await prisma.refreshToken.update({
      where: { id: existingTokenId },
      data: {
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceInfo: JSON.stringify(deviceInfo),
        lastUsedAt: new Date()
      }
    })
  } else {
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceInfo: JSON.stringify(deviceInfo),
        isCurrentSession: true
      }
    })
  }

  // Устанавливаем HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined
  })

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      userName: user.userName,
      isEmailVerified: user.isEmailVerified
    }
  }
}

const UserController = {
  async register(req, res) {
    const { email, password, name, userName } = req.body

    if (!email || !password || !name || !userName) {
      return res.status(400).json({ error: 'Все поля должны быть заполнены' })
    }

    try {
      // Приводим email к нижнему регистру перед проверкой
      const normalizedEmail = email.toLowerCase()

      // Проверяем существование email
      await validateEmail(normalizedEmail)

      const isExistUserEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive' // Это обеспечит поиск без учета регистра
          }
        }
      })

      const isExistUserName = await prisma.user.findUnique({
        where: { userName: userName.toLowerCase() } // Приводим userName к нижнему регистру
      })

      if (isExistUserEmail) {
        return res
          .status(400)
          .json({ error: 'Пользователь с таким email уже существует' })
      } else if (isExistUserName) {
        return res
          .status(400)
          .json({ error: 'Пользователь с таким username уже существует' })
      }

      const hashPassword = await bcrypt.hash(password, 10)

      // Генерируем аватар
      const size = 400
      const generatedImage = jdenticon.toPng(name, size)

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
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
          )
          .end(generatedImage)
      })

      // Создаем пользователя
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          userName: userName.toLowerCase(),
          password: hashPassword,
          name,
          avatarUrl: result.secure_url,
          isEmailVerified: false
        }
      })

      // Генерируем код подтверждения
      const verificationCode = generateVerificationCode()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

      await prisma.emailVerification.create({
        data: {
          userId: user.id,
          code: verificationCode,
          expiresAt
        }
      })

      // Отправляем email с кодом
      await emailService.sendVerificationEmail(email, verificationCode)

      res.json({
        id: user.id,
        message:
          'Вы успешно зарегистрированы. Пожалуйста, проверьте вашу почту для подтверждения email.'
      })
    } catch (error) {
      console.error('Error in register', error)
      if (error.message === 'Email не существует') {
        return res.status(400).json({ error: 'Указанный email не существует' })
      }
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async verifyEmail(req, res) {
    const { code, token } = req.body

    try {
      // Декодируем токен
      const decodedToken = Buffer.from(token, 'base64').toString()
      const userId = decodedToken.split('_')[0] // Получаем userId из токена

      const verification = await prisma.emailVerification.findFirst({
        where: {
          userId: parseInt(userId),
          code,
          expiresAt: {
            gt: new Date()
          }
        }
      })

      if (!verification) {
        return res
          .status(400)
          .json({ error: 'Неверный или истекший код подтверждения' })
      }

      const user = await prisma.user.update({
        where: { id: parseInt(userId) },
        data: { isEmailVerified: true }
      })

      await prisma.emailVerification.delete({
        where: { id: verification.id }
      })

      // Генерируем токены и информацию об устройстве
      const { accessToken, user: userData } = await generateTokensAndDeviceInfo(
        user,
        req,
        res
      )

      res.json({
        message: 'Email успешно подтвержден',
        accessToken,
        user: userData
      })
    } catch (error) {
      console.error('Error in verifyEmail', error)
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

      // Проверяем, не заблокирован ли пользователь
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(403).json({
          error: 'Аккаунт заблокирован. Попробуйте через 15 минут.',
          lockedUntil: user.lockedUntil
        })
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        // Увеличиваем счетчик неудачных попыток
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: user.failedLoginAttempts + 1,
            lockedUntil:
              user.failedLoginAttempts >= 4
                ? new Date(Date.now() + 15 * 60 * 1000)
                : null // Блокировка на 15 минут после 5 неудачных попыток
          }
        })
        return res.status(400).json({ error: 'Неверная почта или пароль' })
      }

      // Проверяем, подтвержден ли email
      if (!user.isEmailVerified) {
        // Генерируем новый код подтверждения
        const verificationCode = generateVerificationCode()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

        // Удаляем старые коды подтверждения
        await prisma.emailVerification.deleteMany({
          where: { userId: user.id }
        })

        // Создаем новую запись с кодом
        await prisma.emailVerification.create({
          data: {
            userId: user.id,
            code: verificationCode,
            expiresAt
          }
        })

        // Отправляем email с кодом
        await emailService.sendVerificationEmail(user.email, verificationCode)

        // Сбрасываем счетчик неудачных попыток, но не даем войти
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date()
          }
        })

        return res.status(403).json({
          error: 'Email не подтвержден',
          message: 'На вашу почту отправлен новый код подтверждения',
          requiresVerification: true,
          userId: user.id
        })
      }

      // Сбрасываем счетчик неудачных попыток
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        }
      })

      // Генерируем токены и информацию об устройстве
      const { accessToken, user: userData } = await generateTokensAndDeviceInfo(
        user,
        req,
        res
      )

      res.json({
        accessToken,
        user: userData
      })
    } catch (error) {
      console.error('Error in login', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async refreshToken(req, res) {
    const { refreshToken } = req.cookies

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token не предоставлен' })
    }

    try {
      const token = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
      })

      if (!token || token.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Недействительный refresh token' })
      }

      // Генерируем новые токены и информацию об устройстве, передавая ID существующего токена
      const { accessToken, user: userData } = await generateTokensAndDeviceInfo(
        token.user,
        req,
        res,
        token.id
      )

      res.json({ accessToken })
    } catch (error) {
      console.error('Error in refreshToken', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async logout(req, res) {
    const { refreshToken } = req.cookies

    try {
      if (refreshToken) {
        // First check if the token exists
        const existingToken = await prisma.refreshToken.findUnique({
          where: { token: refreshToken }
        })

        // Only delete if the token exists
        if (existingToken) {
          await prisma.refreshToken.delete({
            where: { token: refreshToken }
          })
        }
      }

      // Очистить cookie с теми же настройками
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined
      })

      res.json({ message: 'Успешный выход из системы' })
    } catch (error) {
      console.error('Error in logout', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async logoutAllDevices(req, res) {
    try {
      await prisma.refreshToken.deleteMany({
        where: { userId: req.user.id }
      })
      userCache.del(req.user.id)

      res.json({ message: 'Выход выполнен со всех устройств' })
    } catch (error) {
      console.error('Error in logoutAllDevices', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async updateUser(req, res) {
    let { id } = req.params
    const { name, email, bio, location, dateOfBirth, userName, avatar } =
      req.body
    id = parseInt(id)

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    try {
      const isExistUser = await prisma.user.findFirst({
        where: { id: req.user.id }
      })

      if (isExistUser && isExistUser.id !== id) {
        return res.status(400).json({
          error: 'Пользователь не найден'
        })
      }

      if (email) {
        const existingEmail = await prisma.user.findFirst({
          where: { email }
        })
        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({
            error:
              'Пользователь с таким email уже существует. Не получилось обновить данные'
          })
        }
      }
      if (userName) {
        const existingUserName = await prisma.user.findFirst({
          where: { userName }
        })

        if (existingUserName && existingUserName.id !== id) {
          return res.status(400).json({
            error:
              'Пользователь с таким username уже существует. Не получилось обновить данные'
          })
        }
      }

      const newImg = req.file
        ? req.file?.cloudinaryUrl
        : avatar
          ? avatar
          : undefined

      const user = await prisma.user.update({
        where: { id: id },
        data: {
          name: name || undefined,
          email: email || undefined,
          userName: userName || undefined,
          bio: bio || '',
          location: location || '',
          dateOfBirth: dateOfBirth || null,
          avatarUrl: newImg
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
        where: { id: req.user.id },
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
  },

  async getUserById(req, res) {
    let { id } = req.params // ID из параметров маршрута
    const userId = req.user.id // ID текущего пользователя

    let username
    let userWithUsername

    try {
      if (id.toString().startsWith('@')) {
        username = id.slice(1)
        userWithUsername = await prisma.user.findUnique({
          where: { userName: username }
        })
        id = userWithUsername.id
      } else if (isNaN(id)) {
        username = id
        userWithUsername = await prisma.user.findUnique({
          where: { userName: username }
        })
        id = userWithUsername.id
      } else {
        id = parseInt(id)
      }
      // Получаем всю необходимую информацию в одном запросе
      const [user, currentUserFollowing, postCount] = await prisma.$transaction(
        [
          prisma.user.findUnique({
            where: username ? { userName: username } : { id },
            include: {
              password: false,
              followers: {
                include: {
                  follower: {
                    select: {
                      id: true,
                      name: true,
                      userName: true,
                      avatarUrl: true,
                      _count: {
                        select: { followers: true }
                      }
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
                      avatarUrl: true,
                      _count: {
                        select: { followers: true }
                      }
                    }
                  }
                }
              },
              posts: false,
              _count: {
                select: {
                  followers: true
                }
              }
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
        ]
      )

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      // Создаем Set для быстрого поиска
      const followingIds = new Set(
        currentUserFollowing.map((f) => f.followingId)
      )

      // Обрабатываем подписчиков
      const followersWithInfo = user.followers.map((f) => {
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
      const followingWithInfo = user.following.map((f) => {
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
        bio: user.showBio ? user.bio : null,
        location: user.showLocation ? user.location : null,
        dateOfBirth: user.showDateOfBirth ? user.dateOfBirth : null,
        email: user.showEmail ? user.email : null,
        isFollowing: followingIds.has(id),
        followers: followersWithInfo,
        following: followingWithInfo,
        postCount
      })
    } catch (error) {
      console.error('Error in getUserById', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async getUserSettings(req, res) {
    try {
      const { userId } = req.params
      const settings = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: {
          showEmail: true,
          showBio: true,
          showLocation: true,
          showDateOfBirth: true,
          reduceAnimation: true
        }
      })
      res.json(settings)
    } catch (error) {
      res.status(500).json({ message: error.message })
    }
  },

  async updateUserSettings(req, res) {
    try {
      const userId = req.user.id
      const {
        showEmail,
        showBio,
        showLocation,
        showDateOfBirth,
        reduceAnimation
      } = req.body

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          showEmail: Boolean(showEmail),
          showBio: Boolean(showBio),
          showLocation: Boolean(showLocation),
          showDateOfBirth: Boolean(showDateOfBirth),
          reduceAnimation: Boolean(reduceAnimation)
        }
      })

      return res.json({ message: 'Настройки сохранены', updatedUser })
    } catch (error) {
      return res.status(500).json({
        error: 'Что-то пошло не так на сервере. Не удалось применить настройки',
        errorMessage: error
      })
    }
  },

  async getNewRandomImage(req, res) {
    try {
      // Генерируем аватар и загружаем его в Cloudinary
      const size = 400
      const generatedImage = jdenticon.toPng(uuid.v4(), size)

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
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
          )
          .end(generatedImage)
      })
      return res.json(result.secure_url)
    } catch (error) {
      console.error('Error in getNewRandomImage', error)
      return res.status(500).json({
        error:
          'Что-то пошло не так на сервере. Не удалось сгенерировать изображение'
      })
    }
  },

  async deleteUser(req, res) {
    try {
      const { confirmationText } = req.body
      if (confirmationText !== 'Delete') {
        return res
          .status(400)
          .json({ errorMessage: 'Для удаления аккаунта введите Delete' })
      }
      const userId = parseInt(req.params.id)
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res.status(404).json({ errorMessage: 'Пользователь не найден' })
      }
      // Каскадное удаление всех связанных данных
      await prisma.$transaction([
        prisma.commentLike.deleteMany({ where: { userId } }),
        prisma.commentLike.deleteMany({ where: { comment: { userId } } }),
        prisma.like.deleteMany({ where: { userId } }),
        prisma.like.deleteMany({ where: { post: { authorId: userId } } }),
        prisma.comment.deleteMany({ where: { userId } }),
        prisma.comment.deleteMany({ where: { post: { authorId: userId } } }),
        prisma.follows.deleteMany({ where: { followerId: userId } }),
        prisma.follows.deleteMany({ where: { followingId: userId } }),
        prisma.postView.deleteMany({ where: { userId } }),
        prisma.postView.deleteMany({ where: { post: { authorId: userId } } }),
        prisma.postShare.deleteMany({ where: { userId } }),
        prisma.postShare.deleteMany({ where: { post: { authorId: userId } } }),
        prisma.post.deleteMany({ where: { authorId: userId } }),
        prisma.user.delete({ where: { id: userId } })
      ])
      res.status(200).json({ message: 'Аккаунт успешно удален' })
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error)
      res
        .status(500)
        .json({ errorMessage: 'Ошибка сервера при удалении аккаунта' })
    }
  },

  async resendVerification(req, res) {
    const { token } = req.body

    try {
      // Декодируем токен
      const decodedToken = Buffer.from(token, 'base64').toString()
      const userId = decodedToken.split('_')[0] // Получаем userId из токена

      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) }
      })

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Email уже подтвержден' })
      }

      // Генерируем новый код подтверждения
      const verificationCode = generateVerificationCode()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

      // Удаляем старые коды подтверждения
      await prisma.emailVerification.deleteMany({
        where: { userId: user.id }
      })

      // Создаем новую запись с кодом
      await prisma.emailVerification.create({
        data: {
          userId: user.id,
          code: verificationCode,
          expiresAt
        }
      })

      // Отправляем email с кодом
      await emailService.sendVerificationEmail(user.email, verificationCode)

      res.json({ message: 'Код подтверждения отправлен повторно.' })
    } catch (error) {
      console.error('Error in resendVerification', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = UserController

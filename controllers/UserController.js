const { prisma } = require('../prisma/prisma-client')
const bcrypt = require('bcryptjs')
const jdenticon = require('jdenticon')
const cloudinary = require('cloudinary').v2
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/email.service')
const redisService = require('../services/redis.service')
const {
  generateVerificationCode,
} = require('../utils/auth.utils')
const requestIp = require('request-ip')
const dns = require('dns')
const { promisify } = require('util')
const UAParser = require('ua-parser-js')
const { lookup } = require('ip-location-api');
const websocketService = require('../services/websocket.service');


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



// Helper function to create session
const createSession = async (user, req, res) => {
  const sessionId = uuidv4()
  const userAgent = new UAParser(req.headers['user-agent'])
  const ipAddress = requestIp.getClientIp(req)
  const geo = lookup(ipAddress, { addCountryInfo: true })


  const sessionData = {
    sessionId,
    userId: user.id,
    browser: userAgent.getBrowser().name,
    browserVersion: userAgent.getBrowser().version,
    os: userAgent.getOS().name,
    device: userAgent.getDevice().type || 'desktop',
    ipAddress,
    location: {
      country: geo?.country_name || 'Неизвестно',
      city: geo?.city || 'Неизвестно',
      region1: geo?.region1_name || 'Неизвестно',
      region2: geo?.region2_name || 'Неизвестно',
      capital: geo?.capital || 'Неизвестно'
    },
    timestamp: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      userName: user.userName,
      isEmailVerified: user.isEmailVerified,
      avatarUrl: user.avatarUrl
    }
  }

  await redisService.setSession(sessionId, sessionData)
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней в миллисекундах
  })

  return sessionData
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

      // Создаем сессию после подтверждения email
      const session = await createSession(user, req, res)

      res.json({
        message: 'Email успешно подтвержден',
        user: session.user
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

      // Создаем сессию после успешного входа
      const session = await createSession(user, req, res)

      const loginTime = new Date(session.timestamp).toLocaleString('ru-RU', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Europe/Moscow'
        })

      emailService.sendNewLoginEmail(
        session.ipAddress,
        `${session.device} (${session.browser}, ${session.os})`,
        `${session.location.city}, ${session.location.region1}, ${session.location.country}`,
        loginTime,
        user.email
      )

      await websocketService.notifySessionUpdate(user.id, session.sessionId);

      res.json({
        user: session.user
      })
    } catch (error) {
      console.error('Error in login', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },
  async logout(req, res) {
    try {
      if (req.session) {
        await redisService.deleteSession(req.session.sessionId)
      }

      res.clearCookie('sessionId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/'
      })

      res.json({ message: 'Успешный выход из системы' })
    } catch (error) {
      console.error('Error in logout', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async logoutAllDevices(req, res) {
    try {
      await redisService.deleteUserSessions(req.user.id)
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
      const generatedImage = jdenticon.toPng(uuidv4(), size)

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
  },

  async forgotPassword(req, res) {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' })
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user) {
        return res.status(404).json({ error: 'Пользователь с таким email не найден' })
      }

      const resetCode = generateVerificationCode() // Используем ту же логику для генерации кода
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

      // Удаляем старые коды сброса пароля для этого пользователя
      await prisma.passwordReset.deleteMany({ where: { userId: user.id } })

      // Создаем новую запись с кодом сброса
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          code: resetCode,
          expiresAt,
        },
      })

      await emailService.sendPasswordResetCode(email, resetCode)

      res.json({ message: 'Код сброса пароля отправлен на ваш email.' })
    } catch (error) {
      console.error('Error in forgotPassword', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async verifyResetCode(req, res) {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({ error: 'Email и код обязательны' })
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      const resetEntry = await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          code: code,
          expiresAt: {
            gt: new Date(),
          },
        },
      })

      if (!resetEntry) {
        return res.status(400).json({ error: 'Неверный или истекший код сброса пароля' })
      }

      res.json({ message: 'Код подтвержден. Можно сбрасывать пароль.', userId: user.id })
    } catch (error) {
      console.error('Error in verifyResetCode', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  },

  async resetPassword(req, res) {
    const { email, code, newPassword } = req.body

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, код и новый пароль обязательны' })
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' })
      }

      const resetEntry = await prisma.passwordReset.findFirst({
        where: {
          userId: user.id,
          code: code,
          expiresAt: {
            gt: new Date(),
          },
        },
      })

      if (!resetEntry) {
        return res.status(400).json({ error: 'Неверный или истекший код сброса пароля' })
      }

      const hashPassword = await bcrypt.hash(newPassword, 10)

      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashPassword },
      })

      // Удаляем использованный код сброса
      await prisma.passwordReset.delete({ where: { id: resetEntry.id } })

      res.json({ message: 'Пароль успешно обновлен.' })
    } catch (error) {
      console.error('Error in resetPassword', error)
      return res.status(500).json({ error: 'Что-то пошло не так на сервере' })
    }
  }
}

module.exports = UserController

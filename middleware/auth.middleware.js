const jwt = require('jsonwebtoken')
const redisService = require('../services/redis.service')
const rateLimit = require('express-rate-limit')
const UAParser = require('ua-parser-js')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const requestIp = require('request-ip')

// Rate limiter для защиты от брутфорса
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток
  message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return requestIp.getClientIp(req)
  }
})

// Middleware для проверки CSRF токена
const csrfProtection = (req, res, next) => {
  const csrfToken = req.headers['x-csrf-token']
  const sessionToken = req.cookies['csrf-token']

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({ error: 'Недействительный CSRF токен' })
  }

  next()
}

// Основной middleware для аутентификации и управления сессиями
const authMiddleware = async (req, res, next) => {
  try {
    const sessionId = req.cookies.sessionId || req.headers['x-session-id']

    if (!sessionId) {
      return res.status(401).json({ message: 'Сессия не найдена' })
    }

    // Получаем сессию из Redis
    const session = await redisService.getSession(sessionId)
    if (!session) {
      return res.status(401).json({ message: 'Недействительная сессия' })
    }

    // Проверяем, не истек ли срок действия сессии
    const lastActivity = new Date(session.lastActivity)
    const now = new Date()
    const sessionTimeout = 24 * 60 * 60 * 1000 // 24 часа

    if (now - lastActivity > sessionTimeout) {
      await redisService.deleteSession(sessionId)
      return res.status(401).json({ message: 'Сессия истекла' })
    }

    // Обновляем время последней активности
    await redisService.updateSessionActivity(sessionId)

    // Проверяем, подтвержден ли email
    if (!session.user.isEmailVerified) {
      return res.status(403).json({
        message: 'Email не подтвержден',
        requiresVerification: true,
        userId: session.user.id
      })
    }

    // Добавляем пользователя и сессию в объект запроса
    req.user = session.user
    req.session = session
    next()
  } catch (error) {
    console.error('Ошибка аутентификации:', error)
    res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
}

// Middleware для создания новой сессии
const createSessionMiddleware = async (req, res, next) => {
  try {
    const sessionId = req.cookies.sessionId || req.headers['x-session-id']

    if (!sessionId) {
      // Создание новой сессии
      const newSessionId = uuidv4()
      const userAgent = new UAParser(req.headers['user-agent'])
      const ipAddress = requestIp.getClientIp(req)

      let geo = {}
      try {
        const response = await axios.get(
          `http://ip-api.com/json/${ipAddress}?lang=ru`
        )
        geo = response.data
      } catch (error) {
        console.error('Ошибка при получении геоданных с ip-api.com:', error)
      }

      const sessionData = {
        sessionId: newSessionId,
        userId: req.user?.id || null,
        browser: userAgent.getBrowser().name,
        browserVersion: userAgent.getBrowser().version,
        os: userAgent.getOS().name,
        device: userAgent.getDevice().type || 'desktop',
        ipAddress,
        location: {
          country: geo?.country || 'Неизвестно',
          city: geo?.city || 'Неизвестно',
          region1: geo?.regionName || 'Неизвестно',
          region2: geo?.region || 'Неизвестно'
        },
        timestamp: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        user: req.user || null
      }

      await redisService.setSession(newSessionId, sessionData)
      res.cookie('sessionId', newSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        // maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней в миллисекундах
        maxAge: 100 * 365 * 24 * 60 * 60 * 1000 // 100 лет
      })

      req.session = sessionData
    }

    next()
  } catch (error) {
    console.error('Ошибка создания сессии:', error)
    res.status(500).json({ message: 'Внутренняя ошибка сервера' })
  }
}

module.exports = {
  authMiddleware,
  createSessionMiddleware,
  loginLimiter,
  csrfProtection
}

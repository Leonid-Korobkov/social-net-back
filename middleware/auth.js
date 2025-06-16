// const jwt = require('jsonwebtoken')
// const { prisma } = require('../prisma/prisma-client')
// const rateLimit = require('express-rate-limit')
// const NodeCache = require('node-cache')

// // Rate limiter для защиты от брутфорса
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 минут
//   max: 5, // 5 попыток
//   message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
//   standardHeaders: true, // Возвращаем RateLimit-* заголовки
//   legacyHeaders: false, // Отключаем X-RateLimit-* заголовки
//   // Используем IP из X-Forwarded-For, если приложение за прокси
//   keyGenerator: (req) => {
//     return req.headers['x-forwarded-for']?.split(',')[0] || req.ip
//   }
// })

// // Cache user data for 15 minutes
// export const userCache = new NodeCache({ stdTTL: 900 })

// // Middleware для проверки CSRF токена
// const csrfProtection = (req, res, next) => {
//   const csrfToken = req.headers['x-csrf-token']
//   const sessionToken = req.cookies['csrf-token']

//   if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
//     return res.status(403).json({ error: 'Недействительный CSRF токен' })
//   }

//   next()
// }

// // Middleware для проверки access token
// const authenticateToken = async (req, res, next) => {
//   const authHeader = req.headers.authorization
//   const token = authHeader && authHeader.split(' ')[1]

//   if (!token) {
//     return res.status(401).json({ error: 'Пользователь не авторизован' })
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.SECRET_KEY)

//     // Try to get user from cache first
//     let user = userCache.get(decoded.userId)

//     if (!user) {
//       // If not in cache, get from database
//       user = await prisma.user.findUnique({
//         where: { id: decoded.userId },
//         select: {
//           id: true,
//           email: true,
//           name: true,
//           userName: true,
//           isEmailVerified: true,
//           avatarUrl: true
//         }
//       })

//       if (!user) {
//         return res.status(401).json({ error: 'Пользователь не найден' })
//       }

//       // Store in cache
//       userCache.set(decoded.userId, user)
//     }

//     req.user = user
//     next()
//   } catch (error) {
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ error: 'Токен истек' })
//     }
//     return res.status(403).json({ error: 'Недействительный токен' })
//   }
// }

// // Middleware для проверки подтверждения email
// const requireEmailVerification = async (req, res, next) => {
//   if (!req.user.isEmailVerified) {
//     return res.status(403).json({ error: 'Требуется подтверждение email' })
//   }
//   next()
// }

// // Middleware для проверки refresh token
// const authenticateRefreshToken = async (req, res, next) => {
//   const { refreshToken } = req.body

//   if (!refreshToken) {
//     return res.status(401).json({ error: 'Refresh token не предоставлен' })
//   }

//   try {
//     const token = await prisma.refreshToken.findUnique({
//       where: { token: refreshToken },
//       include: { user: true }
//     })

//     if (!token || token.expiresAt < new Date()) {
//       return res.status(401).json({ error: 'Недействительный refresh token' })
//     }

//     req.user = token.user
//     req.refreshToken = token
//     next()
//   } catch (error) {
//     return res.status(403).json({ error: 'Ошибка аутентификации' })
//   }
// }

// module.exports = {
//   authenticateToken,
//   authenticateRefreshToken,
//   requireEmailVerification,
//   csrfProtection,
//   loginLimiter
// }

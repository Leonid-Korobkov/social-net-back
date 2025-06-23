const express = require('express')
const router = express.Router()
const { recalculateScores } = require('../utils/recalculatePostScores')
const redisService = require('../services/redis.service')

const { SystemAuth } = require('../middleware/auth.system')

// Применение middleware аутентификации
router.use(SystemAuth)

// Принудительный пересчет скоров
router.post('/recalculate-scores', async (req, res) => {
  try {
    console.log('Запуск принудительного пересчета скоров через API')

    // Запускаем пересчет в фоне
    recalculateScores()
      .then(() => {
        console.log('Пересчет скоров завершен успешно')
      })
      .catch((error) => {
        console.error('Ошибка при пересчете скоров:', error)
      })

    res.json({
      success: true,
      message: 'Пересчет скоров запущен в фоновом режиме',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Ошибка при запуске пересчета скоров:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Очистка старых сессий
router.post('/cleanup-sessions', async (req, res) => {
  try {
    const { maxAge = 30 } = req.body // По умолчанию удаляем сессии старше 7 дней

    // Здесь должна быть логика очистки старых сессий из Redis
    // Пример реализации:
    const allSessions = await redisService.getAllSessions()
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000)
    let removedCount = 0

    for (const sessionId of allSessions) {
      const session = await redisService.getSession(sessionId)
      if (session && new Date(session.createdAt) < cutoffDate) {
        await redisService.deleteSession(sessionId)
        removedCount++
      }
    }

    res.json({
      success: true,
      message: `Удалено ${removedCount} старых сессий`,
      removedCount,
      maxAge,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Ошибка при очистке сессий:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Получение системной информации
router.get('/system-info', (req, res) => {
  try {
    const info = {
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV
      },
      websocket: websocketService.getConnectionStats()
    }

    res.json(info)
  } catch (error) {
    console.error('Ошибка при получении системной информации:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router

const express = require('express')
const router = express.Router()
const websocketService = require('../services/websocket.service')
const { SystemAuth } = require('../middleware/auth.system')

// Применение middleware аутентификации
router.use(SystemAuth)

// Базовая проверка здоровья WebSocket
router.get('/health', (req, res) => {
  try {
    const stats = websocketService.getConnectionStats()
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      websocket: {
        totalUsers: stats.totalUsers,
        totalSockets: stats.totalSockets,
        isInitialized: websocketService.io !== null
      }
    }

    res.json(status)
  } catch (error) {
    console.error('Ошибка при получении health статуса:', error)
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// Детальная статистика соединений
router.get('/stats', (req, res) => {
  try {
    const stats = websocketService.getConnectionStats()
    res.json({
      timestamp: new Date().toISOString(),
      ...stats
    })
  } catch (error) {
    console.error('Ошибка при получении статистики:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Информация о конкретном пользователе
router.get('/user/:userId', (req, res) => {
  try {
    const { userId } = req.params
    const userSockets = websocketService.getUserSockets(userId)

    res.json({
      userId,
      timestamp: new Date().toISOString(),
      socketCount: userSockets.length,
      isConnected: userSockets.length > 0,
      sockets: userSockets // Теперь это уже массив объектов с полной информацией
    })
  } catch (error) {
    console.error('Ошибка при получении информации о пользователе:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Тестирование отправки сообщения пользователю
router.post('/test-message/:userId', (req, res) => {
  try {
    const { userId } = req.params
    const { message, type = 'test' } = req.body

    const userSockets = websocketService.getUserSockets(userId)

    if (userSockets.length === 0) {
      return res.status(404).json({
        error: 'Пользователь не подключен',
        userId,
        timestamp: new Date().toISOString()
      })
    }

    // Отправляем тестовое сообщение всем сокетам пользователя
    userSockets.forEach(socketInfo => {
      websocketService.io.to(socketInfo.socketId).emit('testMessage', {
        type,
        message: message || 'Тестовое сообщение от системы мониторинга',
        timestamp: new Date().toISOString(),
        sessionId: socketInfo.sessionId
      })
    })

    res.json({
      success: true,
      userId,
      messagesSent: userSockets.length,
      timestamp: new Date().toISOString(),
      sentTo: userSockets.map(s => ({
        socketId: s.socketId,
        sessionId: s.sessionId
      }))
    })
  } catch (error) {
    console.error('Ошибка при отправке тестового сообщения:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Принудительная очистка устаревших соединений
router.post('/cleanup', (req, res) => {
  try {
    const beforeCleanup = websocketService.getConnectionStats()
    websocketService.cleanupStaleConnections()
    const afterCleanup = websocketService.getConnectionStats()

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      before: {
        totalUsers: beforeCleanup.totalUsers,
        totalSockets: beforeCleanup.totalSockets
      },
      after: {
        totalUsers: afterCleanup.totalUsers,
        totalSockets: afterCleanup.totalSockets
      },
      removed: {
        users: beforeCleanup.totalUsers - afterCleanup.totalUsers,
        sockets: beforeCleanup.totalSockets - afterCleanup.totalSockets
      }
    })
  } catch (error) {
    console.error('Ошибка при очистке соединений:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// ДОПОЛНИТЕЛЬНЫЕ ЭНДПОИНТЫ для удобства отладки

// Получение списка всех подключенных пользователей
router.get('/users', (req, res) => {
  try {
    const stats = websocketService.getConnectionStats()
    const users = Object.keys(stats.userDetails).map(userId => ({
      userId,
      socketCount: stats.userDetails[userId].socketCount,
      isConnected: stats.userDetails[userId].socketCount > 0
    }))

    res.json({
      timestamp: new Date().toISOString(),
      totalUsers: users.length,
      users
    })
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Проверка конкретного сокета
router.get('/socket/:socketId', (req, res) => {
  try {
    const { socketId } = req.params
    const stats = websocketService.getConnectionStats()
    
    let socketInfo = null
    let userId = null

    // Ищем сокет среди всех пользователей
    for (const [uid, userDetails] of Object.entries(stats.userDetails)) {
      const socket = userDetails.sockets.find(s => s.socketId === socketId)
      if (socket) {
        socketInfo = socket
        userId = uid
        break
      }
    }

    if (!socketInfo) {
      return res.status(404).json({
        error: 'Сокет не найден',
        socketId,
        timestamp: new Date().toISOString()
      })
    }

    res.json({
      socketId,
      userId,
      timestamp: new Date().toISOString(),
      socketInfo
    })
  } catch (error) {
    console.error('Ошибка при получении информации о сокете:', error)
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

module.exports = router
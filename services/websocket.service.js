const socketIO = require('socket.io')
const redisService = require('./redis.service')

class WebSocketService {
  constructor() {
    this.io = null
    // Изменяем структуру для правильного хранения сокетов
    this.userSockets = new Map() // userId -> Map(socketId -> sessionData)
  }

  initialize(server) {
    this.io = socketIO(server, {
      cors: {
        origin: [process.env.ORIGIN_URL_PROD, process.env.ORIGIN_URL_DEV],
        methods: ['GET', 'POST'],
        credentials: true
      },
      // Настройки для более стабильного соединения
      pingTimeout: 30000, // Уменьшено для Vercel/Render
      pingInterval: 10000, // Уменьшено для Vercel/Render
      upgradeTimeout: 10000,
      allowEIO3: true,
      // Для Vercel/Render лучше использовать только polling
      transports: ['polling']
    })

    this.io.on('connection', (socket) => {
      console.log('Клиент подключен:', socket.id)

      // Обработка аутентификации пользователя
      socket.on('authenticate', async (userId) => {
        try {
          console.log(`Аутентификация пользователя ${userId} для сокета ${socket.id}`)

          // Инициализируем структуру для пользователя если её нет
          if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Map())
          }

          const cookieHeader = socket.handshake.headers.cookie
          const sessionIdMatch = cookieHeader
            ? cookieHeader.match(/sessionId=([^;]+)/)
            : null
          const sessionId = sessionIdMatch ? sessionIdMatch[1] : null

          // Сохраняем информацию о сокете
          this.userSockets.get(userId).set(socket.id, {
            sessionId: sessionId,
            connectedAt: new Date(),
            lastPing: new Date()
          })

          socket.userId = userId
          socket.sessionId = sessionId

          console.log(`Пользователь ${userId} аутентифицирован, сессия: ${sessionId}`)
        } catch (error) {
          console.error('Ошибка при аутентификации сокета:', error)
          socket.disconnect(true)
        }
      })

      // Обработка ping от клиента для поддержания соединения
      socket.on('ping', (timestamp) => {
        socket.emit('pong', timestamp) // Возвращаем тот же timestamp
        
        // Обновляем время последнего ping
        if (socket.userId && this.userSockets.has(socket.userId)) {
          const userSocketsMap = this.userSockets.get(socket.userId)
          if (userSocketsMap.has(socket.id)) {
            const socketData = userSocketsMap.get(socket.id)
            socketData.lastPing = new Date()
          }
        }
      })

      // Обработка отключения
      socket.on('disconnect', (reason) => {
        console.log(`Клиент отключен: ${socket.id}, причина: ${reason}`)

        if (socket.userId) {
          const userSocketsMap = this.userSockets.get(socket.userId)
          if (userSocketsMap) {
            // Правильно удаляем сокет из Map
            userSocketsMap.delete(socket.id)
            
            // Если у пользователя не осталось активных сокетов
            if (userSocketsMap.size === 0) {
              this.userSockets.delete(socket.userId)
              console.log(`Все сокеты пользователя ${socket.userId} отключены`)
            } else {
              console.log(`У пользователя ${socket.userId} осталось активных сокетов: ${userSocketsMap.size}`)
            }
          }
        }
      })

      // Обработка ошибок
      socket.on('error', (error) => {
        console.error('Ошибка сокета:', socket.id, error)
        // Не отключаем сокет автоматически при ошибке, let Socket.IO handle it
      })

      // Обработка события reconnect на сервере (хотя обычно это клиентское событие)
      socket.on('reconnect', () => {
        console.log('Сокет переподключен:', socket.id)
      })
    })

    // Периодическая очистка "мертвых" соединений
    setInterval(() => {
      this.cleanupStaleConnections()
    }, 60000) // каждую минуту

    console.log('WebSocket сервис инициализирован')
  }

  // Очистка устаревших соединений
  cleanupStaleConnections() {
    const now = new Date()
    const staleThreshold = 5 * 60 * 1000 // 5 минут

    for (const [userId, userSocketsMap] of this.userSockets.entries()) {
      const socketsToRemove = []

      for (const [socketId, socketData] of userSocketsMap.entries()) {
        const timeSinceLastPing = now - socketData.lastPing

        if (timeSinceLastPing > staleThreshold) {
          console.log(`Удаляем устаревшее соединение: ${socketId} пользователя ${userId}`)
          socketsToRemove.push(socketId)
        }
      }

      // Удаляем устаревшие сокеты
      socketsToRemove.forEach(socketId => {
        userSocketsMap.delete(socketId)
      })

      // Если у пользователя не осталось сокетов, удаляем запись пользователя
      if (userSocketsMap.size === 0) {
        this.userSockets.delete(userId)
      }
    }
  }

  // Получение активных сокетов пользователя
  getUserSockets(userId) {
    const userSocketsMap = this.userSockets.get(userId)
    return userSocketsMap ? Array.from(userSocketsMap.entries()) : []
  }

  // Уведомление пользователя о завершении сессии
  async notifySessionTermination(userId, sessionId) {
    try {
      const userSocketsMap = this.userSockets.get(userId)
      if (!userSocketsMap) {
        console.log(`Пользователь ${userId} не имеет активных сокетов`)
        return
      }

      const session = await redisService.getSession(sessionId)
      if (!session) {
        console.log(`Сессия ${sessionId} не найдена в Redis`)
        return
      }

      // Находим сокет с нужной сессией
      for (const [socketId, socketData] of userSocketsMap.entries()) {
        if (socketData.sessionId === sessionId) {
          try {
            console.log(`Отправляем уведомление о завершении сессии на сокет ${socketId}`)
            this.io.to(socketId).emit('sessionTerminated', {
              sessionId,
              message: 'Ваша сессия была завершена'
            })
          } catch (error) {
            console.error(`Ошибка при отправке уведомления на сокет ${socketId}:`, error)
          }
          break
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке уведомления о завершении сессии:', error)
    }
  }

  // Уведомление пользователя об обновлении сессий
  async notifySessionUpdate(userId, withoutSessionId) {
    try {
      const userSocketsMap = this.userSockets.get(userId)
      if (!userSocketsMap) {
        console.log(`Пользователь ${userId} не имеет активных сокетов`)
        return
      }

      const sessions = await redisService.getUserSessions(userId)

      // Отправляем уведомление всем сокетам пользователя кроме исключенной сессии
      for (const [socketId, socketData] of userSocketsMap.entries()) {
        if (socketData.sessionId !== withoutSessionId) {
          try {
            console.log(`Отправляем обновление сессий на сокет ${socketId}`)
            this.io.to(socketId).emit('sessionsUpdated', sessions)
          } catch (error) {
            console.error(`Ошибка при отправке обновления сессий на сокет ${socketId}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке обновления сессий:', error)
    }
  }

  // Получение статистики подключений
  getConnectionStats() {
    const stats = {
      totalUsers: this.userSockets.size,
      totalSockets: 0,
      userDetails: {}
    }

    for (const [userId, userSocketsMap] of this.userSockets.entries()) {
      stats.totalSockets += userSocketsMap.size
      stats.userDetails[userId] = {
        socketCount: userSocketsMap.size,
        sockets: Array.from(userSocketsMap.entries()).map(([socketId, data]) => ({
          socketId,
          sessionId: data.sessionId,
          connectedAt: data.connectedAt,
          lastPing: data.lastPing
        }))
      }
    }

    return stats
  }
}

module.exports = new WebSocketService()
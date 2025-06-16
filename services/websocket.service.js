const socketIO = require('socket.io')
const redisService = require('./redis.service')

class WebSocketService {
  constructor() {
    this.io = null
    this.userSockets = new Map() // Карта для хранения сокет-соединений пользователей
  }

  initialize(server) {
    this.io = socketIO(server, {
      cors: {
        origin: [process.env.ORIGIN_URL_PROD, process.env.ORIGIN_URL_DEV],
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    })

    this.io.on('connection', (socket) => {
      console.log('Клиент подключен:', socket.id)

      // Обработка аутентификации пользователя
      socket.on('authenticate', async (userId) => {
        try {
          if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set())
          }
          const cookieHeader = socket.handshake.headers.cookie
          const sessionIdMatch = cookieHeader
            ? cookieHeader.match(/sessionId=([^;]+)/)
            : null
          const sessionId = sessionIdMatch ? sessionIdMatch[1] : null
          this.userSockets
            .get(userId)
            .add({ socketId: socket.id, sessionId: sessionId })
          socket.userId = userId
        } catch (error) {
          console.error('Ошибка при аутентификации сокета:', error)
          socket.disconnect(true)
        }
      })

      socket.on('reconnect', attempt => {
        console.log('WebSocket переподключен:', attempt)
      })

      // Обработка отключения
      socket.on('disconnect', (reason) => {
        if (socket.userId) {
          const userSockets = this.userSockets.get(socket.userId)
          if (userSockets) {
            userSockets.delete(socket.id)
            if (userSockets.size === 0) {
              this.userSockets.delete(socket.userId)
            }
          }
        }
        console.log(`Клиент отключен: ${socket.id}, причина: ${reason}`)
      })

      // Обработка ошибок
      socket.on('error', (error) => {
        console.error('Ошибка сокета:', error)
        socket.disconnect(true)
      })
    })
  }

  // Уведомление пользователя о завершении сессии
  async notifySessionTermination(userId, sessionId) {
    try {
      const userSockets = this.userSockets.get(userId)
      if (userSockets) {
        const session = await redisService.getSession(sessionId)
        if (session) {
          const targetSocket = Array.from(userSockets).find(
            (s) => s.sessionId === sessionId
          )
          if (targetSocket) {
            try {
              this.io.to(targetSocket.socketId).emit('sessionTerminated', {
                sessionId,
                message: 'Ваша сессия была завершена'
              })
            } catch (error) {
              console.error(
                `Ошибка при отправке уведомления на сокет ${targetSocket.socketId}:`,
                error
              )
            }
          }
        }
      }
    } catch (error) {
      console.error(
        'Ошибка при отправке уведомления о завершении сессии:',
        error
      )
    }
  }

  // Уведомление пользователя об обновлении сессий
  async notifySessionUpdate(userId, withoutSessionId) {
    try {
      const userSockets = this.userSockets.get(userId)
      if (userSockets) {
        const sessions = await redisService.getUserSessions(userId)
        const targetSockets = Array.from(userSockets).filter(
          (s) => s.sessionId !== withoutSessionId
        )
        targetSockets.forEach((socket) => {
          try {
            this.io.to(socket.socketId).emit('sessionsUpdated', sessions)
          } catch (error) {
            console.error(
              `Ошибка при отправке обновления сессий на сокет ${socketId}:`,
              error
            )
          }
        })
      }
    } catch (error) {
      console.error('Ошибка при отправке обновления сессий:', error)
    }
  }
}

module.exports = new WebSocketService()

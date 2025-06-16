const redisService = require('../services/redis.service');
const websocketService = require('../services/websocket.service');

class SessionController {
  async getUserSessions(req, res) {
    try {
      const userId = req.user.id;
      const sessions = await redisService.getUserSessions(userId);
      
      // Добавляем флаг текущей сессии
      const sessionsWithCurrentFlag = sessions.map(session => ({
        ...session,
        isCurrentSession: session.sessionId === req.session.sessionId
      }));

      res.json(sessionsWithCurrentFlag);
    } catch (error) {
      console.error('Ошибка при получении сессий пользователя:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }

  async terminateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;
      
      const session = await redisService.getSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: 'Сессия не найдена' });
      }

      await websocketService.notifySessionTermination(userId, sessionId);
      await redisService.deleteSession(sessionId);
      
      res.json({ message: 'Сессия успешно завершена' });
    } catch (error) {
      console.error('Ошибка при завершении сессии:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }

  async terminateCurrentSession(req, res) {
    try {
      const sessionId = req.session.sessionId;
      const userId = req.user.id;
      
      await websocketService.notifySessionTermination(userId, sessionId);
      await redisService.deleteSession(sessionId);
      
      res.clearCookie('sessionId');
      res.json({ message: 'Текущая сессия успешно завершена' });
    } catch (error) {
      console.error('Ошибка при завершении текущей сессии:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }

  async terminateOtherSessions(req, res) {
    try {
      const userId = req.user.id;
      const currentSessionId = req.session.sessionId;
      
      const sessions = await redisService.getUserSessions(userId);
      for (const session of sessions) {
        if (session.sessionId !== currentSessionId) {
          await websocketService.notifySessionTermination(userId, session.sessionId);
          await redisService.deleteSession(session.sessionId);
        }
      }
    
      res.json({ message: 'Все остальные сессии успешно завершены' });
    } catch (error) {
      console.error('Ошибка при завершении других сессий:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
}

module.exports = new SessionController(); 
const Redis = require('ioredis');
const config = require('../config/config');

class RedisService {
  constructor() {
    this.client = new Redis({
      ...config.redis,
      retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.client.on('error', (err) => {
      console.error('Ошибка клиента Redis:', err);
      if (err.code === 'ECONNREFUSED') {
        console.error('Не удалось подключиться к Redis. Проверьте, запущен ли сервер Redis.');
      }
    });

    this.client.on('connect', () => {
      console.log('Клиент Redis подключен');
    });

    this.client.on('ready', () => {
      console.log('Клиент Redis готов к работе');
    });

    this.client.on('reconnecting', () => {
      console.log('Переподключение к Redis...');
    });
  }

  async setSession(sessionId, sessionData, ttl = 2592000) {
    try {
      const key = `session:${sessionId}`;
      await this.client.set(key, JSON.stringify(sessionData), 'EX', ttl);
      return true;
    } catch (error) {
      console.error('Ошибка при установке сессии:', error);
      return false;
    }
  }

  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Ошибка при получении сессии:', error);
      return null;
    }
  }

  async deleteSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Ошибка при удалении сессии:', error);
      return false;
    }
  }

  async getUserSessions(userId) {
    try {
      const pattern = `session:*`;
      const keys = await this.client.keys(pattern);
      const sessions = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error('Ошибка при получении сессий пользователя:', error);
      return [];
    }
  }

  async deleteUserSessions(userId, excludeSessionId = null) {
    try {
      const sessions = await this.getUserSessions(userId);
      for (const session of sessions) {
        if (excludeSessionId && session.sessionId === excludeSessionId) {
          continue;
        }
        await this.deleteSession(session.sessionId);
      }
      return true;
    } catch (error) {
      console.error('Ошибка при удалении сессий пользователя:', error);
      return false;
    }
  }

  async updateSessionActivity(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date().toISOString();
        await this.setSession(sessionId, session);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ошибка при обновлении активности сессии:', error);
      return false;
    }
  }

  async updateSessionUser(sessionId, userData) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.user = userData;
        await this.setSession(sessionId, session);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ошибка при обновлении данных пользователя в сессии:', error);
      return false;
    }
  }
}

module.exports = new RedisService(); 
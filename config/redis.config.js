require('dotenv').config();

module.exports = {
  username: process.env.REDIS_USERNAME || null,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || null,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  sessionTTL: parseInt(process.env.SESSION_TTL || '2592000', 10), // 30 days in seconds
}; 
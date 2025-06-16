require('dotenv').config();

module.exports = {
  // ... existing config ...
  
  redis: require('./redis.config'),
  
  // ... rest of the config ...
}; 
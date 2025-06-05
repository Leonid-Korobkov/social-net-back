const crypto = require('crypto')

// Генерация 6-значного кода подтверждения
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Генерация CSRF токена
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

// Добавляем функцию для парсинга User-Agent
function parseUserAgent (userAgent) {
  const browser =
    userAgent.match(
      /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
    ) || []
  const os =
    userAgent.match(/(?:windows|mac|linux|android|ios|iphone|ipad)/i) || []

  return {
    browser: browser[1] || 'Unknown',
    browserVersion: browser[2] || 'Unknown',
    os: os[0] || 'Unknown',
    device: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
  }
}

// Валидация пароля
const validatePassword = password => {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*-(),.?":{}|<>]/.test(password)

  const errors = []
  if (password.length < minLength) {
    errors.push(`Пароль должен содержать минимум ${minLength} символов`)
  }
  if (!hasUpperCase) {
    errors.push('Пароль должен содержать хотя бы одну заглавную букву')
  }
  if (!hasLowerCase) {
    errors.push('Пароль должен содержать хотя бы одну строчную букву')
  }
  if (!hasNumbers) {
    errors.push('Пароль должен содержать хотя бы одну цифру')
  }
  if (!hasSpecialChar) {
    errors.push('Пароль должен содержать хотя бы один специальный символ')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

module.exports = {
  parseUserAgent,
  generateVerificationCode,
  generateCSRFToken,
  validatePassword
}

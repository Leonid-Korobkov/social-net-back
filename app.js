const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const fs = require('fs')
const cors = require('cors')
const http = require('http')
require('dotenv').config()

const app = express()
const server = http.createServer(app)
const port = process.env.PORT || 4000

// Инициализация WebSocket сервиса
try {
  const websocketService = require('./services/websocket.service')
  websocketService.initialize(server)
} catch (error) {
  console.error('Ошибка при инициализации WebSocket:', error)
  process.exit(1)
}

// Настройка доверия прокси
// Если приложение работает за прокси (например, на Render.com)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1) // Доверяем первому прокси
}

const { startScoreRecalculationCron } = require('./utils/recalculatePostScores')

var corsOptions = {
  // При NODE_ENV=production используем продакшен-адрес, иначе — локальный
  origin: [process.env.ORIGIN_URL_PROD, process.env.ORIGIN_URL_DEV],
  credentials: true, // разрешить отправку cookie/заголовка авторизации
  optionsSuccessStatus: 200 // код ответа для IE/старых браузеров (по умолчанию 204)
}

app.use(cors(corsOptions))

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.set('view engine', 'jade')

// Монтирование статических файлов (картинки и тд)
app.use('/uploads', express.static('uploads'))

// Монтирование маршрутов по пути api
app.use('/api', require('./routes'))

// Добавление маршрутов для управления сессиями
app.use('/api/sessions', require('./routes/session.routes'))

// Базовый роут для проверки работы сервера
app.get('/', (req, res) => {
  res.send('Сервер работает')
})

// Эндпоинт для пинга
app.get('/hello', (req, res) => {
  res.send('hello')
})

// Запуск сервера
server.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`)
  // Запускаем задачу cron после старта сервера
  try {
    startScoreRecalculationCron()
  } catch (error) {
    console.error('Ошибка при запуске cron задачи:', error)
  }
})

// Создание директории для картинок, если ее не существует
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

// Обработка 404 ошибки
app.use(function (req, res, next) {
  next(createError(404))
})

// Обработчик ошибок
app.use(function (err, req, res, next) {
  // Установка локальных переменных, только для разработки
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  console.error('Ошибка сервера:', err)

  // Отправка страницы с ошибкой
  res.status(err.status || 500).json({
    message: err.message || 'Внутренняя ошибка сервера',
    error: process.env.NODE_ENV === 'development' ? err : {}
  })
})

module.exports = app

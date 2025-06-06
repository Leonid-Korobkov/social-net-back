const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const fs = require('fs')
const cors = require('cors')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 4000

// Настройка доверия прокси
// Если приложение работает за прокси (например, на Render.com)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1) // Доверяем первому прокси
}

const { startScoreRecalculationCron } = require('./utils/recalculatePostScores')

var corsOptions = {
  origin: [process.env.ORIGIN_URL_PROD, process.env.ORIGIN_URL_DEV],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

// Добавляем middleware для установки secure cookies
app.use((req, res, next) => {
  // Устанавливаем заголовки для работы с куками в Safari
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With')
  
  // Для preflight запросов
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.set('view engine', 'jade')

// Монтирование статических файлов (картинки и тд)
app.use('/uploads', express.static('uploads'))

// Монтирование маршрутов по пути api
app.use('/api', require('./routes'))

// Базовый роут для проверки работы сервера
app.get('/', (req, res) => {
  res.send('Server is running')
})

// Запуск сервера
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
  // Запускаем задачу cron после старта сервера
  startScoreRecalculationCron()
})

// Cоздание директории для картинок, если ее не существует
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  console.log(err)

  // render the error page
  res.status(err.status || 500)
})

module.exports = app

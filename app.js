// app.js
const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const cors = require('cors')
require('dotenv').config()

const app = express()

// CORS: prod или dev origin из .env
const corsOptions = {
  origin: [process.env.ORIGIN_URL_PROD, process.env.ORIGIN_URL_DEV],
  credentials: true,
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))

// Логи, парсинг тела, cookie и шаблонизатор
app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.set('view engine', 'jade')

// Статика для загрузок (если в функции Netlify вы подключаете внешний storage — его можно убрать)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Роуты API
app.use('/api', require('./routes'))

// Простой эндпоинт для проверки
app.get('/', (req, res) => {
  res.send('Server is running')
})

// 404
app.use((req, res, next) => {
  next(createError(404))
})

// Общий обработчик ошибок
app.use((err, req, res, next) => {
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app

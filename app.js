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

var corsOptions = {
  origin:
    process.env.NODE_ENV == 'production'
      ? process.env.ORIGIN_URL_PROD
      : process.env.ORIGIN_URL_DEV,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions))

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.set('view engine', 'jade')

// Глобальная задержка на 1 секунду для всех запросов
// app.use((req, res, next) => {
//   setTimeout(next, 1000)
// })

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

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app

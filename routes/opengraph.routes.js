const express = require('express')
const router = express.Router()
const { verifyOpenGraphPath } = require('../middleware/opengraph-auth')
const { OpenGraphController } = require('../controllers')

// Маршруты для OpenGraph данных
router.get('/og/post/:id', verifyOpenGraphPath, OpenGraphController.getPostData)

router.get(
  '/og/user/:username',
  verifyOpenGraphPath,
  OpenGraphController.getUserData
)

// Получение OG превью по ссылке (без авторизации, POST)
router.post('/og/link-preview', OpenGraphController.getLinkPreview)

// Обработка ошибок
router.use((err, req, res, next) => {
  console.error('Ошибка в маршрутах opengraph:', err)
  res.status(500).json({ message: 'Внутренняя ошибка сервера' })
})

module.exports = router

const express = require('express')
const router = express.Router()
const multer = require('multer')
const sharp = require('sharp')
const cloudinary = require('cloudinary').v2

const {
  UserController,
  PostController,
  CommentController,
  LikeController,
  FollowController,
  CommentLikeController
} = require('../controllers')
const { authenticateToken } = require('../middleware/auth')

// Конфигурация Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Middleware для кэширования
const cacheControl = (req, res, next) => {
  // Для GET запросов к статическим ресурсам (изображения, аватары)
  if (
    req.method === 'GET' &&
    (req.url.includes('/uploads/') || req.url.includes('cloudinary'))
  ) {
    res.set('Cache-Control', 'public, max-age=31536000') // 1 год
  } else if (req.method === 'GET') {
    // Для GET запросов к API данных
    res.set('Cache-Control', 'no-cache, must-revalidate, max-age=0')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
  } else {
    // Для POST, PUT, DELETE запросов
    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    )
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
  }
  next()
}

// Middleware для оптимизации изображений
const optimizeImage = async (req, res, next) => {
  if (!req.file) return next()

  try {
    const optimized = await sharp(req.file.buffer)
      // .resize(1200, 1200, {
      //   fit: 'inside',
      //   withoutEnlargement: true
      // })
      // .webp({ quality: 80 })
      .toBuffer()

    // Загружаем оптимизированное изображение в Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
        {
          folder: 'social-net',
          resource_type: 'auto',
          format: 'webp',
          invalidate: true,
          transformation: [{ quality: 'auto:best' }, { fetch_format: 'auto' }]
        },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        )
        .end(optimized)
    })

    // Сохраняем URL изображения
    req.file.cloudinaryUrl = result.secure_url
    next()
  } catch (error) {
    next(error)
  }
}

// Создаем экземпляр multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

// Применяем middleware кэширования для всех маршрутов
router.use(cacheControl)

// Маршрутизация для пользователя
router.post('/register', UserController.register)
router.post('/login', UserController.login)
router.get('/current', authenticateToken, UserController.currentUser)
router.get('/users/:id', authenticateToken, UserController.getUserById)
router.put(
  '/users/:id',
  authenticateToken,
  upload.single('avatar'),
  optimizeImage,
  UserController.updateUser
)

// Маршрутизация для постов
router.post(
  '/posts',
  authenticateToken,
  upload.single('image'),
  optimizeImage,
  PostController.createPost
)
router.get('/posts', authenticateToken, PostController.getAllPosts)
router.get('/posts/:id', authenticateToken, PostController.getPostById)
router.delete('/posts/:id', authenticateToken, PostController.deletePost)

// Маршрутизация для комментариев
router.post('/comments', authenticateToken, CommentController.createComment)
router.delete(
  '/comments/:id',
  authenticateToken,
  CommentController.deleteComment
)

// Маршрутизация для лайков
router.post('/like', authenticateToken, LikeController.likePost)
router.delete('/unlike', authenticateToken, LikeController.unlikePost)

// Маршрутизация для подписок
router.post('/follow', authenticateToken, FollowController.followUser)
router.delete('/unfollow', authenticateToken, FollowController.unfollowUser)

// Маршрутизация для лайков комментариев
router.post(
  '/comments/:commentId/like',
  authenticateToken,
  CommentLikeController.toggleLike
)
router.get(
  '/comments/:commentId/likes',
  authenticateToken,
  CommentLikeController.getLikes
)

module.exports = router

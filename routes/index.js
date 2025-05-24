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
  CommentLikeController,
  SearchController
} = require('../controllers')
const { authenticateToken } = require('../middleware/auth')
const {
  uploadMultiple,
  processMedia,
  uploadSingle
} = require('../middleware/upload')

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
    const optimized = await sharp(req.file.buffer).toBuffer()

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

// Маршрутизация для пользователя
router.post('/register', UserController.register)
router.post('/login', UserController.login)
router.get('/current', authenticateToken, UserController.currentUser)
router.get(
  '/users/getRandomImage',
  authenticateToken,
  UserController.getNewRandomImage
)
router.get('/users/:id', authenticateToken, UserController.getUserById)
router.get(
  '/users/:userId/posts',
  authenticateToken,
  PostController.getPostsByUserId
)

router.put(
  '/users/settings',
  authenticateToken,
  UserController.updateUserSettings
)
router.put(
  '/users/:id',
  authenticateToken,
  uploadSingle('avatar'),
  optimizeImage,
  UserController.updateUser
)
router.get(
  '/users/:userId/settings',
  authenticateToken,
  UserController.getUserSettings
)

// Маршрутизация для постов и медиа
router.post(
  '/posts',
  authenticateToken,
  uploadMultiple('media', 10), // Можно загружать до 10 файлов в поле media
  processMedia, // Обработка медиа-файлов
  PostController.createPost
)

// Маршрут для обновления поста с медиа
router.put(
  '/posts/:id',
  authenticateToken,
  uploadMultiple('media', 10),
  processMedia,
  PostController.updatePost
)

// Загрузка отдельного медиафайла (например, для предварительной загрузки)
router.post(
  '/media/upload',
  authenticateToken,
  uploadMultiple('media', 1),
  processMedia,
  PostController.uploadMedia
)

router.get('/posts', authenticateToken, PostController.getAllPosts)
router.get('/posts/:id', authenticateToken, PostController.getPostById)
router.delete('/posts/:id', authenticateToken, PostController.deletePost)
router.get(
  '/posts/:postId/comments',
  authenticateToken,
  CommentController.getComments
)
router.post(
  '/posts/:id/view',
  authenticateToken,
  PostController.incrementViewCount
)
router.post(
  '/posts/:id/share',
  authenticateToken,
  PostController.incrementShareCount
)
router.post(
  '/posts/views/batch',
  authenticateToken,
  PostController.incrementViewsBatch
)

// Маршрутизация для комментариев
router.post('/comments', authenticateToken, CommentController.createComment)
router.delete(
  '/comments/:id',
  authenticateToken,
  CommentController.deleteComment
)
router.get(
  '/comments/:commentId/likes',
  authenticateToken,
  CommentController.getCommentLikes
)

// Маршрутизация для лайков
router.post('/like', authenticateToken, LikeController.likePost)
router.delete('/unlike', authenticateToken, LikeController.unlikePost)
router.get('/likes/:postId', authenticateToken, LikeController.getLikes)

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

// Маршрутизация для поиска
router.get('/search', authenticateToken, SearchController.search)

// Удаление медиафайла из Cloudinary
router.delete('/media/delete', authenticateToken, PostController.deleteMedia)

// Удаление пользователя
router.delete('/users/:id', authenticateToken, UserController.deleteUser)

module.exports = router

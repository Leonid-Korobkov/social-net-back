const express = require('express')
const router = express.Router()
const sharp = require('sharp')
const cloudinary = require('cloudinary').v2

const {
  UserController,
  PostController,
  CommentController,
  LikeController,
  FollowController,
  CommentLikeController,
  SearchController,
} = require('../controllers')

const { authMiddleware, loginLimiter } = require('../middleware/auth.middleware')
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
router.post('/auth/register', UserController.register)
router.post('/auth/verify-email', UserController.verifyEmail)
router.post('/auth/resend-verification', UserController.resendVerification)
router.post('/auth/login', loginLimiter, UserController.login)
router.post('/auth/logout', authMiddleware, UserController.logout)
router.post(
  '/auth/logout-all',
  authMiddleware,
  UserController.logoutAllDevices
)
router.post('/auth/forgot-password', UserController.forgotPassword)
router.post('/auth/verify-reset-code', UserController.verifyResetCode)
router.post('/auth/reset-password', UserController.resetPassword)

router.get('/current', authMiddleware, UserController.currentUser)
router.get(
  '/users/getRandomImage',
  authMiddleware,
  UserController.getNewRandomImage
)
router.get('/users/:id', authMiddleware, UserController.getUserById)
router.get(
  '/users/:userId/posts',
  authMiddleware,
  PostController.getPostsByUserId
)

router.put(
  '/users/settings',
  authMiddleware,
  UserController.updateUserSettings
)
router.put(
  '/users/:id',
  authMiddleware,
  uploadSingle('avatar'),
  optimizeImage,
  UserController.updateUser
)
router.get(
  '/users/:userId/settings',
  authMiddleware,
  UserController.getUserSettings
)

// Маршрутизация для постов и медиа
router.post(
  '/posts',
  authMiddleware,
  uploadMultiple('media', 10), // Можно загружать до 10 файлов в поле media
  processMedia, // Обработка медиа-файлов
  PostController.createPost
)

// Маршрут для обновления поста с медиа
router.put(
  '/posts/:id',
  authMiddleware,
  uploadMultiple('media', 10),
  processMedia,
  PostController.updatePost
)

// Загрузка отдельного медиафайла (например, для предварительной загрузки)
router.post(
  '/media/upload',
  authMiddleware,
  uploadMultiple('media', 1),
  processMedia,
  PostController.uploadMedia
)

router.get('/posts', authMiddleware, PostController.getAllPosts)
router.get('/posts/:id', authMiddleware, PostController.getPostById)
router.delete('/posts/:id', authMiddleware, PostController.deletePost)
router.get(
  '/posts/:postId/comments',
  authMiddleware,
  CommentController.getComments
)
router.post(
  '/posts/:id/view',
  authMiddleware,
  PostController.incrementViewCount
)
router.post(
  '/posts/:id/share',
  authMiddleware,
  PostController.incrementShareCount
)
router.post(
  '/posts/views/batch',
  authMiddleware,
  PostController.incrementViewsBatch
)

// Маршрутизация для комментариев
router.post('/comments', authMiddleware, CommentController.createComment)
router.delete(
  '/comments/:id',
  authMiddleware,
  CommentController.deleteComment
)
router.get(
  '/comments/:commentId/likes',
  authMiddleware,
  CommentController.getCommentLikes
)

// Маршрутизация для лайков
router.post('/like', authMiddleware, LikeController.likePost)
router.delete('/unlike', authMiddleware, LikeController.unlikePost)
router.get('/likes/:postId', authMiddleware, LikeController.getLikes)

// Маршрутизация для подписок
router.post('/follow', authMiddleware, FollowController.followUser)
router.delete('/unfollow', authMiddleware, FollowController.unfollowUser)

// Маршрутизация для лайков комментариев
router.post(
  '/comments/:commentId/like',
  authMiddleware,
  CommentLikeController.toggleLike
)
router.get(
  '/comments/:commentId/likes',
  authMiddleware,
  CommentLikeController.getLikes
)

// Маршрутизация для поиска
router.get('/search', authMiddleware, SearchController.search)

// Удаление медиафайла из Cloudinary
router.delete('/media/delete', authMiddleware, PostController.deleteMedia)

// Удаление пользователя
router.delete('/users/:id', authMiddleware, UserController.deleteUser)

module.exports = router

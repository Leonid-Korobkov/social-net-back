const express = require('express')
const router = express.Router()
const multer = require('multer')
const {
  UserController,
  PostController,
  CommentController,
  LikeController,
  FollowController
} = require('../controllers')
const { authenticateToken } = require('../middleware/auth')

// Показываем где хранить файлы
const uploadDestination = 'uploads'
const storage = multer.diskStorage({
  destination: uploadDestination,
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

// Создаем экземпляр multer
const upload = multer({ storage: storage })

// Маршрутизация для пользователя
router.post('/register', UserController.register)
router.post('/login', UserController.login)
router.get('/current', authenticateToken, UserController.currentUser)
router.get('/users/:id', authenticateToken, UserController.getUserById)
router.put('/users/:id', authenticateToken, UserController.updateUser)

// Маршрутизация для постов
router.post('/posts', authenticateToken, PostController.createPost)
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

module.exports = router

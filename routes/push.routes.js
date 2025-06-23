const express = require('express')
const router = express.Router()
const PushController = require('../controllers/PushController')
const { authMiddleware } = require('../middleware/auth.middleware')

router.post('/subscribe', authMiddleware, PushController.subscribe)
router.post('/unsubscribe', authMiddleware, PushController.unsubscribe)
router.get('/public-key', PushController.getPublicKey)

module.exports = router

const { prisma } = require('../prisma/prisma-client')
const webpush = require('../services/webpush.service')

const PushController = {
  async subscribe(req, res) {
    const subscription = req.body
    const userId = req.user.id

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' })
    }

    // Проверяем настройки пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { enablePushNotifications: true }
    })
    if (!user?.enablePushNotifications) {
      // Если push выключены — удаляем подписку, если есть, и не сохраняем новую
      await prisma.pushSubscription.deleteMany({ where: { userId } })
      return res.status(200).json({
        success: false,
        message: 'Push notifications are disabled in settings'
      })
    }

    const payload = JSON.stringify({
      title: 'Hello. zling welcomes you ',
      body: 'This is your first push notification'
    })

    // webpush.sendNotification(subscription, payload).catch(console.log)

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { keys: subscription.keys, userId },
      create: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId
      }
    })

    res.status(201).json({ success: true })
  },

  async unsubscribe(req, res) {
    const { endpoint } = req.body
    // Удаляем только по endpoint (быстрее, не ищем userId)
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
    res.json({ success: true })
  },

  async getPublicKey(req, res) {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
  }
}

module.exports = PushController

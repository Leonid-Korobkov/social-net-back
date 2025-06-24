const cron = require('node-cron')
const axios = require('axios')

function startPingPong() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const url =
        process.env.NODE_ENV === 'production'
          ? process.env.BASE_URL_PROD
          : process.env.BASE_URL_DEV
      const res = await axios.get(`${url}/hello`)
      console.log('Ping sent, response:', res.data)
    } catch (e) {
      console.error('Ошибка при pingpong:', e.message)
    }
  })
  console.log('node-cron: задача pingpong запущена')
}

module.exports = { startPingPong }

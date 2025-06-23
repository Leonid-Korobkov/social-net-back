const SystemAuth = (req, res, next) => {
  const secretPath = process.env.OPENGRAPH_SECRET_PATH

  if (!secretPath) {
    console.error('OPENGRAPH_SECRET_PATH not configured')
    return res.status(500).json({ error: 'OpenGraph path not configured' })
  }

  // Проверяем секретный путь в заголовке
  const providedSecret = req.headers['x-opengraph-secret']
  if (!providedSecret || providedSecret !== secretPath) {
    return res.status(403).json({ error: 'Access denied' })
  }

  next()
}

module.exports = { SystemAuth }

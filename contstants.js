const FRONTEND_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.ORIGIN_URL_PROD
    : process.env.ORIGIN_URL_DEV

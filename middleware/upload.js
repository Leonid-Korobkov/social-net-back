const multer = require('multer')
const cloudinary = require('cloudinary').v2
const sharp = require('sharp')

// Конфигурация Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Функция для оптимизации изображений
const optimizeImage = async buffer => {
  try {
    return await sharp(buffer).toBuffer()
  } catch (error) {
    console.error('Ошибка оптимизации изображения:', error)
    throw error
  }
}

// Настройка Multer для временного хранения файлов в памяти
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: {
      image: 10 * 1024 * 1024, // 10 Мб
      video: 100 * 1024 * 1024 // 100 Мб
    },
    files: 10 // Максимум 10 файлов
  },
  fileFilter: (req, file, cb) => {
    // Проверка MIME-типа файла
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true)
    } else {
      cb(
        new Error(
          'Неподдерживаемый тип файла. Разрешены только изображения и видео.'
        ),
        false
      )
    }
  }
})

// Middleware для загрузки файлов в Cloudinary
const processMedia = async (req, res, next) => {
  console.log('processMedia middleware запущен')
  console.log('Тип запроса:', req.method, 'URL:', req.originalUrl)
  
  // Проверяем наличие файлов в req.files (для multiple) или req.file (для single)
  if ((!req.files || req.files.length === 0) && !req.file) {
    console.log('Файлы не найдены в запросе')
    // Инициализируем пустой массив mediaUrls, чтобы избежать проблем с undefined
    req.mediaUrls = []
    return next()
  }

  // Если у нас есть один файл в req.file, преобразуем его в массив
  const files = req.files || (req.file ? [req.file] : [])

  console.log(`Получено файлов: ${files.length}`)

  try {
    const userId = req.user.id
    console.log(`Загрузка для пользователя с ID: ${userId}`)

    const mediaPromises = files.map(async file => {
      let result

      console.log(`Обработка файла: ${file.originalname} (${file.mimetype})`)

      if (file.mimetype.startsWith('image/')) {
        // Оптимизируем изображение перед загрузкой
        console.log('Оптимизируем изображение...')
        const optimized = await optimizeImage(file.buffer)

        // Загружаем оптимизированное изображение в Cloudinary
        console.log('Загружаем в Cloudinary...')
        result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
            {
              folder: `zling/${userId}`, // Папка пользователя
              resource_type: 'auto',
              format: 'webp',
              invalidate: true,
              transformation: [
                  { quality: 'auto:best' },
                  { fetch_format: 'auto' }
              ]
            },
              (error, result) => {
                if (error) {
                  console.error('Ошибка загрузки в Cloudinary:', error)
                  reject(error)
                } else {
                  console.log(
                    'Успешно загружено в Cloudinary:',
                    result.secure_url
                  )
                  resolve(result)
                }
              }
            )
            .end(optimized)
        })
      } else if (file.mimetype.startsWith('video/')) {
        // Загружаем видео напрямую в Cloudinary
        console.log('Загружаем видео в Cloudinary...')
        result = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
            {
              folder: `zling/${userId}`, // Папка пользователя
              resource_type: 'video',
              eager: [
                {
                  format: 'mp4',
                  transformation: [
                      { width: 1080, crop: 'scale' },
                      { quality: 'auto:best' }
                  ]
                }
              ],
              eager_async: true
            },
              (error, result) => {
                if (error) {
                  console.error('Ошибка загрузки видео в Cloudinary:', error)
                  reject(error)
                } else {
                  console.log(
                    'Видео успешно загружено в Cloudinary:',
                    result.secure_url
                  )
                  resolve(result)
                }
              }
            )
            .end(file.buffer)
        })
      }

      return result?.secure_url
    })

    // Дожидаемся всех загрузок и фильтруем возможные undefined/null значения
    const allUrls = await Promise.all(mediaPromises)
    const urls = allUrls.filter(url => url) // Отфильтровываем undefined/null
    
    console.log('Все файлы загружены:', urls)

    // Убедимся, что устанавливаем массив, даже если он пустой
    req.mediaUrls = urls
    
    // Добавляем проверку, что mediaUrls является массивом
    if (!Array.isArray(req.mediaUrls)) {
      console.warn('req.mediaUrls не является массивом, исправляем:', req.mediaUrls)
      req.mediaUrls = Array.isArray(req.mediaUrls) ? req.mediaUrls : [req.mediaUrls].filter(Boolean)
    }
    
    console.log('Установлено req.mediaUrls:', req.mediaUrls)
    next()
  } catch (error) {
    console.error('Ошибка загрузки медиа:', error)
    // В случае ошибки устанавливаем пустой массив, чтобы не было undefined
    req.mediaUrls = []
    return res.status(500).json({ error: 'Ошибка загрузки медиа-файлов' })
  }
}

// Функция для одного файла
const uploadSingle = fieldName => (req, res, next) => {
  upload.single(fieldName)(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}

// Функция для нескольких файлов
const uploadMultiple = (fieldName, maxCount = 10) => (req, res, next) => {
  upload.array(fieldName, maxCount)(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  processMedia
}

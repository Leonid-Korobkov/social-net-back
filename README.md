# Zling — Социальная сеть (Backend)

_API для современной социальной платформы Zling_

![last-commit](https://img.shields.io/github/last-commit/Leonid-Korobkov/social-net-back?style=flat&logo=git&logoColor=white&color=0080ff)
![repo-top-language](https://img.shields.io/github/languages/top/Leonid-Korobkov/social-net-back?style=flat&color=0080ff)
![repo-language-count](https://img.shields.io/github/languages/count/Leonid-Korobkov/social-net-back?style=flat&color=0080ff)

---

## Используемые технологии

![Node.js](https://img.shields.io/badge/Node.js-339933.svg?style=flat&logo=Node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000.svg?style=flat&logo=Express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=TypeScript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748.svg?style=flat&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1.svg?style=flat&logo=PostgreSQL&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000.svg?style=flat&logo=JSON-Web-Tokens&logoColor=white)
![bcryptjs](https://img.shields.io/badge/bcryptjs-000000.svg?style=flat)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5.svg?style=flat&logo=Cloudinary&logoColor=white)
![Multer](https://img.shields.io/badge/Multer-FFCA28.svg?style=flat)
![Sharp](https://img.shields.io/badge/Sharp-00BFAE.svg?style=flat)
![Docker](https://img.shields.io/badge/Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000.svg?style=flat&logo=Vercel&logoColor=white)

---

## О проекте

**Zling Backend** — это современный REST API для социальной сети, реализующий регистрацию, аутентификацию, управление пользователями, постами, комментариями, подписками и медиафайлами. Использует PostgreSQL и Prisma для надежного хранения данных, Cloudinary для работы с изображениями, а также поддерживает деплой через Docker и Vercel.

---

## Функционал

- **Аутентификация и авторизация**
  - JWT-токены, безопасное хранение паролей (bcryptjs)
  - Регистрация и вход по email/паролю
- **Пользователи**
  - CRUD-профиля, подписки/отписки, аватары (генерация через jdenticon), биография, поиск
- **Посты**
  - Создание, редактирование, удаление, лента, лайки, изображения (Cloudinary, Sharp)
- **Комментарии**
  - Добавление, просмотр, удаление, лайки комментариев
- **Подписки**
  - Списки подписчиков и подписок, быстрый переход к профилю
- **Медиа**
  - Загрузка, оптимизация, хранение изображений через Cloudinary, поддержка drag-and-drop (Multer)
- **Производительность**
  - Индексы, пагинация, оптимизированные запросы, планируется кэширование через Redis
- **Обработка ошибок**
  - Глобальный обработчик ошибок, информативные ответы API
- **Планировщик задач**
  - Поддержка фоновых задач через node-cron (например, пересчет рейтингов постов)
- **Логирование и мониторинг**
  - Логирование запросов через morgan, debug

---

## Структура проекта

- `/api` — точка входа для деплоя на Vercel/Serverless
- `/controllers` — обработка HTTP-запросов (User, Post, Comment, Like, Follow и др.)
- `/routes` — маршруты API
- `/middleware` — мидлвары (авторизация, загрузка файлов и др.)
- `/utils` — вспомогательные утилиты (например, пересчет рейтингов)
- `/prisma` — схема и настройки базы данных, миграции
- `/interfaces` — типы и интерфейсы (TypeScript)
- `/uploads` — временное хранение файлов (если не используется Cloudinary)
- `/views` — шаблоны ошибок (jade)
- `DockerFile`, `docker-compose.yaml` — контейнеризация и оркестрация

---

## Быстрый старт

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/Leonid-Korobkov/social-net-back.git
   cd social-net-back
   ```
2. **Установите зависимости:**
   ```bash
   npm install
   ```
3. **Настройте переменные окружения:**
   Создайте `.env` в корне (см. пример ниже).
4. **Инициализируйте базу данных:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```
5. **Запустите сервер разработки:**
   ```bash
   npm run dev
   ```
   Сервер будет доступен по адресу [http://localhost:4000](http://localhost:4000).

---

## Пример .env

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ORIGIN_URL_DEV=http://localhost:3000
ORIGIN_URL_PROD=your-prod-frontend-url
```

---

## Скрипты

- `npm run dev` — запуск в режиме разработки (nodemon, hot-reload)
- `npm start` — запуск production-сервера (`api/index.js`)
- `npm run build` — генерация Prisma client

---

## Вклад в проект

Pull requests приветствуются! Форкните репозиторий, создайте ветку с изменениями и отправьте PR.

---

## Благодарности

- [Prisma](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [Express.js](https://expressjs.com/)
- [Cloudinary](https://cloudinary.com/)
- [Vercel](https://vercel.com/)

---

## Frontend

Для frontend-части проекта: [social-net-front](https://github.com/Leonid-Korobkov/social-net-front)

---

## Демо

[https://zling.vercel.app](https://zling.vercel.app)

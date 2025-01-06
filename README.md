# Социальная сеть (Backend)

Этот репозиторий содержит backend-часть приложения **Zling** — социальной сети, разработанной для создания и взаимодействия между пользователями. Backend предоставляет API для управления пользователями, постами, комментариями, подписками и обработкой данных.

Приложение использует PostgreSQL в качестве базы данных и Prisma ORM для взаимодействия с ней. Это обеспечивает производительность, надежность и удобство работы с данными.

## Описание проекта

Backend **Zling** отвечает за следующие задачи:

- Обработка аутентификации и авторизации пользователей.
- Управление данными пользователей, их профилями и подписками.
- Работа с публикациями: создание, редактирование, удаление постов.
- Обработка комментариев и отметок "нравится".
- Поддержка реального времени (если применимо).
- Обработка ошибок и безопасное взаимодействие с клиентом.

## Оптимизации производительности

В приложении реализованы следующие оптимизации:

1. **Оптимизация базы данных:**

   - Индексы для часто используемых полей
   - Пагинация для больших наборов данных
   - Оптимизированные запросы с включением связанных данных

2. **Оптимизация изображений:**
   - Автоматическое сжатие загружаемых изображений
   - Конвертация в WebP формат
   - Хранение в Cloudinary с автоматической оптимизацией

## Используемые технологии

- **Node.js**: Среда выполнения для JavaScript.
- **TypeScript**: Надстройка для JavaScript с поддержкой статической типизации.
- **Prisma ORM**: Удобный инструмент для работы с базой данных.
- **PostgreSQL**: Реляционная база данных.
- **Express.js**: Минималистичный веб-фреймворк для Node.js.
- **JWT**: JSON Web Tokens для аутентификации.
- **bcrypt**: Для хэширования паролей.
- **Cloudinary**: Для работы с изображениями.

## Структура проекта

- **/src**: Основной код приложения.
  - **/controllers**: Контроллеры для обработки запросов.
  - **/services**: Логика работы с данными.
  - **/routes**: Определение маршрутов API.
  - **/prisma**: Настройки Prisma, включая схему базы данных.
- **/prisma/schema.prisma**: Определение моделей данных.
- **.env**: Конфигурация переменных окружения.

## Установка и запуск

1. **Клонирование репозитория**:

   ```bash
   git clone https://github.com/Leonid-Korobkov/social-net-back.git
   cd social-net-back
   ```

2. **Установка зависимостей**:

   ```bash
   npm install
   ```

3. **Настройка переменных окружения**:

   Создайте файл `.env` в корневой директории и добавьте необходимые переменные. Пример содержимого:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME
   JWT_SECRET=your_jwt_secret
   PORT=5000
   REDIS_URL=redis://localhost:6379
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Инициализация базы данных**:

   С помощью Prisma выполните следующие команды:

   - Синхронизация модели базы данных:

     ```bash
     npx prisma migrate dev
     ```

   - Генерация клиентских библиотек Prisma:
     ```bash
     npx prisma generate
     ```

   После выполнения этих шагов база данных будет готова к использованию.

5. **Запуск Redis**:

   ```bash
   redis-server
   ```

6. **Запуск сервера**:

   ```bash
   npm run dev
   ```

   Сервер будет доступен по адресу `http://localhost:5000`.

## Как создать базу данных локально

1. Убедитесь, что PostgreSQL установлен и запущен.
2. Создайте новую базу данных:
   ```sql
   CREATE DATABASE social_net;
   ```
3. Обновите строку подключения `DATABASE_URL` в файле `.env`, указав имя базы данных и учетные данные PostgreSQL.

## Вклад в проект

Вы можете предложить изменения или улучшения через pull request. Для этого:

1. Сделайте форк репозитория.
2. Создайте новую ветку:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Внесите изменения и создайте pull request.

## Благодарности

- [Документация Prisma](https://www.prisma.io/docs/)
- [PostgreSQL](https://www.postgresql.org/)
- [Express.js](https://expressjs.com/)
- [Redis](https://redis.io/)
- [Cloudinary](https://cloudinary.com/)

Для фронтенд-части проекта посетите репозиторий [social-net-front](https://github.com/Leonid-Korobkov/social-net-front).

Исследуйте приложение в открытом доступе по адресу [zling.up.railway.app](https://zling.up.railway.app/).

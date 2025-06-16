const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/SessionController');
const { authMiddleware } = require('../middleware/auth.middleware');

// Применение middleware аутентификации к защищенным маршрутам
router.use(authMiddleware);

// Получение всех активных сессий текущего пользователя
router.get('/', sessionController.getUserSessions);

// Завершение текущей сессии
router.delete('/current', sessionController.terminateCurrentSession);

// Завершение всех остальных сессий
router.delete('/all', sessionController.terminateOtherSessions);

// Завершение конкретной сессии
router.delete('/:sessionId', sessionController.terminateSession);

// Обработка ошибок
router.use((err, req, res, next) => {
  console.error('Ошибка в маршрутах сессий:', err);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

module.exports = router; 
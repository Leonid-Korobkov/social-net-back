const ModelTrainingService = require('../services/ml/ModelTrainingService');

async function trainModel() {
  try {
    console.log('Запуск обучения модели...');
    await ModelTrainingService.trainModelOnExistingPosts();
    console.log('Обучение успешно завершено');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при обучении модели:', error);
    process.exit(1);
  }
}

trainModel(); 
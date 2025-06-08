const { prisma } = require('../../prisma/prisma-client');
const ContentAnalysisService = require('./ContentAnalysisService');

class ModelTrainingService {
  async trainModelOnExistingPosts() {
    try {
      console.log('Начинаем обучение модели...');
      
      // Получаем все посты с их категориями
      const posts = await prisma.post.findMany({
        include: {
          categories: true
        }
      });

      if (posts.length === 0) {
        console.log('Нет постов для обучения модели');
        return;
      }

      console.log(`Найдено ${posts.length} постов для обучения`);

      // Обучаем модель
      await ContentAnalysisService.trainModel(posts);
      
      // Сохраняем модель
      await ContentAnalysisService.saveModel('./models/post-classifier');
      
      console.log('Модель успешно обучена и сохранена');
    } catch (error) {
      console.error('Ошибка при обучении модели:', error);
      throw error;
    }
  }

  async loadTrainedModel() {
    try {
      await ContentAnalysisService.loadModel('./models/post-classifier');
      console.log('Модель успешно загружена');
    } catch (error) {
      console.error('Ошибка при загрузке модели:', error);
      throw error;
    }
  }
}

module.exports = new ModelTrainingService(); 
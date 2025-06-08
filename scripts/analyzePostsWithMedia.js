const { PrismaClient } = require('@prisma/client');
const { ContentAnalysisService } = require('../services/ml/ContentAnalysisService');
const { analyzeImage } = require('../services/ml/MediaAnalysisService');
const prisma = new PrismaClient();

async function analyzePostsWithMedia() {
  try {
    console.log('Начинаем анализ постов с медиа...');

    // 1. Очищаем существующие связи между постами и категориями
    console.log('Очищаем существующие связи между постами и категориями...');
    await prisma.$executeRaw`TRUNCATE TABLE "_PostToPostCategory" CASCADE`;
    console.log('Связи очищены');

    // 2. Получаем все посты
    const posts = await prisma.post.findMany({
      include: {
        categories: true
      }
    });

    console.log(`Найдено ${posts.length} постов для анализа`);

    // 3. Анализируем каждый пост
    for (const post of posts) {
      try {
        console.log(`\nАнализируем пост #${post.id}...`);
        
        // Анализируем текстовое содержимое
        const textCategories = await ContentAnalysisService.predictCategories(post.content);
        console.log('Категории из текста:', textCategories);

        // Анализируем медиа контент
        let mediaCategories = [];
        if (post.media && post.media.length > 0) {
          console.log(`Найдено ${post.media.length} медиа файлов`);
          
          for (const mediaUrl of post.media) {
            try {
              const imageCategories = await analyzeImage(mediaUrl);
              mediaCategories = [...mediaCategories, ...imageCategories];
              console.log('Категории из изображения:', imageCategories);
            } catch (error) {
              console.error(`Ошибка при анализе изображения ${mediaUrl}:`, error.message);
            }
          }
        }

        // Объединяем и агрегируем категории
        const allCategories = [...textCategories, ...mediaCategories];
        const categoryConfidence = {};

        allCategories.forEach(({ name, confidence }) => {
          if (!categoryConfidence[name] || confidence > categoryConfidence[name]) {
            categoryConfidence[name] = confidence;
          }
        });

        // Сортируем категории по уверенности и берем топ-3
        const topCategories = Object.entries(categoryConfidence)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name, confidence]) => ({ name, confidence }));

        console.log('Итоговые категории:', topCategories);

        // Сохраняем категории в базу данных
        for (const { name, confidence } of topCategories) {
          await prisma.postCategory.upsert({
            where: { name },
            update: {},
            create: { name }
          });

          await prisma.post.update({
            where: { id: post.id },
            data: {
              categories: {
                connect: { name }
              }
            }
          });
        }

        console.log(`Пост #${post.id} успешно обработан`);
      } catch (error) {
        console.error(`Ошибка при обработке поста #${post.id}:`, error);
      }
    }

    console.log('\nАнализ завершен');
  } catch (error) {
    console.error('Ошибка при анализе постов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePostsWithMedia(); 
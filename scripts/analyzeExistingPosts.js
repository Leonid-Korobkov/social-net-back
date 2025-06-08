const { prisma } = require('../prisma/prisma-client');
const ContentAnalysisService = require('../services/ml/ContentAnalysisService');

async function analyzeExistingPosts() {
    try {
        console.log('Начинаем анализ существующих постов...');
        
        // Получаем все посты с категориями для обучения
        const postsWithCategories = await prisma.post.findMany({
            where: {
                categories: {
                    some: {}
                }
            },
            include: {
                categories: true
            }
        });

        console.log(`Найдено ${postsWithCategories.length} постов с категориями для обучения модели`);

        if (postsWithCategories.length === 0) {
            console.log('Нет постов с категориями для обучения. Используем правило-основанный подход.');
        } else {
            // Обучаем модель на постах с категориями
            console.log('Начинаем обучение модели...');
            await ContentAnalysisService.trainModel(postsWithCategories);
            console.log('Модель успешно обучена');

            // Сохраняем модель
            await ContentAnalysisService.saveModel('./models/content-analysis-model');
            console.log('Модель сохранена');
        }

        // Получаем посты без категорий
        const postsWithoutCategories = await prisma.post.findMany({
            where: {
                categories: {
                    none: {}
                }
            }
        });

        console.log(`Найдено ${postsWithoutCategories.length} постов без категорий для анализа`);

        // Анализируем каждый пост без категорий
        for (const post of postsWithoutCategories) {
            try {
                if (!post.content) {
                    console.log(`Пропускаем пост ${post.id} - пустой контент`);
                    continue;
                }

                // Получаем предсказанные категории
                const predictedCategories = await ContentAnalysisService.predictCategories(post.content);
                
                if (predictedCategories.length === 0) {
                    console.log(`Не удалось определить категории для поста ${post.id}`);
                    continue;
                }

                // Создаем или находим категории
                const categoryOperations = predictedCategories.map(cat => ({
                    where: { name: cat.name },
                    create: { 
                        name: cat.name,
                        confidence: cat.confidence
                    }
                }));

                // Обновляем пост с новыми категориями
                await prisma.post.update({
                    where: { id: post.id },
                    data: {
                        categories: {
                            connectOrCreate: categoryOperations
                        }
                    }
                });

                console.log(`Пост ${post.id} обновлен с категориями: ${predictedCategories.map(c => `${c.name}(${c.confidence.toFixed(2)})`).join(', ')}`);
            } catch (error) {
                console.error(`Ошибка при обработке поста ${post.id}:`, error);
            }
        }

        console.log('Анализ постов завершен');
    } catch (error) {
        console.error('Ошибка при анализе постов:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Запускаем скрипт
analyzeExistingPosts(); 
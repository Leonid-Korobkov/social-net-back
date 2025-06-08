const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { prisma } = require('../../prisma/prisma-client');

class ContentAnalysisServiceV2 {
  constructor() {
    this.model = null;
    this.tokenizer = new natural.WordTokenizer();
    this.categories = new Set();
    this.isModelTrained = false;
    this.wordIndex = new Map();
    this.embeddingSize = 100;
    this.maxSequenceLength = 200;
    this.vocabulary = new Set();
    this.stopWords = new Set(['и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже', 'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти', 'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть', 'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем', 'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том', 'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между']);
  }

  async initialize() {
    if (!this.model) {
      // Создаем модель с использованием word embeddings
      this.model = tf.sequential();
      
      // Слой встраивания слов
      this.model.add(tf.layers.embedding({
        inputDim: this.vocabulary.size + 1, // +1 для неизвестных слов
        outputDim: this.embeddingSize,
        inputLength: this.maxSequenceLength,
        maskZero: true
      }));
      
      // Сверточные слои для извлечения признаков
      this.model.add(tf.layers.conv1d({
        filters: 128,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
      }));
      this.model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
      
      this.model.add(tf.layers.conv1d({
        filters: 64,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
      }));
      this.model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
      
      // Полносвязные слои
      this.model.add(tf.layers.flatten());
      this.model.add(tf.layers.dense({
        units: 128,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));
      this.model.add(tf.layers.dropout({ rate: 0.3 }));
      
      this.model.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));
      this.model.add(tf.layers.dropout({ rate: 0.2 }));
      
      // Выходной слой с динамическим количеством категорий
      this.model.add(tf.layers.dense({
        units: this.categories.size,
        activation: 'sigmoid'
      }));

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
    }
  }

  preprocessText(text) {
    if (!text || typeof text !== 'string') {
      return new Array(this.maxSequenceLength).fill(0);
    }

    // Удаляем HTML-теги
    text = text.replace(/<[^>]*>/g, ' ');
    
    // Приводим к нижнему регистру
    text = text.toLowerCase();
    
    // Токенизируем текст
    const tokens = this.tokenizer.tokenize(text);
    
    // Удаляем стоп-слова и короткие токены
    const filteredTokens = tokens.filter(token => 
      !this.stopWords.has(token) && token.length > 2
    );
    
    // Создаем последовательность индексов
    const sequence = new Array(this.maxSequenceLength).fill(0);
    filteredTokens.forEach((token, i) => {
      if (i < this.maxSequenceLength) {
        if (!this.wordIndex.has(token)) {
          this.wordIndex.set(token, this.wordIndex.size + 1);
        }
        sequence[i] = this.wordIndex.get(token);
      }
    });
    
    return sequence;
  }

  async trainModel(posts) {
    if (!posts || posts.length === 0) {
      console.log('Нет данных для обучения модели');
      return;
    }

    // Собираем уникальные категории и создаем словарь
    const uniqueCategories = new Set();
    posts.forEach(post => {
      post.categories.forEach(cat => uniqueCategories.add(cat.name));
    });
    this.categories = uniqueCategories;

    // Создаем словарь из всех слов в постах
    posts.forEach(post => {
      const tokens = this.tokenizer.tokenize(post.content.toLowerCase());
      tokens.forEach(token => {
        if (!this.stopWords.has(token) && token.length > 2) {
          this.vocabulary.add(token);
        }
      });
    });

    // Инициализируем модель с обновленным размером выходного слоя
    await this.initialize();

    // Подготавливаем данные для обучения
    const texts = posts.map(post => this.preprocessText(post.content));
    const labels = posts.map(post => {
      const label = new Array(this.categories.size).fill(0);
      post.categories.forEach(cat => {
        const index = Array.from(this.categories).indexOf(cat.name);
        if (index !== -1) {
          label[index] = 1;
        }
      });
      return label;
    });

    // Преобразуем данные в тензоры
    const xs = tf.tensor2d(texts);
    const ys = tf.tensor2d(labels);

    // Разделяем данные на обучающую и валидационную выборки
    const splitIndex = Math.floor(texts.length * 0.8);
    const trainXs = xs.slice([0, 0], [splitIndex, this.maxSequenceLength]);
    const trainYs = ys.slice([0, 0], [splitIndex, this.categories.size]);
    const valXs = xs.slice([splitIndex, 0], [texts.length - splitIndex, this.maxSequenceLength]);
    const valYs = ys.slice([splitIndex, 0], [texts.length - splitIndex, this.categories.size]);

    // Обучаем модель с ранней остановкой
    await this.model.fit(trainXs, trainYs, {
      epochs: 50,
      batchSize: 8,
      validationData: [valXs, valYs],
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Эпоха ${epoch + 1}: точность = ${logs.acc}, валидационная точность = ${logs.val_acc}`);
        }
      }
    });

    this.isModelTrained = true;
    console.log('Модель успешно обучена');
  }

  async predictCategories(content) {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return [];
    }

    // Если модель не обучена, используем базовую категоризацию
    if (!this.isModelTrained) {
      return this.basicCategorization(content);
    }

    // Предобработка текста
    const sequence = this.preprocessText(content);
    const input = tf.tensor2d([sequence]);

    // Получаем предсказания модели
    const predictions = await this.model.predict(input).array();
    const categories = [];

    // Преобразуем предсказания в категории с уверенностью
    Array.from(this.categories).forEach((category, index) => {
      const confidence = predictions[0][index];
      if (confidence > 0.3) { // Повышаем порог уверенности
        categories.push({
          name: category,
          confidence: confidence
        });
      }
    });

    // Если категории не найдены, используем базовую категоризацию
    if (categories.length === 0) {
      return this.basicCategorization(content);
    }

    return categories;
  }

  basicCategorization(content) {
    const text = content.toLowerCase();
    const categories = [];
    const wordCount = text.split(/\s+/).length;

    // Анализируем контекст и семантику текста
    const context = this.analyzeContext(text);
    
    // Добавляем категории на основе контекста
    Object.entries(context).forEach(([category, score]) => {
      if (score > 0.3) {
        categories.push({
          name: category,
          confidence: score
        });
      }
    });

    return categories;
  }

  analyzeContext(text) {
    const context = {};
    const words = text.split(/\s+/);
    
    // Анализируем технические термины
    const techTerms = ['код', 'программирование', 'разработка', 'функционал', 'компонент', 'api', 'баг', 'ошибка', 'исправить', 'реализовать', 'интерфейс', 'система', 'алгоритм', 'оптимизация', 'производительность', 'тестирование', 'деплой', 'сервер', 'клиент', 'база данных', 'запрос', 'ответ', 'конфигурация', 'настройка', 'параметр', 'значение', 'переменная', 'функция', 'метод', 'класс', 'объект', 'модель', 'схема', 'структура', 'формат', 'тип', 'версия', 'обновление', 'патч', 'фича', 'релиз', 'сборка', 'компиляция', 'интерпретация', 'выполнение', 'запуск', 'остановка', 'пауза', 'возобновление', 'отмена', 'сброс', 'инициализация', 'завершение', 'закрытие', 'открытие', 'сохранение', 'загрузка', 'выгрузка', 'экспорт', 'импорт', 'конвертация', 'трансформация', 'валидация', 'проверка', 'подтверждение', 'отклонение', 'принятие', 'отказ', 'успех', 'неудача', 'ошибка', 'исключение', 'предупреждение', 'информация', 'логирование', 'отладка', 'профилирование', 'мониторинг', 'анализ', 'статистика', 'метрика', 'показатель', 'результат', 'эффективность', 'качество', 'надежность', 'стабильность', 'безопасность', 'защита', 'шифрование', 'аутентификация', 'авторизация', 'доступ', 'права', 'роли', 'пользователь', 'администратор', 'модератор', 'гость', 'сессия', 'токен', 'ключ', 'пароль', 'логин', 'регистрация', 'аккаунт', 'профиль', 'настройки', 'предпочтения', 'параметры', 'конфигурация', 'установка', 'инсталляция', 'удаление', 'деинсталляция', 'обновление', 'апгрейд', 'даунгрейд', 'откат', 'восстановление', 'резервное копирование', 'бэкап', 'рестор', 'миграция', 'перенос', 'копирование', 'дублирование', 'клонирование', 'форк', 'ветка', 'мерж', 'конфликт', 'разрешение', 'согласование', 'утверждение', 'проверка', 'тестирование', 'валидация', 'верификация', 'подтверждение', 'отклонение', 'принятие', 'отказ', 'успех', 'неудача', 'ошибка', 'исключение', 'предупреждение', 'информация', 'логирование', 'отладка', 'профилирование', 'мониторинг', 'анализ', 'статистика', 'метрика', 'показатель', 'результат', 'эффективность', 'качество', 'надежность', 'стабильность', 'безопасность', 'защита', 'шифрование', 'аутентификация', 'авторизация', 'доступ', 'права', 'роли', 'пользователь', 'администратор', 'модератор', 'гость', 'сессия', 'токен', 'ключ', 'пароль', 'логин', 'регистрация', 'аккаунт', 'профиль', 'настройки', 'предпочтения', 'параметры', 'конфигурация', 'установка', 'инсталляция', 'удаление', 'деинсталляция', 'обновление', 'апгрейд', 'даунгрейд', 'откат', 'восстановление', 'резервное копирование', 'бэкап', 'рестор', 'миграция', 'перенос', 'копирование', 'дублирование', 'клонирование', 'форк', 'ветка', 'мерж', 'конфликт', 'разрешение', 'согласование', 'утверждение'];
    const techScore = this.calculateTermScore(words, techTerms);
    if (techScore > 0) {
      context['technology'] = techScore;
    }

    // Анализируем UI/UX термины
    const uiTerms = ['интерфейс', 'дизайн', 'ui', 'ux', 'компонент', 'элемент', 'кнопка', 'меню', 'навигация', 'форма', 'поле', 'ввод', 'вывод', 'отображение', 'визуальный', 'графический', 'анимация', 'переход', 'эффект', 'стиль', 'цвет', 'шрифт', 'размер', 'позиция', 'расположение', 'выравнивание', 'отступ', 'поля', 'граница', 'рамка', 'фон', 'тень', 'прозрачность', 'яркость', 'контраст', 'насыщенность', 'оттенок', 'градиент', 'текстура', 'паттерн', 'иконка', 'изображение', 'картинка', 'фото', 'видео', 'аудио', 'звук', 'музыка', 'шум', 'тишина', 'пауза', 'воспроизведение', 'остановка', 'перемотка', 'громкость', 'баланс', 'эквалайзер', 'эффект', 'фильтр', 'обработка', 'редактирование', 'корректировка', 'настройка', 'параметр', 'опция', 'выбор', 'селектор', 'переключатель', 'чекбокс', 'радиокнопка', 'слайдер', 'ползунок', 'шкала', 'градуировка', 'деление', 'метка', 'подпись', 'заголовок', 'текст', 'контент', 'информация', 'данные', 'статистика', 'график', 'диаграмма', 'таблица', 'список', 'меню', 'навигация', 'маршрут', 'путь', 'ссылка', 'якорь', 'закладка', 'избранное', 'история', 'журнал', 'лог', 'отчет', 'статистика', 'аналитика', 'метрика', 'показатель', 'индикатор', 'статус', 'состояние', 'прогресс', 'загрузка', 'ожидание', 'обработка', 'выполнение', 'завершение', 'успех', 'ошибка', 'предупреждение', 'информация', 'подсказка', 'справка', 'помощь', 'поддержка', 'обратная связь', 'комментарий', 'отзыв', 'оценка', 'рейтинг', 'рекомендация', 'совет', 'подсказка', 'намек', 'указание', 'инструкция', 'руководство', 'мануал', 'документация', 'справка', 'помощь', 'поддержка', 'обратная связь', 'комментарий', 'отзыв', 'оценка', 'рейтинг', 'рекомендация', 'совет', 'подсказка', 'намек', 'указание', 'инструкция', 'руководство', 'мануал', 'документация'];
    const uiScore = this.calculateTermScore(words, uiTerms);
    if (uiScore > 0) {
      context['ui'] = uiScore;
    }

    return context;
  }

  calculateTermScore(words, terms) {
    let matches = 0;
    let totalTerms = terms.length;
    
    words.forEach(word => {
      if (terms.includes(word)) {
        matches++;
      }
    });
    
    return matches / totalTerms;
  }

  async saveModel(path) {
    if (this.model) {
      await this.model.save(`file://${path}`);
      console.log('Модель сохранена');
    }
  }

  async loadModel(path) {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);
      this.isModelTrained = true;
      console.log('Модель загружена');
    } catch (error) {
      console.error('Ошибка при загрузке модели:', error);
    }
  }
}

module.exports = new ContentAnalysisServiceV2(); 
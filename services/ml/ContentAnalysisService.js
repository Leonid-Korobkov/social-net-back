const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
const { prisma } = require('../../prisma/prisma-client');

class ContentAnalysisService {
  constructor() {
    this.model = null;
    this.tokenizer = new natural.WordTokenizer();
    this.categories = new Set();
    this.isModelTrained = false;
    this.wordIndex = new Map();
    this.stopWords = new Set(['и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже', 'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому', 'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти', 'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть', 'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем', 'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том', 'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между']);
    
    // Расширенные категории с дополнительными ключевыми словами
    this.baseCategories = {
      'technology': ['технологии', 'программирование', 'софт', 'железо', 'компьютер', 'интернет', 'цифровой', 'код', 'приложение', 'сайт', 'мобильный', 'веб', 'разработка', 'кодинг', 'разработчик', 'программист', 'алгоритм', 'данные', 'база данных', 'сервер', 'облако', 'искусственный интеллект', 'машинное обучение', 'нейросеть', 'айти', 'гаджеты', 'смартфон', 'ноутбук', 'пк', 'софт', 'хард', 'девайс', 'инновации', 'стартап', 'проект', 'система', 'платформа', 'интерфейс', 'функционал', 'оптимизация', 'автоматизация', 'робот', 'чип', 'процессор', 'виртуальный', 'онлайн', 'офлайн', 'сеть', 'безопасность', 'крипто', 'блокчейн'],
      'sports': ['спорт', 'футбол', 'баскетбол', 'теннис', 'игра', 'матч', 'команда', 'игрок', 'тренер', 'тренировка', 'соревнование', 'чемпионат', 'турнир', 'лига', 'счет', 'победа', 'поражение', 'спортсмен', 'фитнес', 'упражнение', 'тренировка', 'зал', 'стадион', 'арена', 'олимпиада', 'медаль', 'кубок', 'атлет', 'физическая активность', 'здоровье', 'выносливость', 'сила', 'скорость', 'ловкость', 'координация', 'разминка', 'растяжка', 'мотивация', 'достижение', 'рекорд', 'первенство', 'турнир', 'соревнование'],
      'music': ['музыка', 'песня', 'группа', 'концерт', 'альбом', 'артист', 'певец', 'музыкант', 'гитара', 'пианино', 'барабан', 'бас', 'звук', 'мелодия', 'ритм', 'текст', 'выступление', 'живой', 'студия', 'запись', 'продюсер', 'жанр', 'рок', 'поп', 'джаз', 'классика', 'электронная', 'хит', 'сингл', 'клип', 'инструмент', 'вокал', 'аранжировка', 'композиция', 'аудио', 'звучание', 'тональность', 'аккорд', 'нота', 'музыкальный', 'исполнение', 'творчество', 'импровизация'],
      'art': ['искусство', 'художник', 'картина', 'рисунок', 'скульптура', 'дизайн', 'творческий', 'творчество', 'выставка', 'галерея', 'музей', 'стиль', 'цвет', 'форма', 'композиция', 'визуальный', 'фотография', 'фото', 'картинка', 'изображение', 'цифровое искусство', 'иллюстрация', 'эскиз', 'живопись', 'графика', 'арт', 'креатив', 'вдохновение', 'экспрессия', 'эстетика', 'красота', 'гармония', 'пропорция', 'перспектива', 'свет', 'тень', 'палитра', 'материал', 'техника', 'мастерство', 'талант'],
      'food': ['еда', 'кулинария', 'рецепт', 'ресторан', 'блюдо', 'кухня', 'шеф', 'ингредиент', 'вкус', 'готовить', 'выпечка', 'есть', 'пить', 'завтрак', 'обед', 'ужин', 'перекус', 'десерт', 'напиток', 'кофе', 'чай', 'вино', 'пиво', 'продукты', 'продукт', 'кушать', 'кафе', 'закуска', 'соус', 'специи', 'приправа', 'аромат', 'запах', 'свежий', 'свежесть', 'качество', 'польза', 'питание', 'диета', 'здоровое питание', 'вегетарианский', 'веганский'],
      'travel': ['путешествие', 'поездка', 'путь', 'отпуск', 'праздник', 'тур', 'туризм', 'направление', 'место', 'страна', 'город', 'отель', 'курорт', 'пляж', 'гора', 'природа', 'приключение', 'исследовать', 'посетить', 'достопримечательности', 'культура', 'местный', 'опыт', 'дорога', 'маршрут', 'экскурсия', 'гид', 'путеводитель', 'карта', 'навигация', 'транспорт', 'перелет', 'поезд', 'автобус', 'море', 'океан', 'пляж', 'горы', 'лес', 'природа', 'ландшафт'],
      'fashion': ['мода', 'стиль', 'одежда', 'наряд', 'костюм', 'обувь', 'аксессуары', 'украшения', 'дизайнер', 'бренд', 'тренд', 'коллекция', 'модель', 'красота', 'макияж', 'косметика', 'волосы', 'уход за кожей', 'парфюм', 'шоппинг', 'магазин', 'бутик', 'аутфит', 'гардероб', 'сезон', 'цвет', 'фасон', 'ткань', 'материал', 'качество', 'комфорт', 'элегантность', 'гламур', 'стильный', 'модный', 'трендовый'],
      'science': ['наука', 'научный', 'исследование', 'изучение', 'эксперимент', 'открытие', 'теория', 'физика', 'химия', 'биология', 'медицина', 'здоровье', 'медицинский', 'доктор', 'пациент', 'лечение', 'болезнь', 'симптом', 'диагноз', 'анализ', 'данные', 'статистика', 'ученый', 'лаборатория', 'метод', 'методология', 'гипотеза', 'доказательство', 'публикация', 'исследователь', 'открытие', 'инновация', 'прогресс', 'развитие'],
      'business': ['бизнес', 'компания', 'рынок', 'индустрия', 'финансы', 'деньги', 'инвестиции', 'акции', 'торговля', 'коммерция', 'экономика', 'экономический', 'финансовый', 'банк', 'банковский', 'стартап', 'предприниматель', 'управление', 'менеджмент', 'стратегия', 'маркетинг', 'продажи', 'проект', 'стартап', 'прибыль', 'убыток', 'бюджет', 'план', 'цель', 'задача', 'результат', 'эффективность', 'оптимизация', 'развитие', 'рост'],
      'entertainment': ['развлечения', 'кино', 'фильм', 'кинотеатр', 'тв', 'телевидение', 'шоу', 'сериал', 'актер', 'актриса', 'режиссер', 'продюсер', 'театр', 'спектакль', 'драма', 'комедия', 'боевик', 'ужасы', 'документальный', 'анимация', 'мультфильм', 'концерт', 'выступление', 'фестиваль', 'игра', 'игровой', 'консоль', 'приставка', 'онлайн', 'стриминг', 'подкаст', 'юмор', 'смех', 'веселье', 'отдых']
    };
  }

  async initialize() {
    if (!this.model) {
      this.model = tf.sequential();
      
      // Добавляем слои с регуляризацией и dropout
      this.model.add(tf.layers.dense({
          units: 128,
          activation: 'relu',
          inputShape: [100],
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));
      this.model.add(tf.layers.dropout({ rate: 0.3 }));
      
      this.model.add(tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));
      this.model.add(tf.layers.dropout({ rate: 0.2 }));
      
      this.model.add(tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));
      this.model.add(tf.layers.dropout({ rate: 0.1 }));
      
      this.model.add(tf.layers.dense({
          units: Object.keys(this.baseCategories).length,
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
        return new Array(100).fill(0);
    }

    // Приводим текст к нижнему регистру
    text = text.toLowerCase();
    
    // Токенизируем текст
    const tokens = this.tokenizer.tokenize(text);
    
    // Удаляем стоп-слова и короткие токены
    const filteredTokens = tokens.filter(token => 
        !this.stopWords.has(token) && token.length > 2
    );
    
    // Создаем вектор фиксированной длины
    const vector = new Array(100).fill(0);
    
    // Заполняем вектор на основе токенов
    filteredTokens.forEach((token, i) => {
        if (i < 100) {
            const index = this.hashString(token) % 100;
            // Используем TF-IDF-подобный подход
            const frequency = filteredTokens.filter(t => t === token).length;
            vector[index] = frequency / filteredTokens.length;
        }
    });
    
    return vector;
  }

  // Простая хеш-функция для строк
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async trainModel(posts) {
    if (!posts || posts.length === 0) {
        console.log('Нет данных для обучения модели');
        return;
    }

    // Инициализируем модель перед обучением
    await this.initialize();

    // Собираем уникальные категории
    const uniqueCategories = new Set();
    posts.forEach(post => {
        post.categories.forEach(cat => uniqueCategories.add(cat.name));
    });
    this.categories = uniqueCategories;

    // Подготавливаем данные для обучения
    const texts = posts.map(post => this.preprocessText(post.content));
    const labels = posts.map(post => {
        const label = new Array(Object.keys(this.baseCategories).length).fill(0);
        post.categories.forEach(cat => {
            const index = Object.keys(this.baseCategories).indexOf(cat.name);
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
    const trainXs = xs.slice([0, 0], [splitIndex, 100]);
    const trainYs = ys.slice([0, 0], [splitIndex, Object.keys(this.baseCategories).length]);
    const valXs = xs.slice([splitIndex, 0], [texts.length - splitIndex, 100]);
    const valYs = ys.slice([splitIndex, 0], [texts.length - splitIndex, Object.keys(this.baseCategories).length]);

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

    const text = content.toLowerCase();
    const categories = [];
    let totalMatches = 0;
    let wordCount = text.split(/\s+/).length;

    // Сначала пробуем правило-основанный подход
    const ruleBasedCategories = [];
    for (const [category, keywords] of Object.entries(this.baseCategories)) {
        let matches = 0;
        let totalKeywords = keywords.length;
        let exactMatches = 0;
        let partialMatches = 0;

        // Считаем точные и частичные совпадения
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                exactMatches++;
                matches++;
            } else {
                // Ищем частичные совпадения
                const words = text.split(/\s+/);
                for (const word of words) {
                    if (word.length > 3) {
                        if (keyword.includes(word) || word.includes(keyword)) {
                            partialMatches++;
                            matches += 0.5; // Частичные совпадения имеют меньший вес
                        }
                    }
                }
            }
        }

        if (matches > 0) {
            // Учитываем длину текста и тип совпадений
            const baseConfidence = (exactMatches + partialMatches * 0.5) / (totalMatches || 1);
            const lengthFactor = Math.min(wordCount / 50, 1);
            const matchQualityFactor = exactMatches / (exactMatches + partialMatches || 1);
            
            const confidence = baseConfidence * (0.6 + 0.4 * lengthFactor) * (0.7 + 0.3 * matchQualityFactor);

            if (confidence > 0.2) { // Повышаем порог уверенности
                ruleBasedCategories.push({
                    name: category,
                    confidence: Math.min(confidence * 1.2, 1)
                });
            }
        }
    }

    // Если правило-основанный подход дал результаты с высокой уверенностью, используем их
    if (ruleBasedCategories.some(cat => cat.confidence > 0.7)) {
        return ruleBasedCategories.filter(cat => cat.confidence > 0.7);
    }

    // Если модель обучена, пробуем ML-подход
    if (this.isModelTrained && this.model) {
        try {
            const vector = this.preprocessText(content);
            const prediction = this.model.predict(tf.tensor2d([vector]));
            const values = await prediction.data();
            
            // Получаем топ-3 категории с наивысшей уверенностью
            const predictions = Object.keys(this.baseCategories).map((category, index) => ({
                name: category,
                confidence: values[index]
            })).sort((a, b) => b.confidence - a.confidence).slice(0, 3);

            // Если ML-предсказания имеют высокую уверенность, используем их
            if (predictions[0].confidence > 0.3) {
                return predictions.filter(p => p.confidence > 0.3);
            }
        } catch (error) {
            console.error('Ошибка при ML-предсказании:', error);
        }
    }

    // Если оба подхода не дали хороших результатов, возвращаем правило-основанные категории
    return ruleBasedCategories;
  }

  async saveModel(path) {
    if (this.isModelTrained) {
      await this.model.save(`file://${path}`);
    }
  }

  async loadModel(path) {
    try {
      this.model = await tf.loadLayersModel(`file://${path}`);
      this.isModelTrained = true;
      console.log('Модель успешно загружена');
    } catch (error) {
      console.error('Ошибка при загрузке модели:', error);
    }
  }

  async updateUserInterests(userId, postId, interactionType) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { categories: true }
    });

    if (!post) return;

    const weight = this.getInteractionWeight(interactionType);
    
    for (const category of post.categories) {
      await prisma.userInterest.upsert({
        where: {
          userId_categoryId: {
            userId,
            categoryId: category.id
          }
        },
        update: {
          weight: {
            increment: weight
          }
        },
        create: {
          userId,
          categoryId: category.id,
          weight
        }
      });
    }
  }

  getInteractionWeight(interactionType) {
    const weights = {
      like: 1.0,
      comment: 1.5,
      share: 2.0,
      view: 0.5
    };
    return weights[interactionType] || 0;
  }
}

// Создаем и экспортируем экземпляр сервиса
const contentAnalysisService = new ContentAnalysisService();
module.exports = { ContentAnalysisService: contentAnalysisService }; 
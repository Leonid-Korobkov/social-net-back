const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Функция для преобразования URL в JPEG формат для Cloudinary
function convertToJpegUrl(url) {
  if (url.includes('cloudinary.com')) {
    // Если URL уже содержит параметры, добавляем f_jpg
    if (url.includes('?')) {
      return `${url}&f_jpg`;
    }
    // Если URL не содержит параметров, добавляем ?f_jpg
    return `${url}?f_jpg`;
  }
  return url;
}

// Загружаем предобученную модель MobileNet
let model;
async function loadModel() {
  if (!model) {
    model = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');
  }
  return model;
}

// Функция для загрузки изображения
async function loadImage(imagePath) {
  try {
    let imageBuffer;
    
    if (imagePath.startsWith('http')) {
      // Преобразуем URL в JPEG формат для Cloudinary
      const jpegUrl = convertToJpegUrl(imagePath);
      const response = await axios.get(jpegUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else {
      imageBuffer = fs.readFileSync(imagePath);
    }
    
    const image = await tf.node.decodeImage(imageBuffer);
    return image;
  } catch (error) {
    console.error('Ошибка при загрузке изображения:', error);
    throw error;
  }
}

// Функция для предобработки изображения
function preprocessImage(image) {
  // Изменяем размер до 224x224 (размер, ожидаемый MobileNet)
  const resized = tf.image.resizeBilinear(image, [224, 224]);
  
  // Нормализуем значения пикселей
  const normalized = resized.div(255.0);
  
  // Добавляем размерность батча
  return normalized.expandDims(0);
}

// Функция для анализа изображения
async function analyzeImage(url) {
  try {
    // Загружаем модель
    const model = await loadModel();
    
    // Загружаем и предобрабатываем изображение
    const image = await loadImage(url);
    const preprocessed = preprocessImage(image);
    
    // Получаем предсказания
    const predictions = await model.predict(preprocessed).data();
    
    // Преобразуем предсказания в категории с уверенностью
    const categories = [];
    const threshold = 0.3; // Порог уверенности
    
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] > threshold) {
        categories.push({
          name: getCategoryName(i),
          confidence: predictions[i]
        });
      }
    }
    
    // Освобождаем память
    tf.dispose([image, preprocessed]);
    
    return categories;
  } catch (error) {
    console.error('Ошибка при анализе изображения:', error);
    return [];
  }
}

// Функция для получения названия категории по индексу
function getCategoryName(index) {
  // Здесь можно использовать маппинг индексов на названия категорий
  // или использовать предопределенный список категорий
  const categories = [
    'technology', 'food', 'nature', 'sport', 'art', 'music',
    'travel', 'fashion', 'business', 'education', 'entertainment',
    'health', 'science', 'politics', 'other'
  ];
  
  return categories[index % categories.length];
}

module.exports = {
  analyzeImage
}; 
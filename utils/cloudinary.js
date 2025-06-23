// Функция для преобразования Cloudinary URL в JPG формат
function optimizeCloudinaryImage(imageUrl, width = 1000) {
  if (!imageUrl) return ''
  if (!imageUrl.includes('cloudinary.com')) return imageUrl

  const baseUrl = imageUrl.split('upload/')[0] + 'upload/'
  const imagePath = imageUrl.split('upload/')[1]
  const transforms = [
    'q_auto:best',
    'fl_progressive',
    `w_${width}`,
    'f_png',
    'fl_immutable_cache'
  ].join(',')

  return `${baseUrl}${transforms}/${imagePath}`
}

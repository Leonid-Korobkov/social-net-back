const { prisma } = require('../prisma/prisma-client');

async function checkEmptyPosts() {
  try {
    const postIds = [314, 228, 229, 253, 264, 263, 260, 262, 230];
    
    for (const id of postIds) {
      const post = await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          content: true,
          title: true,
          createdAt: true
        }
      });
      
      console.log(`\nПост ${id}:`);
      console.log('Заголовок:', post.title);
      console.log('Содержимое:', post.content);
      console.log('Дата создания:', post.createdAt);
      console.log('Длина содержимого:', post.content ? post.content.length : 0);
    }
  } catch (error) {
    console.error('Ошибка при проверке постов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmptyPosts(); 
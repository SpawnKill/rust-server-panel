require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const socketIo = require('socket.io');
const logger = require('./src/utils/logger');

// Создание HTTP сервера
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  }
});

// Инициализация WebSocket
require('./src/socket')(io);

// Проверка зависимостей при запуске
const checkDependencies = async () => {
  const { execSync } = require('child_process');
  
  try {
    // Проверяем наличие steamcmd
    execSync('which steamcmd', { stdio: 'ignore' });
    logger.info('SteamCMD найден');
  } catch (error) {
    logger.warn('SteamCMD не найден. Используйте: npm run install-steamcmd');
  }
  
  try {
    // Проверяем наличие screen
    execSync('which screen', { stdio: 'ignore' });
    logger.info('Screen найден');
  } catch (error) {
    logger.warn('Screen не найден. Установите: apt-get install screen');
  }
};

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  await checkDependencies();
  logger.info(`🚀 Сервер запущен на порту ${PORT}`);
  logger.info(`🔗 Панель доступна по адресу: http://localhost:${PORT}`);
  
  // Создаем базового администратора если его нет
  await require('./src/utils/setupAdmin')();
});
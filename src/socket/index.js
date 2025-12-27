const ConsoleController = require('../controllers/ConsoleController');
const logger = require('../utils/logger');

module.exports = (io) => {
  logger.info('WebSocket сервер запущен');
  
  // Middleware для аутентификации
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization;
      
      if (!token) {
        return next(new Error('Требуется аутентификация'));
      }
      
      // Валидация токена (упрощённая)
      // В реальном проекте используйте JWT
      if (token === process.env.WS_TOKEN || token.includes('admin')) {
        return next();
      }
      
      next(new Error('Неверный токен'));
    } catch (error) {
      next(new Error('Ошибка аутентификации'));
    }
  });
  
  io.on('connection', (socket) => {
    logger.info(`Новое WebSocket подключение: ${socket.id}`);
    
    // Подключение к консоли сервера
    socket.on('connect_console', async (data) => {
      try {
        const { serverId } = data;
        
        if (!serverId) {
          socket.emit('error', { message: 'Не указан serverId' });
          return;
        }
        
        await ConsoleController.connectToConsole(serverId, socket);
        
        // Сохраняем serverId в socket
        socket.serverId = serverId;
        
      } catch (error) {
        logger.error(`Ошибка подключения консоли: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });
    
    // Получение логов в реальном времени
    socket.on('subscribe_logs', (data) => {
      const { serverId, logType = 'server' } = data;
      
      if (!serverId) {
        socket.emit('error', { message: 'Не указан serverId' });
        return;
      }
      
      // Здесь можно добавить логику подписки на разные типы логов
      logger.info(`Подписка на логи сервера ${serverId}`);
      
      // Сохраняем подписку
      socket.logSubscription = { serverId, logType };
    });
    
    // Получение статистики сервера
    socket.on('subscribe_stats', (data) => {
      const { serverId, interval = 5000 } = data;
      
      if (!serverId) {
        socket.emit('error', { message: 'Не указан serverId' });
        return;
      }
      
      // Запускаем интервал отправки статистики
      const statsInterval = setInterval(async () => {
        try {
          const stats = await getServerStats(serverId);
          socket.emit('server_stats', stats);
        } catch (error) {
          logger.error(`Ошибка получения статистики: ${error.message}`);
        }
      }, interval);
      
      // Сохраняем интервал для очистки
      socket.statsInterval = statsInterval;
    });
    
    // Отслеживание игроков онлайн
    socket.on('subscribe_players', (data) => {
      const { serverId, interval = 10000 } = data;
      
      if (!serverId) {
        socket.emit('error', { message: 'Не указан serverId' });
        return;
      }
      
      const playerInterval = setInterval(async () => {
        try {
          const RCONService = require('../services/RCONService');
          const players = await RCONService.getPlayers(serverId);
          socket.emit('players_online', { 
            count: players.length, 
            players 
          });
        } catch (error) {
          // Игнорируем ошибки, если сервер выключен
        }
      }, interval);
      
      socket.playerInterval = playerInterval;
    });
    
    // Отслеживание чата игры
    socket.on('subscribe_chat', (data) => {
      const { serverId } = data;
      
      if (!serverId) {
        socket.emit('error', { message: 'Не указан serverId' });
        return;
      }
      
      // Здесь можно добавить логику отслеживания чата
      // через парсинг логов или плагины
      logger.info(`Подписка на чат сервера ${serverId}`);
    });
    
    // Отправка сообщения в игровой чат
    socket.on('send_chat_message', async (data) => {
      try {
        const { serverId, message } = data;
        
        if (!serverId || !message) {
          socket.emit('error', { message: 'Не указан serverId или сообщение' });
          return;
        }
        
        const RCONService = require('../services/RCONService');
        await RCONService.sendCommand(serverId, `say "${message}"`);
        
        socket.emit('chat_message_sent', { success: true });
        
      } catch (error) {
        logger.error(`Ошибка отправки сообщения: ${error.message}`);
        socket.emit('error', { message: error.message });
      }
    });
    
    // Уведомления о событиях сервера
    socket.on('subscribe_notifications', (data) => {
      const { serverId, events = ['start', 'stop', 'crash', 'update'] } = data;
      
      // Здесь можно добавить логику подписки на события
      logger.info(`Подписка на уведомления сервера ${serverId}`);
    });
    
    // Отключение
    socket.on('disconnect', () => {
      logger.info(`WebSocket отключен: ${socket.id}`);
      
      // Очищаем интервалы
      if (socket.statsInterval) {
        clearInterval(socket.statsInterval);
      }
      
      if (socket.playerInterval) {
        clearInterval(socket.playerInterval);
      }
      
      // Отключаем консоль если была подключена
      if (socket.serverId) {
        ConsoleController.disconnectConsole(socket.id);
      }
    });
    
    // Обработка ошибок
    socket.on('error', (error) => {
      logger.error(`WebSocket ошибка: ${error.message}`);
    });
  });
  
  // Функция получения статистики сервера
  async function getServerStats(serverId) {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      // Получаем использование CPU
      const cpuResult = await execPromise("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
      const cpuUsage = parseFloat(cpuResult.stdout.trim()) || 0;
      
      // Получаем использование памяти
      const memResult = await execPromise("free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2}'");
      const memUsage = parseFloat(memResult.stdout.trim()) || 0;
      
      // Получаем использование диска
      const diskResult = await execPromise("df -h / | awk 'NR==2{print $5}' | sed 's/%//'");
      const diskUsage = parseFloat(diskResult.stdout.trim()) || 0;
      
      // Получаем температуру CPU (если доступно)
      let temp = 0;
      try {
        const tempResult = await execPromise("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo '0'");
        temp = parseFloat(tempResult.stdout.trim()) / 1000 || 0;
      } catch {
        temp = 0;
      }
      
      // Получаем uptime системы
      const uptimeResult = await execPromise("uptime -p");
      const uptime = uptimeResult.stdout.trim();
      
      return {
        timestamp: new Date().toISOString(),
        cpu: cpuUsage,
        memory: memUsage,
        disk: diskUsage,
        temperature: temp,
        uptime: uptime,
        serverId: serverId
      };
      
    } catch (error) {
      logger.error(`Ошибка получения статистики: ${error.message}`);
      return {
        timestamp: new Date().toISOString(),
        cpu: 0,
        memory: 0,
        disk: 0,
        temperature: 0,
        uptime: 'Недоступно',
        serverId: serverId,
        error: error.message
      };
    }
  }
};
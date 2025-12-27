const express = require('express');
const router = express.Router();
const ConsoleController = require('../controllers/ConsoleController');
const authMiddleware = require('../middleware/auth');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получение истории команд
router.get('/:serverId/history', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await ConsoleController.getCommandHistory(serverId, parseInt(limit));
    
    res.json({
      success: true,
      history
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Выполнение скрипта команд
router.post('/:serverId/execute-script', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { script } = req.body;
    
    if (!script) {
      return res.status(400).json({
        success: false,
        error: 'Скрипт не указан'
      });
    }
    
    const results = await ConsoleController.executeScript(serverId, script);
    
    res.json({
      success: true,
      results,
      message: `Выполнено ${results.length} команд`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Сохранение команды в историю
router.post('/:serverId/save-command', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { command, user } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Команда не указана'
      });
    }
    
    await ConsoleController.saveToHistory(serverId, command, user || 'admin');
    
    res.json({
      success: true,
      message: 'Команда сохранена в историю'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение списка доступных команд
router.get('/commands', async (req, res) => {
  try {
    const commands = [
      {
        category: 'Основные',
        commands: [
          { name: 'help', description: 'Показать справку' },
          { name: 'status', description: 'Статус сервера' },
          { name: 'players', description: 'Список игроков' },
          { name: 'say <message>', description: 'Отправить сообщение в чат' }
        ]
      },
      {
        category: 'Управление игроками',
        commands: [
          { name: 'kick <steamid> [reason]', description: 'Кикнуть игрока' },
          { name: 'ban <steamid> [reason]', description: 'Забанить игрока' },
          { name: 'unban <steamid>', description: 'Разбанить игрока' },
          { name: 'mute <steamid> <minutes>', description: 'Заглушить игрока' }
        ]
      },
      {
        category: 'Предметы и телепортация',
        commands: [
          { name: 'inventory.giveto <player> <item> <amount>', description: 'Выдать предмет' },
          { name: 'teleport <player1> <player2>', description: 'Телепортировать игроков' },
          { name: 'teleport.pos <player> <x> <y> <z>', description: 'Телепортировать к координатам' },
          { name: 'craft.add <player> <item>', description: 'Добавить крафт' }
        ]
      },
      {
        category: 'Oxide плагины',
        commands: [
          { name: 'oxide.load <plugin>', description: 'Загрузить плагин' },
          { name: 'oxide.unload <plugin>', description: 'Выгрузить плагин' },
          { name: 'oxide.reload <plugin>', description: 'Перезагрузить плагин' },
          { name: 'oxide.list', description: 'Список плагинов' }
        ]
      },
      {
        category: 'Сервер',
        commands: [
          { name: 'server.save', description: 'Сохранить мир' },
          { name: 'server.writecfg', description: 'Сохранить конфиг' },
          { name: 'global.message <message>', description: 'Глобальное сообщение' },
          { name: 'quit', description: 'Остановить сервер' }
        ]
      }
    ];
    
    res.json({
      success: true,
      commands
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение автодополнения команд
router.get('/autocomplete/:partial', async (req, res) => {
  try {
    const { partial } = req.params;
    
    const suggestions = await ConsoleController.getCommandSuggestions(partial);
    
    res.json({
      success: true,
      suggestions
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Проверка подключения RCON
router.post('/:serverId/test-connection', async (req, res) => {
  try {
    const { serverId } = req.params;
    const RCONService = require('../services/RCONService');
    
    // Получаем статус сервера
    const status = await RCONService.getServerStatus(serverId);
    
    if (!status.running) {
      return res.json({
        success: false,
        message: 'Сервер не запущен'
      });
    }
    
    // Пробуем выполнить простую команду
    const response = await RCONService.sendCommand(serverId, 'status');
    
    res.json({
      success: true,
      message: 'RCON подключение работает',
      response: response.substring(0, 100) + '...'
    });
    
  } catch (error) {
    res.json({
      success: false,
      message: 'Ошибка RCON подключения',
      error: error.message
    });
  }
});

module.exports = router;
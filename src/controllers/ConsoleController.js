const RCONService = require('../services/RCONService');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class ConsoleController {
  constructor() {
    this.activeConsoles = new Map();
    this.logWatchers = new Map();
  }

  // Подключение к RCON консоли
  async connectToConsole(serverId, socket) {
    try {
      logger.info(`Подключение к консоли сервера ${serverId}`);
      
      // Получаем RCON пароль из конфига
      const configPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', 
                                  `server-${serverId}`, 'server.cfg');
      const configContent = await fs.readFile(configPath, 'utf8');
      
      const rconPassword = this.extractRCONPassword(configContent);
      if (!rconPassword) {
        throw new Error('RCON пароль не найден в конфиге');
      }

      // Подключаемся к RCON
      await RCONService.connectToServer(serverId, '127.0.0.1', 28016, rconPassword);
      
      // Запускаем мониторинг логов
      const logPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver',
                               `server-${serverId}`, 'server.log');
      await RCONService.watchServerLogs(serverId, logPath);
      
      // Сохраняем socket
      this.activeConsoles.set(socket.id, { serverId, socket });
      
      // Слушаем сообщения от сервера
      RCONService.on('message', ({ serverId: srvId, message }) => {
        if (srvId === serverId) {
          socket.emit('console_output', { type: 'response', data: message });
        }
      });
      
      // Слушаем логи
      RCONService.on('log', ({ serverId: srvId, line }) => {
        if (srvId === serverId) {
          socket.emit('console_output', { type: 'log', data: line });
        }
      });
      
      // Обработка команд от клиента
      socket.on('console_command', async (data) => {
        try {
          const { command } = data;
          
          // Отправляем эхо команды
          socket.emit('console_output', { 
            type: 'command', 
            data: `> ${command}` 
          });
          
          // Отправляем команду на сервер
          const response = await RCONService.sendCommand(serverId, command);
          socket.emit('console_output', { 
            type: 'response', 
            data: response 
          });
          
        } catch (error) {
          socket.emit('console_output', { 
            type: 'error', 
            data: `Ошибка: ${error.message}` 
          });
        }
      });
      
      // Автодополнение команд
      socket.on('autocomplete', async (data) => {
        const { partial } = data;
        const suggestions = await this.getCommandSuggestions(partial);
        socket.emit('autocomplete_suggestions', { suggestions });
      });
      
      // Получение списка игроков
      socket.on('get_players', async () => {
        try {
          const players = await RCONService.getPlayers(serverId);
          socket.emit('players_list', { players });
        } catch (error) {
          socket.emit('console_output', {
            type: 'error',
            data: `Не удалось получить список игроков: ${error.message}`
          });
        }
      });
      
      // Отключение
      socket.on('disconnect', () => {
        this.disconnectConsole(socket.id);
      });
      
      // Приветственное сообщение
      socket.emit('console_output', {
        type: 'system',
        data: 'RCON консоль подключена. Введите "help" для списка команд.'
      });
      
      // Получаем статус сервера
      const status = await RCONService.getServerStatus(serverId);
      socket.emit('server_status', { status });
      
    } catch (error) {
      logger.error(`Ошибка подключения к консоли: ${error.message}`);
      socket.emit('console_output', {
        type: 'error',
        data: `Не удалось подключиться: ${error.message}`
      });
      socket.disconnect();
    }
  }

  // Извлечение RCON пароля из конфига
  extractRCONPassword(configContent) {
    const match = configContent.match(/rcon\.password\s+"([^"]+)"/);
    return match ? match[1] : null;
  }

  // Получение подсказок команд
  async getCommandSuggestions(partial) {
    const commands = [
      'help', 'status', 'players', 'say', 'kick', 'ban',
      'global.message', 'inventory.giveto', 'teleport',
      'oxide.load', 'oxide.unload', 'oxide.reload',
      'server.save', 'server.writecfg', 'quit',
      'entity.find', 'item.give', 'craft.add'
    ];
    
    return commands.filter(cmd => 
      cmd.toLowerCase().startsWith(partial.toLowerCase())
    );
  }

  // Отключение консоли
  disconnectConsole(socketId) {
    const consoleInfo = this.activeConsoles.get(socketId);
    if (consoleInfo) {
      const { serverId } = consoleInfo;
      logger.info(`Отключение консоли сервера ${serverId}`);
      
      // Останавливаем мониторинг логов
      RCONService.stopWatchingLogs(serverId);
      
      // Отключаемся от RCON
      const rcon = RCONService.rconConnections.get(serverId);
      if (rcon) {
        rcon.end().catch(() => {});
      }
      
      this.activeConsoles.delete(socketId);
    }
  }

  // Получение истории команд
  async getCommandHistory(serverId, limit = 50) {
    try {
      const logPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver',
                               `server-${serverId}`, 'server.log');
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.split('\n').reverse().slice(0, limit);
      
      // Фильтруем только RCON команды
      const commands = lines.filter(line => 
        line.includes('[RCON]') || line.includes('Command:')
      ).map(line => line.trim());
      
      return commands;
    } catch (error) {
      logger.error(`Ошибка получения истории: ${error.message}`);
      return [];
    }
  }

  // Выполнение скрипта команд
  async executeScript(serverId, script) {
    const commands = script.split('\n')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('#'));
    
    const results = [];
    
    for (const command of commands) {
      try {
        const response = await RCONService.sendCommand(serverId, command);
        results.push({
          command,
          success: true,
          response
        });
        
        // Небольшая задержка между командами
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.push({
          command,
          success: false,
          error: error.message
        });
        break; // Останавливаем выполнение при ошибке
      }
    }
    
    return results;
  }

  // Сохранение команды в историю
  async saveToHistory(serverId, command, user) {
    try {
      const historyPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver',
                                   `server-${serverId}`, 'command_history.txt');
      
      const entry = `[${new Date().toISOString()}] ${user}: ${command}\n`;
      await fs.appendFile(historyPath, entry, 'utf8');
      
    } catch (error) {
      logger.error(`Ошибка сохранения истории: ${error.message}`);
    }
  }
}

module.exports = new ConsoleController();
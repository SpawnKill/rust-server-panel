const Rcon = require('rcon-client').Rcon;
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class RCONService extends EventEmitter {
  constructor() {
    super();
    this.rconConnections = new Map();
    this.logWatchers = new Map();
  }

  // Подключение к RCON серверу
  async connectToServer(serverId, host = '127.0.0.1', port = 28016, password) {
    try {
      const rcon = new Rcon({
        host,
        port,
        password,
        timeout: 5000
      });

      await rcon.connect();
      logger.info(`RCON подключен к серверу ${serverId}`);

      this.rconConnections.set(serverId, rcon);
      
      // Слушаем сообщения от сервера
      rcon.on('message', (message) => {
        this.emit('message', { serverId, message });
      });

      rcon.on('end', () => {
        logger.warn(`RCON соединение закрыто для сервера ${serverId}`);
        this.rconConnections.delete(serverId);
      });

      return rcon;
    } catch (error) {
      logger.error(`Ошибка подключения RCON: ${error.message}`);
      throw error;
    }
  }

  // Отправка команды на сервер
  async sendCommand(serverId, command) {
    const rcon = this.rconConnections.get(serverId);
    if (!rcon) {
      throw new Error(`RCON connection not found for server ${serverId}`);
    }

    try {
      logger.info(`Отправка команды на сервер ${serverId}: ${command}`);
      const response = await rcon.send(command);
      return response;
    } catch (error) {
      logger.error(`Ошибка отправки команды: ${error.message}`);
      throw error;
    }
  }

  // Управление сервером через systemd
  async controlServer(serverId, action) {
    const serviceName = `rust-server-${serverId}`;
    const validActions = ['start', 'stop', 'restart', 'status', 'enable', 'disable'];

    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    return new Promise((resolve, reject) => {
      exec(`sudo systemctl ${action} ${serviceName}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Ошибка управления сервером: ${stderr}`);
          reject(new Error(stderr || error.message));
        } else {
          logger.info(`Сервер ${serverId}: ${action} успешно`);
          resolve(stdout);
        }
      });
    });
  }

  // Получение статуса сервера
  async getServerStatus(serverId) {
    try {
      const status = await this.controlServer(serverId, 'status');
      return {
        running: status.includes('active (running)'),
        status: status
      };
    } catch (error) {
      return {
        running: false,
        status: error.message
      };
    }
  }

  // Мониторинг логов в реальном времени
  async watchServerLogs(serverId, logPath) {
    const { spawn } = require('child_process');
    
    // Если уже есть watcher, останавливаем его
    if (this.logWatchers.has(serverId)) {
      this.logWatchers.get(serverId).kill();
    }

    // Команда tail для отслеживания логов
    const tail = spawn('tail', ['-f', '-n', '100', logPath]);
    
    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          this.emit('log', { serverId, line: line.trim() });
        }
      });
    });

    tail.stderr.on('data', (data) => {
      logger.error(`Ошибка tail для сервера ${serverId}: ${data}`);
    });

    tail.on('close', (code) => {
      logger.info(`Watcher логов закрыт для сервера ${serverId}, код: ${code}`);
      this.logWatchers.delete(serverId);
    });

    this.logWatchers.set(serverId, tail);
  }

  // Остановка мониторинга логов
  stopWatchingLogs(serverId) {
    const watcher = this.logWatchers.get(serverId);
    if (watcher) {
      watcher.kill();
      this.logWatchers.delete(serverId);
    }
  }

  // Получение информации об игроках
  async getPlayers(serverId) {
    try {
      const response = await this.sendCommand(serverId, 'playerlist');
      return this.parsePlayerList(response);
    } catch (error) {
      throw error;
    }
  }

  // Парсинг списка игроков
  parsePlayerList(response) {
    const players = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.includes('SteamID')) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          players.push({
            steamId: parts[0].split(':')[1]?.trim(),
            name: parts[1].trim(),
            ping: parseInt(parts[2].trim()) || 0
          });
        }
      }
    }
    
    return players;
  }

  // Бан игрока
  async banPlayer(serverId, steamId, reason = '') {
    const command = reason ? `banid ${steamId} "${reason}"` : `banid ${steamId}`;
    return await this.sendCommand(serverId, command);
  }

  // Кик игрока
  async kickPlayer(serverId, steamId, reason = '') {
    const command = reason ? `kick ${steamId} "${reason}"` : `kick ${steamId}`;
    return await this.sendCommand(serverId, command);
  }

  // Глобальное сообщение
  async globalMessage(serverId, message) {
    return await this.sendCommand(serverId, `say "${message}"`);
  }

  // Закрытие всех соединений
  async disconnectAll() {
    for (const [serverId, rcon] of this.rconConnections) {
      try {
        await rcon.end();
      } catch (error) {
        logger.error(`Ошибка закрытия RCON для сервера ${serverId}: ${error}`);
      }
    }
    this.rconConnections.clear();
    
    // Останавливаем все watchers
    for (const [serverId, watcher] of this.logWatchers) {
      watcher.kill();
    }
    this.logWatchers.clear();
  }
}

module.exports = new RCONService();
const SteamCMDService = require('../services/SteamCMDService');
const RCONService = require('../services/RCONService');
const FileService = require('../services/FileService');
const logger = require('../utils/logger');

class ServerController {
  // Установка сервера
  async installServer(req, res) {
    try {
      const { 
        serverName, 
        worldSize = 3000, 
        maxPlayers = 50,
        rconPassword 
      } = req.body;

      if (!serverName) {
        return res.status(400).json({ error: 'Имя сервера обязательно' });
      }

      logger.info(`Начало установки сервера: ${serverName}`);
      
      const server = await SteamCMDService.installRustServer(
        serverName,
        worldSize,
        maxPlayers
      );

      // Если указан RCON пароль, обновляем конфиг
      if (rconPassword) {
        await FileService.updateRCONPassword(server.path, rconPassword);
      }

      res.json({
        success: true,
        message: 'Сервер успешно установлен',
        server
      });

    } catch (error) {
      logger.error(`Ошибка установки сервера: ${error.message}`);
      res.status(500).json({ 
        error: 'Ошибка установки сервера',
        details: error.message 
      });
    }
  }

  // Управление сервером
  async controlServer(req, res) {
    try {
      const { serverId } = req.params;
      const { action } = req.body;

      const validActions = ['start', 'stop', 'restart', 'kill'];
      
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: 'Некорректное действие' });
      }

      const result = await RCONService.controlServer(serverId, action);
      
      res.json({
        success: true,
        message: `Сервер ${action} успешно`,
        result
      });

    } catch (error) {
      logger.error(`Ошибка управления сервером: ${error.message}`);
      res.status(500).json({ 
        error: 'Ошибка управления сервером',
        details: error.message 
      });
    }
  }

  // Получение статуса сервера
  async getServerStatus(req, res) {
    try {
      const { serverId } = req.params;
      
      const status = await RCONService.getServerStatus(serverId);
      const players = await RCONService.getPlayers(serverId).catch(() => []);
      
      // Получение информации о системе
      const systemInfo = await this.getSystemInfo();
      
      res.json({
        success: true,
        status: {
          ...status,
          players: {
            online: players.length,
            list: players
          },
          system: systemInfo,
          uptime: await this.getServerUptime(serverId)
        }
      });

    } catch (error) {
      logger.error(`Ошибка получения статуса: ${error.message}`);
      res.status(500).json({ 
        error: 'Ошибка получения статуса',
        details: error.message 
      });
    }
  }

  // Получение списка серверов
  async getServers(req, res) {
    try {
      const serversDir = process.env.RUST_SERVER_PATH || '/home/rustserver';
      const { readdir } = require('fs').promises;
      
      const items = await readdir(serversDir, { withFileTypes: true });
      const servers = [];
      
      for (const item of items) {
        if (item.isDirectory() && item.name.startsWith('server-')) {
          const serverId = item.name.replace('server-', '');
          const status = await RCONService.getServerStatus(serverId);
          
          servers.push({
            id: serverId,
            name: item.name,
            path: `${serversDir}/${item.name}`,
            status: status.running ? 'running' : 'stopped',
            lastModified: item.mtime
          });
        }
      }
      
      res.json({
        success: true,
        servers
      });

    } catch (error) {
      logger.error(`Ошибка получения списка серверов: ${error.message}`);
      res.status(500).json({ 
        error: 'Ошибка получения списка серверов',
        details: error.message 
      });
    }
  }

  // Получение информации о системе
  async getSystemInfo() {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec(`
        echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')% | \
        Memory: $(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2}') | \
        Disk: $(df -h / | awk 'NR==2{print $5}')"
      `, (error, stdout) => {
        resolve(stdout || 'Информация недоступна');
      });
    });
  }

  // Получение uptime сервера
  async getServerUptime(serverId) {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec(`systemctl show rust-server-${serverId} --property=ActiveEnterTimestamp`, 
        (error, stdout) => {
          if (error || !stdout.includes('=')) {
            resolve('Недоступно');
          } else {
            const timestamp = stdout.split('=')[1].trim();
            resolve(timestamp);
          }
        }
      );
    });
  }

  // Обновление сервера
  async updateServer(req, res) {
    try {
      const { serverId } = req.params;
      
      // Останавливаем сервер
      await RCONService.controlServer(serverId, 'stop');
      
      // Обновляем через SteamCMD
      const serverPath = `/home/rustserver/server-${serverId}`;
      const updateCmd = `
        cd ${SteamCMDService.steamCmdPath} && 
        ./steamcmd.sh +force_install_dir ${serverPath} +login anonymous +app_update 258550 validate +quit
      `;
      
      await SteamCMDService.executeCommandAsUser('rustserver', updateCmd);
      
      // Запускаем сервер
      await RCONService.controlServer(serverId, 'start');
      
      res.json({
        success: true,
        message: 'Сервер успешно обновлен'
      });

    } catch (error) {
      logger.error(`Ошибка обновления сервера: ${error.message}`);
      res.status(500).json({ 
        error: 'Ошибка обновления сервера',
        details: error.message 
      });
    }
  }

  // Создание бэкапа
  async createBackup(req, res) {
    try {
      const { serverId } = req.params;
      const { includeLogs = false } = req.body;
      
      const serverPath = `/home/rustserver/server-${serverId}`;
      const backupDir = `/home/rustserver/backups`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${serverId}-${timestamp}.tar.gz`;
      const backupPath = `${backupDir}/${backupName}`;
      
      // Создаем директорию для бэкапов
      const { ensureDir } = require('fs-extra');
      await ensureDir(backupDir);
      
      // Команда архивации
      let backupCmd = `tar -czf ${backupPath} -C ${serverPath} `;
      
      if (includeLogs) {
        backupCmd += '.';
      } else {
        backupCmd += `--exclude="*.log" --exclude="logs" .`;
      }
      
      await SteamCMDService.executeCommand(backupCmd);
      
      // Устанавливаем права
      await SteamCMDService.executeCommand(`chown rustserver:rustserver ${backupPath}`);
      
      res.json({
        success: true,
        message: 'Бэкап создан',
        backup: {
          name: backupName,
          path: backupPath,
          size: await this.getFileSize(backupPath),
          created: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error(`Ошибка создания бэкапа: ${error.message}`);
      res.status(500).json({ 
        error: 'Ошибка создания бэкапа',
        details: error.message 
      });
    }
  }

  async getFileSize(filePath) {
    const { stat } = require('fs').promises;
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}

module.exports = new ServerController();
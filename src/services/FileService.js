const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const { exec } = require('child_process');

class FileService {
  constructor() {
    this.basePath = process.env.RUST_SERVER_PATH || '/home/rustserver';
  }

  // Обновление RCON пароля в конфиге
  async updateRCONPassword(serverPath, newPassword) {
    try {
      const configPath = path.join(serverPath, 'server.cfg');
      
      if (!await fs.pathExists(configPath)) {
        throw new Error('Конфиг сервера не найден');
      }
      
      let content = await fs.readFile(configPath, 'utf8');
      
      // Заменяем или добавляем RCON пароль
      if (content.includes('rcon.password')) {
        content = content.replace(
          /rcon\.password\s+"[^"]*"/,
          `rcon.password "${newPassword}"`
        );
      } else {
        content += `\nrcon.password "${newPassword}"`;
      }
      
      await fs.writeFile(configPath, content, 'utf8');
      logger.info(`RCON пароль обновлен для сервера: ${serverPath}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Ошибка обновления RCON пароля: ${error.message}`);
      throw error;
    }
  }

  // Обновление Steam API ключа
  async updateSteamAPIKey(serverPath, apiKey) {
    try {
      // Обновляем в server.cfg
      const configPath = path.join(serverPath, 'server.cfg');
      
      if (await fs.pathExists(configPath)) {
        let content = await fs.readFile(configPath, 'utf8');
        
        if (content.includes('server.seed')) {
          content = content.replace(
            /server\.seed\s+"[^"]*"/,
            `server.seed "${apiKey}"`
          );
        } else {
          content += `\nserver.seed "${apiKey}"`;
        }
        
        await fs.writeFile(configPath, content, 'utf8');
      }
      
      // Также обновляем в serveridentity если нужно
      const identityPath = path.join(serverPath, 'serveridentity');
      if (await fs.pathExists(identityPath)) {
        const identityFiles = await fs.readdir(identityPath);
        
        for (const file of identityFiles) {
          if (file.includes('cfg') || file.endsWith('.cfg')) {
            const filePath = path.join(identityPath, file);
            let content = await fs.readFile(filePath, 'utf8');
            
            // Ищем и заменяем Steam API ключ
            if (content.includes('server.seed')) {
              content = content.replace(
                /server\.seed\s+"[^"]*"/,
                `server.seed "${apiKey}"`
              );
              await fs.writeFile(filePath, content, 'utf8');
            }
          }
        }
      }
      
      logger.info(`Steam API ключ обновлен для сервера: ${serverPath}`);
      return true;
      
    } catch (error) {
      logger.error(`Ошибка обновления Steam API ключа: ${error.message}`);
      throw error;
    }
  }

  // Получение информации о сервере из конфига
  async getServerInfo(serverPath) {
    try {
      const configPath = path.join(serverPath, 'server.cfg');
      
      if (!await fs.pathExists(configPath)) {
        return null;
      }
      
      const content = await fs.readFile(configPath, 'utf8');
      const lines = content.split('\n');
      
      const info = {
        hostname: 'Неизвестно',
        port: 28015,
        rconPort: 28016,
        maxPlayers: 50,
        worldSize: 3000,
        description: ''
      };
      
      lines.forEach(line => {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('hostname')) {
          info.hostname = trimmed.match(/"([^"]+)"/)?.[1] || 'Неизвестно';
        } else if (trimmed.startsWith('port')) {
          info.port = parseInt(trimmed.split(' ')[1]) || 28015;
        } else if (trimmed.startsWith('rcon.port')) {
          info.rconPort = parseInt(trimmed.split(' ')[1]) || 28016;
        } else if (trimmed.startsWith('server.maxplayers')) {
          info.maxPlayers = parseInt(trimmed.split(' ')[1]) || 50;
        } else if (trimmed.startsWith('server.worldsize')) {
          info.worldSize = parseInt(trimmed.split(' ')[1]) || 3000;
        } else if (trimmed.startsWith('description')) {
          info.description = trimmed.match(/"([^"]+)"/)?.[1] || '';
        }
      });
      
      return info;
      
    } catch (error) {
      logger.error(`Ошибка получения информации о сервере: ${error.message}`);
      return null;
    }
  }

  // Поиск файлов по расширению
  async findFilesByExtension(serverPath, extensions) {
    try {
      const files = [];
      const extList = Array.isArray(extensions) ? extensions : [extensions];
      
      const search = async (dir) => {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            await search(itemPath);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (extList.includes(ext)) {
              const stats = await fs.stat(itemPath);
              files.push({
                name: item.name,
                path: path.relative(serverPath, itemPath),
                size: stats.size,
                modified: stats.mtime,
                extension: ext
              });
            }
          }
        }
      };
      
      await search(serverPath);
      return files;
      
    } catch (error) {
      logger.error(`Ошибка поиска файлов: ${error.message}`);
      throw error;
    }
  }

  // Создание символической ссылки
  async createSymlink(source, target) {
    try {
      await fs.ensureDir(path.dirname(target));
      
      if (await fs.pathExists(target)) {
        await fs.remove(target);
      }
      
      await fs.symlink(source, target);
      logger.info(`Создана симлинк: ${source} -> ${target}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Ошибка создания симлинка: ${error.message}`);
      throw error;
    }
  }

  // Архивирование директории
  async archiveDirectory(sourceDir, outputFile) {
    try {
      const archiver = require('archiver');
      const output = fs.createWriteStream(outputFile);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      return new Promise((resolve, reject) => {
        output.on('close', () => {
          logger.info(`Архив создан: ${outputFile} (${archive.pointer()} байт)`);
          resolve(outputFile);
        });
        
        archive.on('error', (err) => {
          reject(err);
        });
        
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
      });
      
    } catch (error) {
      logger.error(`Ошибка архивирования: ${error.message}`);
      throw error;
    }
  }

  // Распаковка архива
  async extractArchive(archivePath, destination) {
    try {
      await fs.ensureDir(destination);
      
      const extract = require('extract-zip');
      
      await extract(archivePath, {
        dir: destination
      });
      
      logger.info(`Архив распакован: ${archivePath} -> ${destination}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Ошибка распаковки архива: ${error.message}`);
      throw error;
    }
  }

  // Получение размера директории
  async getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      
      const traverse = async (currentPath) => {
        const items = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(currentPath, item.name);
          
          if (item.isDirectory()) {
            await traverse(itemPath);
          } else {
            const stats = await fs.stat(itemPath);
            totalSize += stats.size;
          }
        }
      };
      
      await traverse(dirPath);
      return totalSize;
      
    } catch (error) {
      logger.error(`Ошибка получения размера директории: ${error.message}`);
      return 0;
    }
  }

  // Копирование с сохранением прав
  async copyWithPermissions(source, destination) {
    try {
      await fs.copy(source, destination);
      
      // Устанавливаем права владельца
      await new Promise((resolve, reject) => {
        exec(`chown -R rustserver:rustserver "${destination}"`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      logger.info(`Файлы скопированы с сохранением прав: ${source} -> ${destination}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Ошибка копирования с правами: ${error.message}`);
      throw error;
    }
  }

  // Создание резервной копии конфига
  async backupConfig(serverPath, configPath, backupSuffix = 'backup') {
    try {
      const fullConfigPath = path.join(serverPath, configPath);
      
      if (!await fs.pathExists(fullConfigPath)) {
        throw new Error('Конфиг не найден');
      }
      
      const backupPath = `${fullConfigPath}.${backupSuffix}_${Date.now()}`;
      await fs.copy(fullConfigPath, backupPath);
      
      logger.info(`Создана резервная копия: ${backupPath}`);
      
      return backupPath;
      
    } catch (error) {
      logger.error(`Ошибка создания бэкапа конфига: ${error.message}`);
      throw error;
    }
  }

  // Восстановление из резервной копии
  async restoreFromBackup(serverPath, configPath, backupPath) {
    try {
      const fullConfigPath = path.join(serverPath, configPath);
      
      if (!await fs.pathExists(backupPath)) {
        throw new Error('Резервная копия не найдена');
      }
      
      // Создаем бэкап текущего файла перед восстановлением
      await this.backupConfig(serverPath, configPath, 'pre_restore');
      
      // Восстанавливаем из бэкапа
      await fs.copy(backupPath, fullConfigPath);
      
      logger.info(`Конфиг восстановлен из бэкапа: ${backupPath} -> ${fullConfigPath}`);
      
      return true;
      
    } catch (error) {
      logger.error(`Ошибка восстановления из бэкапа: ${error.message}`);
      throw error;
    }
  }

  // Чтение логов в реальном времени
  async tailLogFile(logPath, lines = 100) {
    try {
      const { exec } = require('child_process');
      
      return new Promise((resolve, reject) => {
        exec(`tail -n ${lines} "${logPath}"`, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
      
    } catch (error) {
      logger.error(`Ошибка чтения логов: ${error.message}`);
      throw error;
    }
  }

  // Очистка старых логов
  async cleanupOldLogs(serverPath, days = 7) {
    try {
      const logsPath = path.join(serverPath, 'logs');
      
      if (!await fs.pathExists(logsPath)) {
        return 0;
      }
      
      const files = await fs.readdir(logsPath);
      const now = Date.now();
      const deleted = [];
      
      for (const file of files) {
        const filePath = path.join(logsPath, file);
        const stats = await fs.stat(filePath);
        const age = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (age > days && file.endsWith('.log')) {
          await fs.unlink(filePath);
          deleted.push(file);
        }
      }
      
      logger.info(`Удалено старых логов: ${deleted.length}`);
      return deleted.length;
      
    } catch (error) {
      logger.error(`Ошибка очистки логов: ${error.message}`);
      throw error;
    }
  }

  // Получение информации о дисковом пространстве
  async getDiskUsage() {
    try {
      const { exec } = require('child_process');
      
      return new Promise((resolve, reject) => {
        exec('df -h', (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            const lines = stdout.split('\n');
            const usage = {};
            
            lines.forEach(line => {
              const parts = line.split(/\s+/);
              if (parts.length >= 6) {
                const mount = parts[5];
                usage[mount] = {
                  filesystem: parts[0],
                  size: parts[1],
                  used: parts[2],
                  available: parts[3],
                  usePercent: parts[4],
                  mounted: mount
                };
              }
            });
            
            resolve(usage);
          }
        });
      });
      
    } catch (error) {
      logger.error(`Ошибка получения информации о диске: ${error.message}`);
      throw error;
    }
  }

  // Проверка целостности файлов сервера
  async verifyServerFiles(serverPath) {
    try {
      const requiredFiles = [
        'RustDedicated',
        'RustDedicated_Data',
        'server.cfg'
      ];
      
      const missing = [];
      const corrupted = [];
      
      for (const file of requiredFiles) {
        const filePath = path.join(serverPath, file);
        
        if (!await fs.pathExists(filePath)) {
          missing.push(file);
        } else {
          // Проверяем размер исполняемого файла
          if (file === 'RustDedicated') {
            const stats = await fs.stat(filePath);
            if (stats.size < 1000000) { // Меньше 1MB - вероятно поврежден
              corrupted.push(file);
            }
          }
        }
      }
      
      return {
        valid: missing.length === 0 && corrupted.length === 0,
        missing,
        corrupted,
        totalFiles: requiredFiles.length
      };
      
    } catch (error) {
      logger.error(`Ошибка проверки файлов сервера: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new FileService();
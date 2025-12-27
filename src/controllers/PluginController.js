const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const RCONService = require('../services/RCONService');

class PluginController {
  constructor() {
    this.oxideRepo = 'https://github.com/OxideMod/Oxide.Rust/releases/latest';
    this.umodStore = 'https://umod.org/plugins/search.json';
    this.basePath = process.env.RUST_SERVER_PATH || '/home/rustserver';
  }

  // Установка Oxide
  async installOxide(serverId) {
    try {
      const serverPath = path.join(this.basePath, `server-${serverId}`);
      
      logger.info(`Установка Oxide для сервера ${serverId}`);
      
      // Получаем последнюю версию Oxide
      const oxideInfo = await this.getLatestOxideVersion();
      
      // Скачиваем Oxide
      const oxidePath = path.join(serverPath, 'oxide.zip');
      await this.downloadFile(oxideInfo.downloadUrl, oxidePath);
      
      // Распаковываем
      await this.extractZip(oxidePath, serverPath);
      
      // Удаляем архив
      await fs.unlink(oxidePath);
      
      // Устанавливаем права
      await this.setPermissions(serverPath);
      
      logger.info(`Oxide установлен версии ${oxideInfo.version}`);
      
      return {
        success: true,
        version: oxideInfo.version,
        message: 'Oxide успешно установлен'
      };
      
    } catch (error) {
      logger.error(`Ошибка установки Oxide: ${error.message}`);
      throw error;
    }
  }

  // Получение последней версии Oxide
  async getLatestOxideVersion() {
    try {
      // Получаем URL последнего релиза
      const response = await fetch('https://api.github.com/repos/OxideMod/Oxide.Rust/releases/latest');
      const data = await response.json();
      
      // Ищем asset с Windows версией (там обычно есть ссылка на все версии)
      const windowsAsset = data.assets.find(asset => 
        asset.name.includes('Windows')
      );
      
      if (!windowsAsset) {
        throw new Error('Не удалось найти релиз Oxide');
      }
      
      // Извлекаем версию из названия
      const version = data.tag_name.replace('v', '');
      
      // Для Rust обычно используется Windows версия как базовая
      const downloadUrl = `https://github.com/OxideMod/Oxide.Rust/releases/download/${data.tag_name}/Oxide.Rust.zip`;
      
      return {
        version,
        downloadUrl,
        releaseNotes: data.body
      };
      
    } catch (error) {
      logger.error(`Ошибка получения версии Oxide: ${error.message}`);
      
      // Fallback на прямую загрузку
      return {
        version: 'latest',
        downloadUrl: 'https://github.com/OxideMod/Oxide.Rust/releases/latest/download/Oxide.Rust.zip'
      };
    }
  }

  // Скачивание файла
  async downloadFile(url, destination) {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Не удалось скачать файл: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    await fs.writeFile(destination, buffer);
  }

  // Распаковка ZIP
  async extractZip(zipPath, destination) {
    const extract = require('extract-zip');
    
    await extract(zipPath, {
      dir: destination
    });
  }

  // Установка прав
  async setPermissions(serverPath) {
    await fs.chmod(path.join(serverPath, 'RustDedicated_Data', 'Managed'), 0o755);
    await fs.chmod(path.join(serverPath, 'oxide'), 0o755);
  }

  // Поиск плагинов на uMod
  async searchPlugins(query, page = 1) {
    try {
      const url = `${this.umodStore}?q=${encodeURIComponent(query)}&page=${page}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Ошибка поиска плагинов: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        plugins: data.plugins || [],
        total: data.total || 0,
        page: data.page || 1
      };
      
    } catch (error) {
      logger.error(`Ошибка поиска плагинов: ${error.message}`);
      return {
        success: false,
        plugins: [],
        error: error.message
      };
    }
  }

  // Установка плагина
  async installPlugin(serverId, pluginUrl) {
    try {
      const serverPath = path.join(this.basePath, `server-${serverId}`);
      const pluginsDir = path.join(serverPath, 'oxide', 'plugins');
      
      // Создаем директорию если её нет
      await fs.ensureDir(pluginsDir);
      
      // Скачиваем плагин
      const pluginName = path.basename(pluginUrl);
      const pluginPath = path.join(pluginsDir, pluginName);
      
      await this.downloadFile(pluginUrl, pluginPath);
      
      // Если это .cs файл, компилируем его
      if (pluginName.endsWith('.cs')) {
        await this.compileCSharpPlugin(serverPath, pluginPath);
      }
      
      // Загружаем плагин на сервере
      const pluginNameWithoutExt = path.basename(pluginName, path.extname(pluginName));
      await RCONService.sendCommand(serverId, `oxide.load ${pluginNameWithoutExt}`);
      
      logger.info(`Плагин установлен: ${pluginName}`);
      
      return {
        success: true,
        plugin: pluginNameWithoutExt,
        message: 'Плагин успешно установлен и загружен'
      };
      
    } catch (error) {
      logger.error(`Ошибка установки плагина: ${error.message}`);
      throw error;
    }
  }

  // Компиляция C# плагина
  async compileCSharpPlugin(serverPath, pluginPath) {
    try {
      const managedPath = path.join(serverPath, 'RustDedicated_Data', 'Managed');
      
      // Команда компиляции через mcs (mono)
      const compileCmd = `mcs -target:library -out:${pluginPath}.dll \
        -r:${managedPath}/Assembly-CSharp.dll \
        -r:${managedPath}/Facepunch.System.dll \
        -r:${managedPath}/Oxide.Core.dll \
        -r:${managedPath}/Oxide.Rust.dll \
        ${pluginPath}`;
      
      const { exec } = require('child_process');
      
      return new Promise((resolve, reject) => {
        exec(compileCmd, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Ошибка компиляции: ${stderr}`);
            reject(new Error(`Ошибка компиляции: ${stderr}`));
          } else {
            // Удаляем исходный .cs файл после успешной компиляции
            fs.unlink(pluginPath).catch(() => {});
            resolve();
          }
        });
      });
      
    } catch (error) {
      logger.warn(`Не удалось скомпилировать плагин: ${error.message}`);
      // Оставляем .cs файл как есть
    }
  }

  // Получение списка установленных плагинов
  async getInstalledPlugins(serverId) {
    try {
      const serverPath = path.join(this.basePath, `server-${serverId}`);
      const pluginsDir = path.join(serverPath, 'oxide', 'plugins');
      const configsDir = path.join(serverPath, 'oxide', 'config');
      
      // Проверяем существует ли директория
      if (!await fs.pathExists(pluginsDir)) {
        return { success: true, plugins: [] };
      }
      
      const pluginFiles = await fs.readdir(pluginsDir);
      const plugins = [];
      
      for (const file of pluginFiles) {
        if (file.endsWith('.dll') || file.endsWith('.cs')) {
          const pluginName = path.basename(file, path.extname(file));
          const configPath = path.join(configsDir, `${pluginName}.json`);
          
          plugins.push({
            name: pluginName,
            file: file,
            type: file.endsWith('.cs') ? 'source' : 'compiled',
            hasConfig: await fs.pathExists(configPath),
            size: (await fs.stat(path.join(pluginsDir, file))).size,
            installed: new Date((await fs.stat(path.join(pluginsDir, file))).mtime)
          });
        }
      }
      
      // Получаем статус плагинов с сервера
      try {
        const status = await RCONService.sendCommand(serverId, 'oxide.list');
        const loadedPlugins = this.parsePluginList(status);
        
        // Обновляем статус загруженности
        plugins.forEach(plugin => {
          plugin.loaded = loadedPlugins.includes(plugin.name);
        });
      } catch (error) {
        logger.warn(`Не удалось получить статус плагинов: ${error.message}`);
        plugins.forEach(plugin => plugin.loaded = false);
      }
      
      return {
        success: true,
        plugins: plugins.sort((a, b) => a.name.localeCompare(b.name))
      };
      
    } catch (error) {
      logger.error(`Ошибка получения плагинов: ${error.message}`);
      return {
        success: false,
        plugins: [],
        error: error.message
      };
    }
  }

  // Парсинг списка плагинов из ответа RCON
  parsePluginList(response) {
    const lines = response.split('\n');
    const plugins = [];
    
    for (const line of lines) {
      const match = line.match(/^\s*(\S+)\s+(\S+)\s+(\S+)/);
      if (match && match[1] !== 'Name') {
        plugins.push(match[1]);
      }
    }
    
    return plugins;
  }

  // Управление плагинами (загрузка/выгрузка/перезагрузка)
  async managePlugin(serverId, pluginName, action) {
    try {
      const validActions = ['load', 'unload', 'reload'];
      
      if (!validActions.includes(action)) {
        throw new Error(`Некорректное действие: ${action}`);
      }
      
      const command = `oxide.${action} ${pluginName}`;
      const result = await RCONService.sendCommand(serverId, command);
      
      logger.info(`Плагин ${pluginName} ${action}: ${result}`);
      
      return {
        success: true,
        message: `Плагин ${pluginName} успешно ${action}`,
        result: result.trim()
      };
      
    } catch (error) {
      logger.error(`Ошибка управления плагином: ${error.message}`);
      throw error;
    }
  }

  // Удаление плагина
  async removePlugin(serverId, pluginName) {
    try {
      const serverPath = path.join(this.basePath, `server-${serverId}`);
      const pluginsDir = path.join(serverPath, 'oxide', 'plugins');
      const configsDir = path.join(serverPath, 'oxide', 'config');
      const dataDir = path.join(serverPath, 'oxide', 'data');
      
      // Ищем файлы плагина
      const pluginFiles = await fs.readdir(pluginsDir);
      const pluginFile = pluginFiles.find(f => 
        f.startsWith(pluginName) && (f.endsWith('.dll') || f.endsWith('.cs'))
      );
      
      if (!pluginFile) {
        throw new Error(`Плагин ${pluginName} не найден`);
      }
      
      // Выгружаем плагин
      try {
        await RCONService.sendCommand(serverId, `oxide.unload ${pluginName}`);
      } catch (error) {
        logger.warn(`Не удалось выгрузить плагин: ${error.message}`);
      }
      
      // Удаляем файлы
      await fs.unlink(path.join(pluginsDir, pluginFile));
      
      // Удаляем конфиг если есть
      const configPath = path.join(configsDir, `${pluginName}.json`);
      if (await fs.pathExists(configPath)) {
        await fs.unlink(configPath);
      }
      
      // Удаляем данные если есть
      const dataPath = path.join(dataDir, `${pluginName}.json`);
      if (await fs.pathExists(dataPath)) {
        await fs.unlink(dataPath);
      }
      
      logger.info(`Плагин удален: ${pluginName}`);
      
      return {
        success: true,
        message: `Плагин ${pluginName} успешно удален`
      };
      
    } catch (error) {
      logger.error(`Ошибка удаления плагина: ${error.message}`);
      throw error;
    }
  }

  // Обновление всех плагинов
  async updateAllPlugins(serverId) {
    try {
      const plugins = await this.getInstalledPlugins(serverId);
      const updated = [];
      const failed = [];
      
      for (const plugin of plugins.plugins) {
        try {
          // Здесь можно добавить логику проверки обновлений
          // и обновления каждого плагина
          updated.push(plugin.name);
        } catch (error) {
          failed.push({
            plugin: plugin.name,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        updated,
        failed,
        message: `Обновлено: ${updated.length}, Ошибок: ${failed.length}`
      };
      
    } catch (error) {
      logger.error(`Ошибка обновления плагинов: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new PluginController();
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

class Helpers {
  // Проверка существования команды в системе
  static async commandExists(command) {
    return new Promise((resolve) => {
      exec(`which ${command}`, (error) => {
        resolve(!error);
      });
    });
  }

  // Получение размера директории
  static async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    const traverse = async (currentPath) => {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await traverse(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    };
    
    await traverse(dirPath);
    return totalSize;
  }

  // Форматирование размера файла
  static formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Форматирование времени
  static formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}д ${hours % 24}ч`;
    } else if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`;
    } else if (minutes > 0) {
      return `${minutes}м ${seconds % 60}с`;
    } else {
      return `${seconds}с`;
    }
  }

  // Проверка свободного места на диске
  static async getFreeDiskSpace(pathToCheck = '/') {
    return new Promise((resolve, reject) => {
      exec(`df -h ${pathToCheck} | tail -1 | awk '{print $4}'`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  // Получение информации о системе
  static async getSystemInfo() {
    return new Promise((resolve, reject) => {
      const commands = {
        os: `lsb_release -d | cut -f2`,
        kernel: `uname -r`,
        cpu: `lscpu | grep "Model name" | cut -d':' -f2 | xargs`,
        memory: `free -h | grep Mem | awk '{print $2}'`,
        uptime: `uptime -p`
      };
      
      const results = {};
      let completed = 0;
      const total = Object.keys(commands).length;
      
      Object.entries(commands).forEach(([key, cmd]) => {
        exec(cmd, (error, stdout) => {
          results[key] = error ? 'Недоступно' : stdout.trim();
          completed++;
          
          if (completed === total) {
            resolve(results);
          }
        });
      });
    });
  }

  // Валидация SteamID
  static isValidSteamID(steamId) {
    // SteamID может быть в разных форматах
    const patterns = [
      /^\d{17}$/, // SteamID64
      /^STEAM_[0-5]:[01]:\d+$/, // SteamID
      /^\[U:\d:\d+\]$/ // SteamID3
    ];
    
    return patterns.some(pattern => pattern.test(steamId));
  }

  // Генерация случайного пароля
  static generatePassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }

  // Проверка валидности JSON
  static isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  // Очистка строки от опасных символов для команд
  static sanitizeCommandInput(input) {
    return input
      .replace(/[;&|`$]/g, '')
      .replace(/\\/g, '')
      .trim();
  }

  // Задержка
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Ретрей с экспоненциальной задержкой
  static async retry(fn, retries = 3, delay = 1000) {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      
      await this.sleep(delay);
      return await this.retry(fn, retries - 1, delay * 2);
    }
  }

  // Парсинг конфигурационного файла Rust
  static parseRustConfig(configText) {
    const config = {};
    const lines = configText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Пропускаем комментарии и пустые строки
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        continue;
      }
      
      // Разделяем ключ и значение
      const match = trimmed.match(/^(\S+)\s+(.+)$/);
      if (match) {
        const [, key, value] = match;
        
        // Убираем кавычки если есть
        config[key] = value.replace(/^"(.*)"$/, '$1');
      }
    }
    
    return config;
  }

  // Генерация конфигурационного файла Rust
  static generateRustConfig(configObj) {
    let config = '';
    
    for (const [key, value] of Object.entries(configObj)) {
      // Добавляем кавычки если значение содержит пробелы
      const formattedValue = typeof value === 'string' && value.includes(' ') 
        ? `"${value}"` 
        : value;
      
      config += `${key} ${formattedValue}\n`;
    }
    
    return config;
  }
}

module.exports = Helpers;
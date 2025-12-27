const express = require('express');
const router = express.Router();
const ConfigController = require('../controllers/ConfigController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Настройка Multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    // Разрешаем все файлы для конфигов
    cb(null, true);
  }
});

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получение списка файлов и папок
router.get('/:serverId/list', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { path: subpath = '' } = req.query;
    
    await ConfigController.listFiles(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Чтение файла
router.get('/:serverId/file/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filepath = req.params[0]; // Получаем весь путь после /file/
    
    // Добавляем параметры к запросу для контроллера
    req.params.filepath = filepath;
    
    await ConfigController.readFile(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Сохранение файла
router.post('/:serverId/file/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filepath = req.params[0];
    
    req.params.filepath = filepath;
    await ConfigController.saveFile(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Создание файла или папки
router.post('/:serverId/create', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    await ConfigController.createItem(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Удаление файла или папки
router.delete('/:serverId/delete/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filepath = req.params[0];
    
    req.params.filepath = filepath;
    await ConfigController.deleteItem(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Загрузка файлов
router.post('/:serverId/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { serverId } = req.params;
    
    await ConfigController.uploadFiles(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Скачивание файла или папки
router.get('/:serverId/download/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filepath = req.params[0];
    
    req.params.filepath = filepath;
    await ConfigController.downloadItem(req, res);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Поиск файлов
router.get('/:serverId/search', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { query, extension } = req.query;
    
    if (!query && !extension) {
      return res.status(400).json({
        success: false,
        error: 'Не указан поисковый запрос или расширение'
      });
    }
    
    const fs = require('fs-extra');
    const path = require('path');
    
    const serverPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', `server-${serverId}`);
    
    const searchResults = [];
    
    const searchFiles = async (dir, pattern, ext) => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await searchFiles(itemPath, pattern, ext);
        } else {
          const matchesPattern = pattern ? item.name.toLowerCase().includes(pattern.toLowerCase()) : true;
          const matchesExtension = ext ? path.extname(item.name).toLowerCase() === ext.toLowerCase() : true;
          
          if (matchesPattern && matchesExtension) {
            const stats = await fs.stat(itemPath);
            searchResults.push({
              name: item.name,
              path: path.relative(serverPath, itemPath),
              size: stats.size,
              modified: stats.mtime,
              extension: path.extname(item.name)
            });
          }
        }
      }
    };
    
    await searchFiles(serverPath, query, extension);
    
    res.json({
      success: true,
      results: searchResults,
      count: searchResults.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение информации о файле
router.get('/:serverId/info/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filepath = req.params[0];
    
    const fs = require('fs-extra');
    const path = require('path');
    
    const serverPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', `server-${serverId}`);
    const targetPath = path.join(serverPath, filepath);
    
    // Проверка безопасности
    if (!targetPath.startsWith(serverPath)) {
      return res.status(403).json({
        success: false,
        error: 'Доступ запрещен'
      });
    }
    
    if (!await fs.pathExists(targetPath)) {
      return res.status(404).json({
        success: false,
        error: 'Файл не найден'
      });
    }
    
    const stats = await fs.stat(targetPath);
    const isFile = stats.isFile();
    
    const info = {
      name: path.basename(targetPath),
      path: filepath,
      type: isFile ? 'file' : 'directory',
      size: isFile ? stats.size : 0,
      permissions: stats.mode.toString(8).slice(-3),
      owner: stats.uid,
      group: stats.gid,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime
    };
    
    if (isFile) {
      info.extension = path.extname(targetPath).toLowerCase();
      
      // Для текстовых файлов определяем количество строк
      if (['.txt', '.cfg', '.json', '.xml', '.yml', '.yaml', '.cs', '.js', '.log'].includes(info.extension)) {
        try {
          const content = await fs.readFile(targetPath, 'utf8');
          info.lines = content.split('\n').length;
          info.encoding = 'utf8';
        } catch {
          info.encoding = 'binary';
        }
      }
    } else {
      // Для директорий получаем количество файлов
      const items = await fs.readdir(targetPath);
      info.itemCount = items.length;
    }
    
    res.json({
      success: true,
      info
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Изменение прав доступа
router.post('/:serverId/chmod/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filepath = req.params[0];
    const { mode } = req.body;
    
    if (!mode || !/^[0-7]{3}$/.test(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный режим доступа (используйте три цифры от 0 до 7)'
      });
    }
    
    const fs = require('fs-extra');
    const path = require('path');
    const { exec } = require('child_process');
    
    const serverPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', `server-${serverId}`);
    const targetPath = path.join(serverPath, filepath);
    
    // Проверка безопасности
    if (!targetPath.startsWith(serverPath)) {
      return res.status(403).json({
        success: false,
        error: 'Доступ запрещен'
      });
    }
    
    if (!await fs.pathExists(targetPath)) {
      return res.status(404).json({
        success: false,
        error: 'Файл не найден'
      });
    }
    
    // Изменяем права через chmod
    await new Promise((resolve, reject) => {
      exec(`chmod ${mode} "${targetPath}"`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    // Устанавливаем правильного владельца
    await new Promise((resolve, reject) => {
      exec(`chown rustserver:rustserver "${targetPath}"`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    res.json({
      success: true,
      message: 'Права доступа изменены',
      path: filepath,
      mode: mode
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Переименование файла или папки
router.post('/:serverId/rename/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const oldPath = req.params[0];
    const { newName } = req.body;
    
    if (!newName) {
      return res.status(400).json({
        success: false,
        error: 'Не указано новое имя'
      });
    }
    
    const fs = require('fs-extra');
    const path = require('path');
    
    const serverPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', `server-${serverId}`);
    const oldFullPath = path.join(serverPath, oldPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);
    
    // Проверка безопасности
    if (!oldFullPath.startsWith(serverPath) || !newFullPath.startsWith(serverPath)) {
      return res.status(403).json({
        success: false,
        error: 'Доступ запрещен'
      });
    }
    
    if (!await fs.pathExists(oldFullPath)) {
      return res.status(404).json({
        success: false,
        error: 'Файл не найден'
      });
    }
    
    if (await fs.pathExists(newFullPath)) {
      return res.status(400).json({
        success: false,
        error: 'Файл с таким именем уже существует'
      });
    }
    
    await fs.rename(oldFullPath, newFullPath);
    
    res.json({
      success: true,
      message: 'Файл переименован',
      oldName: path.basename(oldPath),
      newName: newName,
      newPath: path.relative(serverPath, newFullPath)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Копирование файла или папки
router.post('/:serverId/copy/*', async (req, res) => {
  try {
    const { serverId } = req.params;
    const sourcePath = req.params[0];
    const { destination } = req.body;
    
    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'Не указан путь назначения'
      });
    }
    
    const fs = require('fs-extra');
    const path = require('path');
    
    const serverPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', `server-${serverId}`);
    const sourceFullPath = path.join(serverPath, sourcePath);
    const destFullPath = path.join(serverPath, destination);
    
    // Проверка безопасности
    if (!sourceFullPath.startsWith(serverPath) || !destFullPath.startsWith(serverPath)) {
      return res.status(403).json({
        success: false,
        error: 'Доступ запрещен'
      });
    }
    
    if (!await fs.pathExists(sourceFullPath)) {
      return res.status(404).json({
        success: false,
        error: 'Исходный файл не найден'
      });
    }
    
    // Если назначение существует, добавляем суффикс
    let finalDestPath = destFullPath;
    let counter = 1;
    
    while (await fs.pathExists(finalDestPath)) {
      const ext = path.extname(destFullPath);
      const name = path.basename(destFullPath, ext);
      finalDestPath = path.join(
        path.dirname(destFullPath),
        `${name}_copy${counter}${ext}`
      );
      counter++;
    }
    
    await fs.copy(sourceFullPath, finalDestPath);
    
    res.json({
      success: true,
      message: 'Файл скопирован',
      source: sourcePath,
      destination: path.relative(serverPath, finalDestPath)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение популярных конфигов
router.get('/:serverId/popular-configs', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const popularConfigs = [
      {
        name: 'server.cfg',
        path: 'server.cfg',
        description: 'Основной конфигурационный файл сервера',
        icon: '⚙️',
        category: 'Основные'
      },
      {
        name: 'users.cfg',
        path: 'serveridentity/cfg/users.cfg',
        description: 'Конфиг администраторов и групп',
        icon: '👥',
        category: 'Администрирование'
      },
      {
        name: 'Economics.json',
        path: 'oxide/config/Economics.json',
        description: 'Конфиг плагина Economics',
        icon: '💰',
        category: 'Плагины'
      },
      {
        name: 'Kits.json',
        path: 'oxide/config/Kits.json',
        description: 'Конфиг плагина Kits',
        icon: '🎁',
        category: 'Плагины'
      },
      {
        name: 'oxide.cfg',
        path: 'oxide/config/oxide.cfg',
        description: 'Основной конфиг Oxide',
        icon: '🔌',
        category: 'Oxide'
      },
      {
        name: 'serverauto.cfg',
        path: 'cfg/serverauto.cfg',
        description: 'Автоматически выполняемые команды',
        icon: '🤖',
        category: 'Автоматизация'
      },
      {
        name: 'bootstrap.cfg',
        path: 'cfg/bootstrap.cfg',
        description: 'Конфиг начальной загрузки',
        icon: '🚀',
        category: 'Системные'
      }
    ];
    
    // Проверяем существование файлов
    const fs = require('fs-extra');
    const path = require('path');
    const serverPath = path.join(process.env.RUST_SERVER_PATH || '/home/rustserver', `server-${serverId}`);
    
    for (const config of popularConfigs) {
      const configPath = path.join(serverPath, config.path);
      config.exists = await fs.pathExists(configPath);
    }
    
    res.json({
      success: true,
      configs: popularConfigs
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Проверка синтаксиса JSON
router.post('/:serverId/validate-json', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Контент не указан'
      });
    }
    
    try {
      JSON.parse(content);
      
      res.json({
        success: true,
        valid: true,
        message: 'JSON валиден'
      });
    } catch (error) {
      res.json({
        success: true,
        valid: false,
        message: 'Ошибка в JSON',
        error: error.message,
        position: error.position
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение шаблонов конфигов
router.get('/templates/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    
    const templates = {
      'server.cfg': `
hostname "Мой Rust Сервер"
description "Сервер Rust с веб-панелью"
port 28015
rcon.port 28016
rcon.password "change_this_password"
rcon.web 1
server.maxplayers 50
server.seed 12345
server.worldsize 3000
server.saveinterval 300
server.tickrate 30
server.identity "server1"
server.level "Procedural Map"
server.url ""
server.headerimage ""
server.logo ""
      `,
      
      'users.cfg': `
// Формат: ownerid "STEAM_0:0:12345678" "username" "group"
// Пример администратора:
ownerid "76561197960287930" "admin" "owner"

// Группы прав:
// owner - полные права
// moderator - модератор
// admin - администратор
// user - обычный пользователь
      `,
      
      'Economics.json': `{
  "Settings": {
    "UseEconomics": true,
    "UseServerRewards": false,
    "StartingBalance": 1000,
    "CurrencyName": "Рубли",
    "CurrencySymbol": "₽"
  },
  "Shop": {
    "example_item": {
      "DisplayName": "Пример товара",
      "ShortName": "scrap",
      "Amount": 100,
      "Skin": 0,
      "Price": 100,
      "Category": "Ресурсы",
      "Enabled": true,
      "Permissions": []
    }
  }
}`,
      
      'Kits.json': `{
  "example_kit": {
    "DisplayName": "Стартовый набор",
    "Items": [
      {
        "ShortName": "rock",
        "Amount": 1,
        "Skin": 0,
        "Container": "belt"
      },
      {
        "ShortName": "torch",
        "Amount": 1,
        "Skin": 0,
        "Container": "belt"
      }
    ],
    "Cooldown": 300,
    "Permissions": [],
    "MaxUses": 0
  }
}`
    };
    
    if (templates[templateName]) {
      res.json({
        success: true,
        template: templates[templateName],
        name: templateName
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Шаблон не найден'
      });
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
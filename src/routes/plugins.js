const express = require('express');
const router = express.Router();
const PluginController = require('../controllers/PluginController');
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.dll', '.cs', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла. Разрешены: .dll, .cs, .zip'));
    }
  }
});

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Установка Oxide
router.post('/:serverId/install-oxide', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await PluginController.installOxide(serverId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Поиск плагинов
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Не указан поисковый запрос'
      });
    }
    
    const result = await PluginController.searchPlugins(q, parseInt(page));
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение установленных плагинов
router.get('/:serverId/list', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await PluginController.getInstalledPlugins(serverId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Установка плагина по URL
router.post('/:serverId/install', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Не указан URL плагина'
      });
    }
    
    const result = await PluginController.installPlugin(serverId, url);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Загрузка плагина файлом
router.post('/:serverId/upload', upload.single('plugin'), async (req, res) => {
  try {
    const { serverId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Файл не загружен'
      });
    }
    
    // Для загруженного файла создаем временный URL
    const fileUrl = `file://${req.file.path}`;
    const result = await PluginController.installPlugin(serverId, fileUrl);
    
    // Удаляем временный файл
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Управление плагином
router.post('/:serverId/manage/:pluginName', async (req, res) => {
  try {
    const { serverId, pluginName } = req.params;
    const { action } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Не указано действие'
      });
    }
    
    const result = await PluginController.managePlugin(serverId, pluginName, action);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Удаление плагина
router.delete('/:serverId/remove/:pluginName', async (req, res) => {
  try {
    const { serverId, pluginName } = req.params;
    
    const result = await PluginController.removePlugin(serverId, pluginName);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Обновление всех плагинов
router.post('/:serverId/update-all', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await PluginController.updateAllPlugins(serverId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение популярных плагинов
router.get('/popular', async (req, res) => {
  try {
    // Статический список популярных плагинов
    const popularPlugins = [
      {
        name: 'Economics',
        description: 'Экономическая система с магазином',
        author: 'Oxide',
        downloads: '1M+',
        url: 'https://umod.org/plugins/economics'
      },
      {
        name: 'MagicPanel',
        description: 'Информационная панель с телепортами',
        author: 'Magic',
        downloads: '500K+',
        url: 'https://umod.org/plugins/magic-panel'
      },
      {
        name: 'NTeleportation',
        description: 'Система телепортации и варпов',
        author: 'Nogrod',
        downloads: '800K+',
        url: 'https://umod.org/plugins/n-teleportation'
      },
      {
        name: 'Backpacks',
        description: 'Система рюкзаков для хранения',
        author: 'WhiteThunder',
        downloads: '300K+',
        url: 'https://umod.org/plugins/backpacks'
      },
      {
        name: 'Kits',
        description: 'Система наборов (китов)',
        author: 'Oxide',
        downloads: '2M+',
        url: 'https://umod.org/plugins/kits'
      },
      {
        name: 'AutoCodeLock',
        description: 'Автоматическое кодовое запирание',
        author: 'WhiteThunder',
        downloads: '400K+',
        url: 'https://umod.org/plugins/auto-code-lock'
      },
      {
        name: 'Friends',
        description: 'Система друзей',
        author: 'VisEntities',
        downloads: '200K+',
        url: 'https://umod.org/plugins/friends'
      },
      {
        name: 'Clans',
        description: 'Система кланов',
        author: 'MJSU',
        downloads: '600K+',
        url: 'https://umod.org/plugins/clans'
      }
    ];
    
    res.json({
      success: true,
      plugins: popularPlugins
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение информации о плагине
router.get('/info/:pluginName', async (req, res) => {
  try {
    const { pluginName } = req.params;
    
    // Здесь можно добавить логику получения информации с uMod
    res.json({
      success: true,
      plugin: {
        name: pluginName,
        description: 'Описание плагина',
        author: 'Неизвестно',
        version: '1.0.0',
        last_updated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const ShopController = require('../controllers/ShopController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Настройка Multer для загрузки изображений
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/shop/images/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'item-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип изображения'));
    }
  }
});

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получение всех товаров
router.get('/:serverId/items', async (req, res) => {
  try {
    const { serverId } = req.params;
    const filters = {
      category: req.query.category,
      activeOnly: req.query.active !== 'false',
      search: req.query.search
    };
    
    const items = await ShopController.getItems(serverId, filters);
    
    res.json({
      success: true,
      items
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Добавление товара
router.post('/:serverId/items', upload.single('image'), async (req, res) => {
  try {
    const { serverId } = req.params;
    const itemData = req.body;
    
    // Обрабатываем загруженное изображение
    if (req.file) {
      itemData.image_url = `/shop/images/${req.file.filename}`;
    }
    
    // Парсим JSON поля если они пришли как строки
    if (typeof itemData.permissions === 'string') {
      itemData.permissions = JSON.parse(itemData.permissions);
    }
    
    if (typeof itemData.commands === 'string') {
      itemData.commands = JSON.parse(itemData.commands);
    }
    
    const result = await ShopController.addItem(serverId, itemData);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Обновление товара
router.put('/items/:itemId', upload.single('image'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const itemData = req.body;
    
    // Обрабатываем загруженное изображение
    if (req.file) {
      itemData.image_url = `/shop/images/${req.file.filename}`;
    }
    
    const result = await ShopController.updateItem(itemId, itemData);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Удаление товара
router.delete('/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const result = await ShopController.deleteItem(itemId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Экспорт в плагин
router.post('/:serverId/export/:pluginType', async (req, res) => {
  try {
    const { serverId, pluginType } = req.params;
    
    const result = await ShopController.exportToPlugin(serverId, pluginType);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Создание промокода
router.post('/coupons', async (req, res) => {
  try {
    const couponData = req.body;
    
    const result = await ShopController.createCoupon(couponData);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение статистики продаж
router.get('/:serverId/stats', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { period = 'month' } = req.query;
    
    const result = await ShopController.getSalesStats(serverId, period);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Симуляция покупки (для тестов)
router.post('/:serverId/simulate-purchase', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { itemId, playerId, playerName } = req.body;
    
    if (!itemId || !playerId) {
      return res.status(400).json({
        success: false,
        error: 'Не указаны itemId или playerId'
      });
    }
    
    const result = await ShopController.simulatePurchase(
      serverId, 
      itemId, 
      playerId, 
      playerName || 'Test Player'
    );
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение веб-магазина для игроков
router.get('/:serverId/public', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { playerId } = req.query;
    
    const result = await ShopController.getPlayerShop(serverId, playerId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение категорий
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'weapons', name: 'Оружие', icon: '🔫', description: 'Оружие и боеприпасы' },
      { id: 'resources', name: 'Ресурсы', icon: '⛏️', description: 'Ресурсы для строительства' },
      { id: 'building', name: 'Строительство', icon: '🏗️', description: 'Блоки и материалы' },
      { id: 'transport', name: 'Транспорт', icon: '🚗', description: 'Транспортные средства' },
      { id: 'clothing', name: 'Одежда', icon: '👕', description: 'Одежда и броня' },
      { id: 'tools', name: 'Инструменты', icon: '🛠️', description: 'Инструменты и устройства' },
      { id: 'medical', name: 'Медицина', icon: '💊', description: 'Медицинские предметы' },
      { id: 'food', name: 'Еда', icon: '🍖', description: 'Еда и напитки' },
      { id: 'skins', name: 'Скины', icon: '🎨', description: 'Скины на предметы' },
      { id: 'privileges', name: 'Привилегии', icon: '👑', description: 'Привилегии и возможности' },
      { id: 'kits', name: 'Наборы', icon: '🎁', description: 'Готовые наборы предметов' },
      { id: 'other', name: 'Разное', icon: '📦', description: 'Прочие предметы' }
    ];
    
    res.json({
      success: true,
      categories
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение популярных предметов Rust
router.get('/popular-items', async (req, res) => {
  try {
    const popularItems = [
      {
        shortname: 'assault.rifle',
        name: 'АК-47',
        description: 'Автомат Калашникова',
        category: 'weapons',
        average_price: 1000
      },
      {
        shortname: 'rocket.launcher',
        name: 'Ракетная установка',
        description: 'РПГ-7',
        category: 'weapons',
        average_price: 5000
      },
      {
        shortname: 'metal.fragments',
        name: 'Металл',
        description: 'Металлические фрагменты',
        category: 'resources',
        average_price: 1
      },
      {
        shortname: 'hq.metal.ore',
        name: 'Высококачественная руда',
        description: 'HQ металлическая руда',
        category: 'resources',
        average_price: 10
      },
      {
        shortname: 'supply.signal',
        name: 'Сигнальная ракета',
        description: 'Вызывает аирдроп',
        category: 'other',
        average_price: 500
      },
      {
        shortname: 'scrap',
        name: 'Металлолом',
        description: 'Основная валюта Rust',
        category: 'resources',
        average_price: 0.5
      }
    ];
    
    res.json({
      success: true,
      items: popularItems
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Проверка промокода
router.post('/validate-coupon', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Не указан код промокода'
      });
    }
    
    const result = await ShopController.validateCoupon(code);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
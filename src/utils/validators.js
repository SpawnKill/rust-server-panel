const { body, param, query } = require('express-validator');

const validators = {
  // Валидация установки сервера
  installServer: [
    body('serverName')
      .notEmpty().withMessage('Имя сервера обязательно')
      .isLength({ min: 3, max: 50 }).withMessage('Имя сервера должно быть от 3 до 50 символов')
      .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('Имя сервера может содержать только буквы, цифры, пробелы, дефисы и подчеркивания'),
    
    body('worldSize')
      .optional()
      .isInt({ min: 1000, max: 8000 }).withMessage('Размер мира должен быть от 1000 до 8000'),
    
    body('maxPlayers')
      .optional()
      .isInt({ min: 1, max: 500 }).withMessage('Максимальное количество игроков должно быть от 1 до 500'),
    
    body('rconPassword')
      .optional()
      .isLength({ min: 6, max: 32 }).withMessage('RCON пароль должен быть от 6 до 32 символов')
  ],

  // Валидация управления сервером
  controlServer: [
    param('serverId')
      .notEmpty().withMessage('ID сервера обязательно')
      .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Некорректный ID сервера'),
    
    body('action')
      .notEmpty().withMessage('Действие обязательно')
      .isIn(['start', 'stop', 'restart', 'kill']).withMessage('Некорректное действие')
  ],

  // Валидация конфигурационных файлов
  configFile: [
    param('serverId')
      .notEmpty().withMessage('ID сервера обязательно')
      .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Некорректный ID сервера'),
    
    param('filepath')
      .notEmpty().withMessage('Путь к файлу обязателен')
      .matches(/^[a-zA-Z0-9\-_\/.]+$/).withMessage('Некорректный путь к файлу')
  ],

  // Валидация RCON команд
  rconCommand: [
    body('command')
      .notEmpty().withMessage('Команда обязательна')
      .isLength({ max: 500 }).withMessage('Команда слишком длинная')
      .matches(/^[a-zA-Z0-9\s\-_."':!@#$%^&*()+=|\\<>?\/\[\]{}]+$/).withMessage('Недопустимые символы в команде')
  ],

  // Валидация товара магазина
  shopItem: [
    body('name')
      .notEmpty().withMessage('Название товара обязательно')
      .isLength({ min: 2, max: 100 }).withMessage('Название должно быть от 2 до 100 символов'),
    
    body('item_type')
      .notEmpty().withMessage('Тип предмета обязателен')
      .isIn(['weapon', 'resource', 'skin', 'kit', 'permission', 'other']).withMessage('Некорректный тип предмета'),
    
    body('item_shortname')
      .notEmpty().withMessage('Shortname предмета обязателен')
      .matches(/^[a-zA-Z0-9.\-]+$/).withMessage('Некорректный shortname предмета'),
    
    body('price')
      .notEmpty().withMessage('Цена обязательна')
      .isFloat({ min: 0 }).withMessage('Цена должна быть положительным числом'),
    
    body('category')
      .notEmpty().withMessage('Категория обязательна')
      .isLength({ max: 50 }).withMessage('Категория слишком длинная'),
    
    body('item_amount')
      .optional()
      .isInt({ min: 1 }).withMessage('Количество должно быть положительным числом'),
    
    body('item_skin')
      .optional()
      .isInt({ min: 0 }).withMessage('ID скина должен быть положительным числом')
  ],

  // Валидация промокода
  coupon: [
    body('discount_value')
      .notEmpty().withMessage('Значение скидки обязательно')
      .isFloat({ min: 0 }).withMessage('Значение скидки должно быть положительным числом'),
    
    body('discount_type')
      .optional()
      .isIn(['percent', 'fixed']).withMessage('Тип скидки должен быть percent или fixed'),
    
    body('max_uses')
      .optional()
      .isInt({ min: 1 }).withMessage('Максимальное количество использований должно быть положительным числом'),
    
    body('expires_at')
      .optional()
      .isISO8601().withMessage('Некорректная дата окончания')
  ],

  // Валидация Steam API Key
  steamApiKey: [
    body('apiKey')
      .notEmpty().withMessage('Steam API Key обязателен')
      .isLength({ min: 32, max: 32 }).withMessage('Steam API Key должен содержать 32 символа')
      .matches(/^[A-Z0-9]+$/).withMessage('Некорректный формат Steam API Key')
  ],

  // Валидация поиска
  search: [
    query('q')
      .optional()
      .isLength({ max: 100 }).withMessage('Поисковый запрос слишком длинный'),
    
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Номер страницы должен быть положительным числом'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Лимит должен быть от 1 до 100')
  ],

  // Валидация файлов
  fileUpload: [
    body('filename')
      .optional()
      .matches(/^[a-zA-Z0-9\-_.]+$/).withMessage('Некорректное имя файла'),
    
    body('destination')
      .optional()
      .matches(/^[a-zA-Z0-9\-_\/.]+$/).withMessage('Некорректный путь назначения')
  ],

  // Валидация пользователя
  user: [
    body('username')
      .notEmpty().withMessage('Имя пользователя обязательно')
      .isLength({ min: 3, max: 20 }).withMessage('Имя пользователя должно быть от 3 до 20 символов')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Имя пользователя может содержать только буквы, цифры и подчеркивания'),
    
    body('email')
      .optional()
      .isEmail().withMessage('Некорректный email'),
    
    body('password')
      .notEmpty().withMessage('Пароль обязателен')
      .isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов')
  ]
};

// Валидация IP адреса
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  return ipv6Regex.test(ip);
}

// Валидация порта
function isValidPort(port) {
  const num = parseInt(port, 10);
  return !isNaN(num) && num >= 1 && num <= 65535;
}

// Валидация SteamID
function isValidSteamID(steamId) {
  const patterns = [
    /^\d{17}$/, // SteamID64
    /^STEAM_[0-5]:[01]:\d+$/, // SteamID
    /^\[U:\d:\d+\]$/ // SteamID3
  ];
  
  return patterns.some(pattern => pattern.test(steamId));
}

// Валидация JSON строки
function isValidJSONString(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Валидация пути (без traversal атак)
function isValidPath(path) {
  // Запрещаем переходы по директориям
  if (path.includes('..') || path.includes('//')) {
    return false;
  }
  
  // Проверяем допустимые символы
  const validCharsRegex = /^[a-zA-Z0-9\-_\/. ]+$/;
  return validCharsRegex.test(path);
}

module.exports = {
  ...validators,
  isValidIP,
  isValidPort,
  isValidSteamID,
  isValidJSONString,
  isValidPath
};
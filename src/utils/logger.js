const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Создаем директорию для логов если её нет
const logDir = path.join(__dirname, '../../logs');
fs.ensureDirSync(logDir);

// Формат логов с цветами для консоли
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Формат логов для файлов
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Создаем логгер
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Логи в консоль
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true
    }),
    
    // Логи ошибок в файл
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Все логи в файл
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Логи HTTP запросов
    new winston.transports.File({
      filename: path.join(logDir, 'http.log'),
      level: 'http',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  exitOnError: false
});

// Создаем stream для Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Дополнительные методы для удобства
logger.success = (message, meta = {}) => {
  logger.info(`✅ ${message}`, meta);
};

logger.warning = (message, meta = {}) => {
  logger.warn(`⚠️ ${message}`, meta);
};

logger.error = (message, meta = {}) => {
  logger.error(`❌ ${message}`, meta);
};

logger.debug = (message, meta = {}) => {
  logger.debug(`🐛 ${message}`, meta);
};

// Логгирование HTTP запросов
logger.http = (message, meta = {}) => {
  logger.log('http', `🌐 ${message}`, meta);
};

module.exports = logger;